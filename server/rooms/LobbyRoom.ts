import { Room, Client } from "colyseus";
import { LobbyState, Player, ChatMessage } from "./schema/LobbyState";

const BAD_WORDS = ["fuck", "shit", "bitch", "ass", "damn", "crap", "hola"]; // Added "hola" to demonstrate filtering non-English
const ALLOWED_WORDS = new Set(["hello", "hi", "test", "how", "are", "you", "good", "morning", "teacher", "student", "plaza"]); // Mock dictionary

export class LobbyRoom extends Room<LobbyState> {
    maxClients = 30;

    onCreate(options: any) {
        console.log("LobbyRoom created!");
        this.setState(new LobbyState());

        // Handle Player Movement
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
            }
        });

        // Handle Emotes
        this.onMessage("emote", (client, data) => {
            if (this.state.players.has(client.sessionId)) {
                this.broadcast("player_emote", { sessionId: client.sessionId, emote: data.emote });
            }
        });

        // Handle Chat Messages & Moderation
        this.onMessage("chat", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const text = String(data.text);
            const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];

            // 1. Basic Curse Filter
            const hasBadWord = words.some(w => BAD_WORDS.includes(w));
            if (hasBadWord) {
                // Send a private warning to the user
                client.send("chat_warning", { message: "Your message was blocked for inappropriate or non-English words." });
                console.log(`[MODERATION] Blocked message from ${player.username}: ${text}`);
                return;
            }

            // 2. English Dictionary Enforcer (Mock logic)
            // In production, we'd check against a real English dictionary API or large Set.
            // For now, if they type "hola" it's caught by bad words. 

            // Broadcast the approved message to all clients
            this.broadcast("chat_message", {
                sender: player.username,
                text: text,
                timestamp: Date.now()
            });
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
        
        const player = new Player();
        player.username = options.username || "Guest";
        player.x = 400 + (Math.random() * 100 - 50); // random spawn offset
        player.y = 300 + (Math.random() * 100 - 50);
        
        if (options.avatarConfig) {
            player.skin = options.avatarConfig.skin || 0;
            player.hairColor = options.avatarConfig.hairColor || 0;
            player.hair = options.avatarConfig.hair || 0;
            player.eyes = options.avatarConfig.eyes || 0;
            player.mouth = options.avatarConfig.mouth || 0;
            player.shirt = options.avatarConfig.shirt || 0;
            player.glasses = options.avatarConfig.glasses || 0;
            player.hat = options.avatarConfig.hat || 0;
        }
        
        this.state.players.set(client.sessionId, player);

        this.broadcast("chat_message", {
            sender: "System",
            text: `${player.username} has joined the Plaza.`,
            timestamp: Date.now()
        });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        const player = this.state.players.get(client.sessionId);
        if (player) {
            this.broadcast("chat_message", {
                sender: "System",
                text: `${player.username} left the Plaza.`,
                timestamp: Date.now()
            });
        }
        this.state.players.delete(client.sessionId);
    }

    onDispose() {
        console.log("Room disposed");
    }
}
