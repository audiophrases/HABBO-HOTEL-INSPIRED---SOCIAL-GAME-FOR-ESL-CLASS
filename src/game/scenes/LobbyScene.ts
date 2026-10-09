import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { renderAvatarSvg } from '../../utils/AvatarRenderer';
import type { AvatarConfig } from '../../utils/AvatarRenderer';

export default class LobbyScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private username: string = '';
  private room!: Colyseus.Room;
  
  private playerEntities: { [sessionId: string]: Phaser.GameObjects.Container } = {};
  private localPlayerContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('LobbyScene');
  }

  init(data: { username: string, room: Colyseus.Room }) {
    this.username = data.username || 'Guest';
    this.room = data.room;
  }

  preload() {
    this.load.image('plaza_bg', '/assets/plaza.jpg');
  }

  create() {
    // Add the background image
    const bg = this.add.image(0, 0, 'plaza_bg').setOrigin(0, 0);
    
    // Scale image to a reasonable size (not 4000x4000 which makes it too zoomed in)
    bg.setScale(2); // 2x scale makes it 2048x2048 if it was 1024x1024
    
    const mapWidth = bg.displayWidth;
    const mapHeight = bg.displayHeight;
    
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }
    
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // Create a StaticGroup for walls/buildings
    this.walls = this.physics.add.staticGroup();

    // Helper to create walls from top-left coordinates
    const createWall = (x: number, y: number, w: number, h: number) => {
      const rect = this.add.rectangle(x, y, w, h, 0xff0000, 0.3).setOrigin(0, 0);
      this.physics.add.existing(rect, true); // true = static body
      this.walls.add(rect);
    };

    // 1. Grand Plaza Hotel (Top Left/Center)
    createWall(0, 0, 1100, 480);
    
    // 2. Right Tower (Top Right)
    createWall(1100, 0, 948, 650);
    
    // 3. The Rusty Mug (Bottom Right)
    createWall(1400, 650, 648, 1398);
    
    // 4. Bottom Left Trees & Decor
    createWall(0, 850, 450, 1198);

    this.room.state.players.onAdd((player: any, sessionId: string) => {
      const isLocal = (sessionId === this.room.sessionId);

      // Create nameplate
      const nameText = this.add.text(0, -60, player.username, {
        fontSize: '12px',
        fontFamily: '"Press Start 2P", cursive',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5);
      
      const container = this.add.container(player.x, player.y, [nameText]);
      this.playerEntities[sessionId] = container;

      // Render Avatar SVG
      const config: AvatarConfig = {
        skin: player.skin,
        hairColor: player.hairColor,
        hair: player.hair,
        eyes: player.eyes,
        mouth: player.mouth,
        shirt: player.shirt,
        glasses: player.glasses,
        hat: player.hat
      };

      const svgStr = renderAvatarSvg(config);
      this.loadSvgToContainer(sessionId, svgStr, container, isLocal);

      if (isLocal) {
        this.localPlayerContainer = container;
        this.physics.world.enable(this.localPlayerContainer);
        const body = this.localPlayerContainer.body as Phaser.Physics.Arcade.Body;
        // Adjust body size to approximate the avatar
        body.setSize(32, 64);
        body.setOffset(-16, -32);
        body.setCollideWorldBounds(true);
        
        // Collide with buildings/walls
        this.physics.add.collider(this.localPlayerContainer, this.walls);
        
        this.cameras.main.startFollow(this.localPlayerContainer, true, 0.1, 0.1);
      } else {
        player.onChange(() => {
          this.tweens.add({
            targets: container,
            x: player.x,
            y: player.y,
            duration: 100
          });
        });
      }
    });

    this.room.state.players.onRemove((player: any, sessionId: string) => {
      const container = this.playerEntities[sessionId];
      if (container) {
        container.destroy();
        delete this.playerEntities[sessionId];
      }
      this.textures.remove('avatar_' + sessionId);
    });

    this.room.onMessage("player_emote", (data: { sessionId: string, emote: string }) => {
      const container = this.playerEntities[data.sessionId];
      if (container) {
        this.showEmote(container, data.emote);
      }
    });
  }

  private showEmote(container: Phaser.GameObjects.Container, emote: string) {
    const emoteText = this.add.text(0, -70, emote, {
      fontSize: '28px',
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);
    
    container.add(emoteText);
    
    // Make sure emote is always on top
    emoteText.setDepth(10);

    this.tweens.add({
      targets: emoteText,
      y: -120,
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => {
        emoteText.destroy();
      }
    });
  }

  private loadSvgToContainer(sessionId: string, svgStr: string, container: Phaser.GameObjects.Container, isLocal: boolean) {
    if (!svgStr) {
      // Fallback graphic if SVG fails to generate
      const fallback = this.add.rectangle(0, -16, 32, 64, isLocal ? 0xFF5A5F : 0x4285F4);
      container.add(fallback);
      // Ensure name is always on top
      container.list.forEach(child => child.setDepth(1));
      fallback.setDepth(0);
      return;
    }

    const textureKey = 'avatar_' + sessionId;
    
    // Create an Image object to load the data URI
    const img = new Image();
    // Use base64 encoding to avoid parsing issues with raw SVG strings in data URIs
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    
    img.onload = () => {
      if (!this.textures.exists(textureKey)) {
        this.textures.addImage(textureKey, img);
      }
      
      const sprite = this.add.sprite(0, -16, textureKey);
      sprite.setScale(0.8); // Adjust scale based on PinPlay viewBox
      container.add(sprite);

      // Re-sort container so nameplate is above sprite
      container.list.forEach(child => {
        if (child instanceof Phaser.GameObjects.Text) {
          child.setDepth(1);
        } else {
          child.setDepth(0);
        }
      });
    };
  }

  update() {
    if (!this.cursors || !this.localPlayerContainer || !this.localPlayerContainer.body) return;

    const body = this.localPlayerContainer.body as Phaser.Physics.Arcade.Body;
    const speed = 200;
    
    const prevX = this.localPlayerContainer.x;
    const prevY = this.localPlayerContainer.y;

    body.setVelocity(0);

    if (this.cursors.left.isDown) {
      body.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(speed);
    }

    if (this.cursors.up.isDown) {
      body.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      body.setVelocityY(speed);
    }

    if (this.localPlayerContainer.x !== prevX || this.localPlayerContainer.y !== prevY) {
      this.room.send("move", { 
        x: this.localPlayerContainer.x, 
        y: this.localPlayerContainer.y 
      });
    }
  }
}
