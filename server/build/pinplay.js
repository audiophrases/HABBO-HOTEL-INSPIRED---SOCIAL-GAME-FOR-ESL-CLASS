"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinPlayAuthError = void 0;
exports.studentConfig = studentConfig;
exports.studentLogin = studentLogin;
exports.resolveStudent = resolveStudent;
class PinPlayAuthError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
exports.PinPlayAuthError = PinPlayAuthError;
function baseUrl() {
    const url = new URL(process.env.PINPLAY_API_URL || "https://api.pinplay.win");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
        throw new Error("PINPLAY_API_URL must use HTTPS, except for a local test server.");
    }
    return url.toString().replace(/\/$/, "");
}
async function pinPlayRequest(path, init = {}) {
    let response;
    try {
        response = await fetch(baseUrl() + path, { ...init, signal: AbortSignal.timeout(6000) });
    }
    catch {
        throw new PinPlayAuthError("PinPlay sign-in is temporarily unavailable.", 503);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof (data === null || data === void 0 ? void 0 : data.error) === "string" ? data.error : "PinPlay sign-in failed.";
        throw new PinPlayAuthError(message, response.status);
    }
    return data;
}
async function studentConfig() {
    const data = await pinPlayRequest("/api/student/config");
    return {
        loginEnabled: (data === null || data === void 0 ? void 0 : data.loginEnabled) === true && typeof (data === null || data === void 0 ? void 0 : data.googleClientId) === "string" && !!data.googleClientId,
        googleClientId: typeof (data === null || data === void 0 ? void 0 : data.googleClientId) === "string" ? data.googleClientId : "",
        allowedDomains: Array.isArray(data === null || data === void 0 ? void 0 : data.allowedDomains) ? data.allowedDomains.filter((item) => typeof item === "string") : []
    };
}
async function studentLogin(googleIdToken) {
    if (typeof googleIdToken !== "string" || !googleIdToken || googleIdToken.length > 8192) {
        throw new PinPlayAuthError("A Google sign-in credential is required.", 400);
    }
    const data = await pinPlayRequest("/api/student/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ googleIdToken })
    });
    if (typeof (data === null || data === void 0 ? void 0 : data.studentToken) !== "string" || !Number.isFinite(data === null || data === void 0 ? void 0 : data.expiresAt)) {
        throw new PinPlayAuthError("PinPlay returned an invalid student session.", 502);
    }
    return { studentToken: data.studentToken, expiresAt: data.expiresAt };
}
async function resolveStudent(studentToken) {
    if (typeof studentToken !== "string" || !studentToken || studentToken.length > 2048) {
        throw new PinPlayAuthError("Please sign in with Google.", 401);
    }
    const data = await pinPlayRequest("/api/student/me", {
        headers: { "X-Student-Token": studentToken }
    });
    const student = data === null || data === void 0 ? void 0 : data.student;
    if (typeof (student === null || student === void 0 ? void 0 : student.studentKey) !== "string" || !student.studentKey || student.studentKey.length > 128
        || typeof (student === null || student === void 0 ? void 0 : student.displayName) !== "string") {
        throw new PinPlayAuthError("PinPlay returned an invalid student identity.", 502);
    }
    return {
        studentKey: student.studentKey,
        displayName: student.displayName.trim().slice(0, 48),
        className: typeof student.className === "string" ? student.className.trim().slice(0, 48) : ""
    };
}
