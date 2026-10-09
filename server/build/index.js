"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const colyseus_1 = require("colyseus");
const http_1 = require("http");
const LobbyRoom_1 = require("./rooms/LobbyRoom");
const port = Number(process.env.PORT || 2567);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const gameServer = new colyseus_1.Server({
    server: (0, http_1.createServer)(app)
});
// Register Lobby Room
gameServer.define("lobby", LobbyRoom_1.LobbyRoom);
// Start server
gameServer.listen(port).then(() => {
    console.log(`🎮 Pixel Plaza Game Server is running on ws://localhost:${port}`);
});
