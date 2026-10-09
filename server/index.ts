import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { createServer } from "http";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { classroom, secretsMatch } from "./classroom";
import { PinPlayAuthError, resolveStudent, studentConfig, studentLogin } from "./pinplay";

if (!/^\d{4,8}$/.test(process.env.CLASS_PIN || "") || (process.env.TEACHER_KEY || "").length < 16) {
    throw new Error("Set CLASS_PIN (4–8 digits) and TEACHER_KEY (at least 16 characters) before starting the server.");
}

const port = Number(process.env.PORT || 2567);
const app = express();

const allowedOrigins = process.env.APP_ORIGIN
    ? [process.env.APP_ORIGIN]
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "16kb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

function sendStudentError(res: express.Response, error: unknown): void {
    const status = error instanceof PinPlayAuthError ? error.status : 503;
    const message = error instanceof PinPlayAuthError ? error.message : "PinPlay sign-in is temporarily unavailable.";
    res.status(status).json({ error: message });
}

app.get("/api/student/config", async (_req, res) => {
    try { res.json(await studentConfig()); }
    catch (error) { sendStudentError(res, error); }
});
app.post("/api/student/login", async (req, res) => {
    try {
        const session = await studentLogin(req.body?.googleIdToken);
        const student = await resolveStudent(session.studentToken);
        res.json({ ...session, student });
    } catch (error) { sendStudentError(res, error); }
});
app.get("/api/student/me", async (req, res) => {
    try {
        const student = await resolveStudent(req.header("x-student-token"));
        res.setHeader("Cache-Control", "no-store").json({ student });
    } catch (error) { sendStudentError(res, error); }
});

app.use("/api/teacher", (req, res, next) => {
    if (!secretsMatch(req.header("x-teacher-key"), process.env.TEACHER_KEY || "")) {
        res.status(401).json({ error: "Invalid teacher key." });
        return;
    }
    next();
});
app.get("/api/teacher/status", (_req, res) => res.json(classroom.status()));
app.post("/api/teacher/class", (req, res) => {
    if (typeof req.body?.open !== "boolean") {
        res.status(400).json({ error: "Provide an open value." });
        return;
    }
    classroom.setOpen(req.body.open);
    res.json(classroom.status());
});
app.post("/api/teacher/review", (req, res) => {
    if (typeof req.body?.id !== "string" || typeof req.body?.approve !== "boolean"
        || !classroom.review(req.body.id, req.body.approve)) {
        res.status(400).json({ error: "That message is no longer pending." });
        return;
    }
    res.json(classroom.status());
});
app.post("/api/teacher/mute", (req, res) => {
    if (typeof req.body?.studentKey !== "string" || typeof req.body?.muted !== "boolean") {
        res.status(400).json({ error: "Provide a student key and muted value." });
        return;
    }
    classroom.setMuted(req.body.studentKey, req.body.muted);
    res.json(classroom.status());
});

const gameServer = new Server({
  server: createServer(app)
});

// Register Lobby Room
gameServer.define("lobby", LobbyRoom);

// Start server
gameServer.listen(port).then(() => {
    console.log(`🎮 Pixel Plaza Game Server is running on ws://localhost:${port}`);
});
