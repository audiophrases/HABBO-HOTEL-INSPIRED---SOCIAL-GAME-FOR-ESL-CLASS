"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyRoom = void 0;
const colyseus_1 = require("colyseus");
const LobbyState_1 = require("./schema/LobbyState");
const classroom_1 = require("../classroom");
const pinplay_1 = require("../pinplay");
class LobbyRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 100;
        this.lastChat = new Map();
        this.playerKeys = new Map();
    }
    async onAuth(_client, options) {
        if (!classroom_1.classroom.open || !(0, classroom_1.secretsMatch)(options === null || options === void 0 ? void 0 : options.pin, process.env.CLASS_PIN || ""))
            return false;
        return (0, pinplay_1.resolveStudent)(options === null || options === void 0 ? void 0 : options.studentToken);
    }
    onCreate(_options) {
        console.log("LobbyRoom created!");
        this.setState(new LobbyState_1.LobbyState());
        // Handle Player Movement
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player && Number.isFinite(data === null || data === void 0 ? void 0 : data.x) && Number.isFinite(data === null || data === void 0 ? void 0 : data.y)
                && data.x >= 0 && data.x <= 2048 && data.y >= 0 && data.y <= 2048) {
                player.x = data.x;
                player.y = data.y;
            }
        });
        // Handle Emotes
        this.onMessage("emote", (client, data) => {
            if (this.state.players.has(client.sessionId) && ["🙋", "❓", "👍", "😂"].includes(data === null || data === void 0 ? void 0 : data.emote)) {
                this.broadcast("player_emote", { sessionId: client.sessionId, emote: data.emote });
            }
        });
        // Handle Chat Messages & Moderation
        this.onMessage("chat", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            const studentKey = this.playerKeys.get(client.sessionId);
            if (!studentKey)
                return;
            if (!classroom_1.classroom.open || classroom_1.classroom.isMuted(studentKey)) {
                client.send("chat_warning", { message: "Chat is unavailable right now." });
                return;
            }
            const now = Date.now();
            if (now - (this.lastChat.get(studentKey) || 0) < 1500) {
                client.send("chat_warning", { message: "Please wait before sending another message." });
                return;
            }
            this.lastChat.set(studentKey, now);
            const problem = (0, classroom_1.chatProblem)(data === null || data === void 0 ? void 0 : data.text);
            if (problem && typeof (data === null || data === void 0 ? void 0 : data.text) !== "string") {
                client.send("chat_warning", { message: problem });
                return;
            }
            const text = data.text.trim();
            const entry = classroom_1.classroom.submit(studentKey, player.username, text, () => {
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
    onJoin(client, options, auth) {
        if (!auth)
            throw new Error("Verified student identity is required.");
        console.log(client.sessionId, "joined!");
        const player = new LobbyState_1.Player();
        const displayName = auth.displayName.replace(/[^\p{L}\p{N} _-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 24);
        player.username = (0, classroom_1.validUsername)(displayName) ? displayName : "Student";
        this.playerKeys.set(client.sessionId, auth.studentKey);
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
    onLeave(client, _consented) {
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
        this.playerKeys.delete(client.sessionId);
    }
    onDispose() {
        console.log("Room disposed");
    }
}
exports.LobbyRoom = LobbyRoom;
