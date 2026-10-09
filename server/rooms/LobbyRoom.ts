import { Room, Client } from "colyseus";
import { LobbyState, Player } from "./schema/LobbyState";
import { chatProblem, classroom, secretsMatch, validUsername } from "../classroom";

export class LobbyRoom extends Room<LobbyState> {
    maxClients = 100;
    private lastChat = new Map<string, number>();

    onAuth(_client: Client, options: any) {
        return classroom.open && secretsMatch(options?.pin, process.env.CLASS_PIN || "")
            && validUsername(options?.username);
    }

    onCreate(_options: any) {
        console.log("LobbyRoom created!");
        this.setState(new LobbyState());

        // Handle Player Movement
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && Number.isFinite(data?.x) && Number.isFinite(data?.y)
                && data.x >= 0 && data.x <= 2048 && data.y >= 0 && data.y <= 2048) {
                player.x = data.x;
                player.y = data.y;
            }
        });

        // Handle Emotes
        this.onMessage("emote", (client, data) => {
            if (this.state.players.has(client.sessionId) && ["🙋", "❓", "👍", "😂"].includes(data?.emote)) {
                this.broadcast("player_emote", { sessionId: client.sessionId, emote: data.emote });
            }
        });

        // Handle Chat Messages & Moderation
        this.onMessage("chat", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            if (!classroom.open || classroom.isMuted(client.sessionId)) {
                client.send("chat_warning", { message: "Chat is unavailable right now." });
                return;
            }
            const now = Date.now();
            if (now - (this.lastChat.get(client.sessionId) || 0) < 1500) {
                client.send("chat_warning", { message: "Please wait before sending another message." });
                return;
            }
            this.lastChat.set(client.sessionId, now);
            const problem = chatProblem(data?.text);
            if (problem && typeof data?.text !== "string") {
                client.send("chat_warning", { message: problem });
                return;
            }
            const text = (data.text as string).trim();
            const entry = classroom.submit(client.sessionId, player.username, text, () => {
                if (this.state.players.has(client.sessionId)) {
                    this.broadcast("chat_message", { sender: player.username, text, timestamp: Date.now() });
                }
            }, approved => {
                if (this.state.players.has(client.sessionId)) {
                    client.send("chat_decision", { message: approved ? "Your message was approved." : "Your message was not posted." });
                }
            });
            client.send(entry.status === "blocked" ? "chat_warning" : "chat_pending", {
                message: entry.status === "blocked" ? problem : "Sent to your teacher for approval."
            });
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
        
        const player = new Player();
        player.username = options.username.trim();
        player.x = 700 + (Math.random() * 100 - 50);
        player.y = 700 + (Math.random() * 100 - 50);
        
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

    onLeave(client: Client, _consented: boolean) {
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
        this.lastChat.delete(client.sessionId);
    }

    onDispose() {
        console.log("Room disposed");
    }
}
