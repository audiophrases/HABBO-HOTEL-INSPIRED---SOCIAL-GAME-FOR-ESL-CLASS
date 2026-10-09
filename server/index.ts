import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { createServer } from "http";
import { LobbyRoom } from "./rooms/LobbyRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const gameServer = new Server({
  server: createServer(app)
});

// Register Lobby Room
gameServer.define("lobby", LobbyRoom);

// Start server
gameServer.listen(port).then(() => {
    console.log(`🎮 Pixel Plaza Game Server is running on ws://localhost:${port}`);
});
