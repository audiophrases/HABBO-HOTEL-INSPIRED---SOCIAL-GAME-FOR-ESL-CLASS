export type PinPlayStudent = {
    studentKey: string;
    displayName: string;
    className: string;
};

type PinPlayConfig = { loginEnabled: boolean; googleClientId: string; allowedDomains: string[] };
type PinPlayLogin = { studentToken: string; expiresAt: number };

export class PinPlayAuthError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

function baseUrl(): string {
    const url = new URL(process.env.PINPLAY_API_URL || "https://api.pinplay.win");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
        throw new Error("PINPLAY_API_URL must use HTTPS, except for a local test server.");
    }
    return url.toString().replace(/\/$/, "");
}

async function pinPlayRequest(path: string, init: RequestInit = {}): Promise<any> {
    let response: Response;
    try {
        response = await fetch(baseUrl() + path, { ...init, signal: AbortSignal.timeout(6000) });
    } catch {
        throw new PinPlayAuthError("PinPlay sign-in is temporarily unavailable.", 503);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof data?.error === "string" ? data.error : "PinPlay sign-in failed.";
        throw new PinPlayAuthError(message, response.status);
    }
    return data;
}

export async function studentConfig(): Promise<PinPlayConfig> {
    const data = await pinPlayRequest("/api/student/config");
    return {
        loginEnabled: data?.loginEnabled === true && typeof data?.googleClientId === "string" && !!data.googleClientId,
        googleClientId: typeof data?.googleClientId === "string" ? data.googleClientId : "",
        allowedDomains: Array.isArray(data?.allowedDomains) ? data.allowedDomains.filter((item: unknown) => typeof item === "string") : []
    };
}

export async function studentLogin(googleIdToken: unknown): Promise<PinPlayLogin> {
    if (typeof googleIdToken !== "string" || !googleIdToken || googleIdToken.length > 8192) {
        throw new PinPlayAuthError("A Google sign-in credential is required.", 400);
    }
    const data = await pinPlayRequest("/api/student/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ googleIdToken })
    });
    if (typeof data?.studentToken !== "string" || !Number.isFinite(data?.expiresAt)) {
        throw new PinPlayAuthError("PinPlay returned an invalid student session.", 502);
    }
    return { studentToken: data.studentToken, expiresAt: data.expiresAt };
}

export async function resolveStudent(studentToken: unknown): Promise<PinPlayStudent> {
    if (typeof studentToken !== "string" || !studentToken || studentToken.length > 2048) {
        throw new PinPlayAuthError("Please sign in with Google.", 401);
    }
    const data = await pinPlayRequest("/api/student/me", {
        headers: { "X-Student-Token": studentToken }
    });
    const student = data?.student;
    if (typeof student?.studentKey !== "string" || !student.studentKey || student.studentKey.length > 128
        || typeof student?.displayName !== "string") {
        throw new PinPlayAuthError("PinPlay returned an invalid student identity.", 502);
    }
    return {
        studentKey: student.studentKey,
        displayName: student.displayName.trim().slice(0, 48),
        className: typeof student.className === "string" ? student.className.trim().slice(0, 48) : ""
    };
}
