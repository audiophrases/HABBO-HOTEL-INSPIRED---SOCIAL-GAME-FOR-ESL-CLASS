"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroom = exports.Classroom = void 0;
exports.chatProblem = chatProblem;
exports.validUsername = validUsername;
exports.secretsMatch = secretsMatch;
const crypto_1 = require("crypto");
const blockedWords = new Set(["fuck", "shit", "bitch", "cunt", "nigger", "faggot"]);
const blockedPhrases = [/\bnobody likes you\b/i, /\bkill yourself\b/i, /\byou are stupid\b/i];
function chatProblem(value) {
    if (typeof value !== "string")
        return "Enter a text message.";
    const text = value.trim();
    if (!text || text.length > 200)
        return "Messages must be 1–200 characters.";
    if (Array.from(text).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
        return "Control characters are not allowed.";
    }
    const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
    if (words.some(word => blockedWords.has(word)) || blockedPhrases.some(pattern => pattern.test(text))) {
        return "That message cannot be sent. Please rewrite it.";
    }
    return null;
}
function validUsername(value) {
    return typeof value === "string" && /^[\p{L}\p{N} _-]{2,24}$/u.test(value.trim())
        && chatProblem(value) === null;
}
function secretsMatch(actual, expected) {
    if (typeof actual !== "string")
        return false;
    const supplied = Buffer.from(actual);
    const configured = Buffer.from(expected);
    return supplied.length === configured.length && (0, crypto_1.timingSafeEqual)(supplied, configured);
}
class Classroom {
    constructor() {
        this.open = false;
        this.entries = [];
        this.pending = new Map();
        this.muted = new Set();
    }
    submit(studentKey, sender, text, publish, notify) {
        const problem = chatProblem(text);
        const entry = {
            id: (0, crypto_1.randomUUID)(), studentKey, sender, text: text.trim(), timestamp: Date.now(),
            status: problem ? "blocked" : "pending"
        };
        this.entries.push(entry);
        if (this.entries.length > 500) {
            const removed = this.entries.shift();
            if (removed)
                this.pending.delete(removed.id);
        }
        if (!problem)
            this.pending.set(entry.id, { publish, notify });
        return entry;
    }
    review(id, approve) {
        const entry = this.entries.find(item => item.id === id);
        const callbacks = this.pending.get(id);
        if (!entry || !callbacks || entry.status !== "pending")
            return false;
        this.pending.delete(id);
        entry.status = approve && this.open ? "approved" : "rejected";
        if (entry.status === "approved")
            callbacks.publish();
        callbacks.notify(entry.status === "approved");
        return true;
    }
    setOpen(open) {
        this.open = open;
        if (!open) {
            for (const entry of this.entries)
                if (entry.status === "pending") {
                    entry.status = "rejected";
                    const pending = this.pending.get(entry.id);
                    if (pending)
                        pending.notify(false);
                }
            this.pending.clear();
        }
    }
    isMuted(studentKey) { return this.muted.has(studentKey); }
    setMuted(studentKey, muted) {
        if (muted)
            this.muted.add(studentKey);
        else
            this.muted.delete(studentKey);
    }
    status() {
        return { open: this.open, entries: this.entries.slice().reverse(), muted: [...this.muted] };
    }
}
exports.Classroom = Classroom;
exports.classroom = new Classroom();
