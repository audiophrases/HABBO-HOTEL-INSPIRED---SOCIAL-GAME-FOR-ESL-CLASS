import { randomUUID, timingSafeEqual } from "crypto";

export type ReviewStatus = "pending" | "approved" | "rejected" | "blocked";
export type ChatEntry = {
    id: string;
    studentKey: string;
    sender: string;
    text: string;
    timestamp: number;
    status: ReviewStatus;
};

const blockedWords = new Set(["fuck", "shit", "bitch", "cunt", "nigger", "faggot"]);
const blockedPhrases = [/\bnobody likes you\b/i, /\bkill yourself\b/i, /\byou are stupid\b/i];

export function chatProblem(value: unknown): string | null {
    if (typeof value !== "string") return "Enter a text message.";
    const text = value.trim();
    if (!text || text.length > 200) return "Messages must be 1–200 characters.";
    if (Array.from(text).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
        return "Control characters are not allowed.";
    }
    const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
    if (words.some(word => blockedWords.has(word)) || blockedPhrases.some(pattern => pattern.test(text))) {
        return "That message cannot be sent. Please rewrite it.";
    }
    return null;
}

export function validUsername(value: unknown): value is string {
    return typeof value === "string" && /^[\p{L}\p{N} _-]{2,24}$/u.test(value.trim())
        && chatProblem(value) === null;
}

export function secretsMatch(actual: unknown, expected: string): boolean {
    if (typeof actual !== "string") return false;
    const supplied = Buffer.from(actual);
    const configured = Buffer.from(expected);
    return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

export class Classroom {
    open = false;
    private entries: ChatEntry[] = [];
    private pending = new Map<string, { publish: () => void; notify: (approved: boolean) => void }>();
    private muted = new Set<string>();

    submit(studentKey: string, sender: string, text: string, publish: () => void,
        notify: (approved: boolean) => void): ChatEntry {
        const problem = chatProblem(text);
        const entry: ChatEntry = {
            id: randomUUID(), studentKey, sender, text: text.trim(), timestamp: Date.now(),
            status: problem ? "blocked" : "pending"
        };
        this.entries.push(entry);
        if (this.entries.length > 500) {
            const removed = this.entries.shift();
            if (removed) this.pending.delete(removed.id);
        }
        if (!problem) this.pending.set(entry.id, { publish, notify });
        return entry;
    }

    review(id: string, approve: boolean): boolean {
        const entry = this.entries.find(item => item.id === id);
        const callbacks = this.pending.get(id);
        if (!entry || !callbacks || entry.status !== "pending") return false;
        this.pending.delete(id);
        entry.status = approve && this.open ? "approved" : "rejected";
        if (entry.status === "approved") callbacks.publish();
        callbacks.notify(entry.status === "approved");
        return true;
    }

    setOpen(open: boolean): void {
        this.open = open;
        if (!open) {
            for (const entry of this.entries) if (entry.status === "pending") {
                entry.status = "rejected";
                const pending = this.pending.get(entry.id);
                if (pending) pending.notify(false);
            }
            this.pending.clear();
        }
    }

    isMuted(studentKey: string): boolean { return this.muted.has(studentKey); }
    setMuted(studentKey: string, muted: boolean): void {
        if (muted) this.muted.add(studentKey);
        else this.muted.delete(studentKey);
    }
    status() {
        return { open: this.open, entries: this.entries.slice().reverse(), muted: [...this.muted] };
    }
}

export const classroom = new Classroom();
