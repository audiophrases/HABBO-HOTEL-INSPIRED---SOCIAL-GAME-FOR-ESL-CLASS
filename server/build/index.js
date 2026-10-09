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
const classroom_1 = require("./classroom");
const pinplay_1 = require("./pinplay");
if (!/^\d{4,8}$/.test(process.env.CLASS_PIN || "") || (process.env.TEACHER_KEY || "").length < 16) {
    throw new Error("Set CLASS_PIN (4–8 digits) and TEACHER_KEY (at least 16 characters) before starting the server.");
}
const port = Number(process.env.PORT || 2567);
const app = (0, express_1.default)();
const allowedOrigins = process.env.APP_ORIGIN
    ? [process.env.APP_ORIGIN]
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use((0, cors_1.default)({ origin: allowedOrigins }));
app.use(express_1.default.json({ limit: "4kb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
function sendStudentError(res, error) {
    const status = error instanceof pinplay_1.PinPlayAuthError ? error.status : 503;
    const message = error instanceof pinplay_1.PinPlayAuthError ? error.message : "PinPlay sign-in is temporarily unavailable.";
    res.status(status).json({ error: message });
}
app.get("/api/student/config", async (_req, res) => {
    try {
        res.json(await (0, pinplay_1.studentConfig)());
    }
    catch (error) {
        sendStudentError(res, error);
    }
});
app.post("/api/student/login", async (req, res) => {
    var _a;
    try {
        const session = await (0, pinplay_1.studentLogin)((_a = req.body) === null || _a === void 0 ? void 0 : _a.googleIdToken);
        const student = await (0, pinplay_1.resolveStudent)(session.studentToken);
        res.json({ ...session, student });
    }
    catch (error) {
        sendStudentError(res, error);
    }
});
app.get("/api/student/me", async (req, res) => {
    try {
        const student = await (0, pinplay_1.resolveStudent)(req.header("x-student-token"));
        res.setHeader("Cache-Control", "no-store").json({ student });
    }
    catch (error) {
        sendStudentError(res, error);
    }
});
app.use("/api/teacher", (req, res, next) => {
    if (!(0, classroom_1.secretsMatch)(req.header("x-teacher-key"), process.env.TEACHER_KEY || "")) {
        res.status(401).json({ error: "Invalid teacher key." });
        return;
    }
    next();
});
app.get("/api/teacher/status", (_req, res) => res.json(classroom_1.classroom.status()));
app.post("/api/teacher/class", (req, res) => {
    var _a;
    if (typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.open) !== "boolean") {
        res.status(400).json({ error: "Provide an open value." });
        return;
    }
    classroom_1.classroom.setOpen(req.body.open);
    res.json(classroom_1.classroom.status());
});
app.post("/api/teacher/review", (req, res) => {
    var _a, _b;
    if (typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.id) !== "string" || typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.approve) !== "boolean"
        || !classroom_1.classroom.review(req.body.id, req.body.approve)) {
        res.status(400).json({ error: "That message is no longer pending." });
        return;
    }
    res.json(classroom_1.classroom.status());
});
app.post("/api/teacher/mute", (req, res) => {
    var _a, _b;
    if (typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.studentKey) !== "string" || typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.muted) !== "boolean") {
        res.status(400).json({ error: "Provide a student key and muted value." });
        return;
    }
    classroom_1.classroom.setMuted(req.body.studentKey, req.body.muted);
    res.json(classroom_1.classroom.status());
});
const gameServer = new colyseus_1.Server({
    server: (0, http_1.createServer)(app)
});
// Register Lobby Room
gameServer.define("lobby", LobbyRoom_1.LobbyRoom);
// Start server
gameServer.listen(port).then(() => {
    console.log(`🎮 Pixel Plaza Game Server is running on ws://localhost:${port}`);
});
