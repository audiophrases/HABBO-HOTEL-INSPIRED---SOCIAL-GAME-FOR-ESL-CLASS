import { PlazaRoom, type TeacherAction } from './plaza.ts';
import { PinPlayAuthError, resolveStudent, studentConfig, studentLogin } from './pinplay.ts';
import { sanitizeAvatar, secretsMatch, teacherPasswordMatches } from './rules.ts';

export { PlazaRoom };

export interface Env {
    PLAZA: DurableObjectNamespace<PlazaRoom>;
    PINPLAY_AUTH?: Fetcher;
    // Local development and tests only; production uses PINPLAY_AUTH.
    PINPLAY_API_URL?: string;
    CLASS_PIN?: string;
    // Same value as PinPlay's, so the teacher has one password.
    CREATE_PASSWORD_HASH?: string;
    AUTH_RL?: RateLimit;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// One plaza for the class: every student's saved progress lives in it.
const plaza = (env: Env) => env.PLAZA.getByName('plaza');

async function spend(env: Env, key: string, slots: number): Promise<boolean> {
    if (!env.AUTH_RL) return true;
    try {
        const results = await Promise.all(Array.from({ length: slots }, () => env.AUTH_RL!.limit({ key })));
        return results.every(result => result.success);
    } catch {
        return true; // a limiter outage must not lock the class out
    }
}

// Every check costs one slot of the 50-a-minute budget and a wrong guess four
// more, so guessing tops out at about 10 tries a minute. The teacher's polling
// uses a session token instead and never spends any.
async function guarded(env: Env, key: string, check: () => boolean | Promise<boolean>): Promise<'ok' | 'wrong' | 'limited'> {
    if (!(await spend(env, key, 1))) return 'limited';
    if (await check()) return 'ok';
    await spend(env, key, 4);
    return 'wrong';
}

function teacherAction(path: string, method: string, body: any): TeacherAction | null {
    if (path === '/api/teacher/status' && method === 'GET') return { kind: 'status' };
    if (method !== 'POST') return null;
    if (path === '/api/teacher/class' && typeof body?.open === 'boolean') return { kind: 'open', open: body.open };
    if (path === '/api/teacher/review' && typeof body?.id === 'string' && typeof body?.approve === 'boolean') {
        return { kind: 'review', id: body.id, approve: body.approve };
    }
    if (path === '/api/teacher/mute' && typeof body?.studentKey === 'string' && typeof body?.muted === 'boolean') {
        return { kind: 'mute', studentKey: body.studentKey, muted: body.muted };
    }
    return null;
}

async function handle(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const get = request.method === 'GET';
    const post = request.method === 'POST';
    const body: any = post ? await request.json().catch(() => ({})) : {};

    if (path === '/api/health') return json({ ok: true });

    if (path === '/api/student/config' && get) return json(await studentConfig(env));
    if (path === '/api/student/login' && post) {
        const session = await studentLogin(env, body?.googleIdToken);
        const student = await resolveStudent(env, session.studentToken);
        return json({ ...session, student, avatar: await plaza(env).savedAvatar(student.studentKey) });
    }
    if (path === '/api/student/me' && get) {
        const student = await resolveStudent(env, request.headers.get('x-student-token'));
        return json({ student, avatar: await plaza(env).savedAvatar(student.studentKey) });
    }

    if (path === '/api/plaza/join' && post) {
        if (!env.CLASS_PIN) return json({ error: 'The class PIN has not been set up.' }, 503);
        const student = await resolveStudent(env, request.headers.get('x-student-token'));
        const pin = await guarded(env, `pin:${student.studentKey}`, () => secretsMatch(body?.pin, env.CLASS_PIN || ''));
        if (pin === 'limited') return json({ error: 'Too many tries. Wait a minute, then try again.' }, 429);
        if (pin === 'wrong') return json({ error: 'Check the class PIN.' }, 403);
        const avatar = body?.avatar == null ? null : sanitizeAvatar(body.avatar);
        if (body?.avatar != null && !avatar) return json({ error: 'That avatar is not available.' }, 400);
        const result = await plaza(env).issueTicket(student, avatar);
        return 'error' in result ? json({ error: result.error }, 403) : json(result);
    }
    if (path === '/api/plaza/ws') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket.' }, 426);
        return plaza(env).fetch(request);
    }

    if (path === '/api/teacher/login' && post) {
        if (!env.CREATE_PASSWORD_HASH) return json({ error: 'The teacher password has not been set up.' }, 503);
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        const result = await guarded(env, `teacher:${ip}`, () => teacherPasswordMatches(body?.password, env.CREATE_PASSWORD_HASH));
        if (result === 'limited') return json({ error: 'Too many tries. Wait a minute, then try again.' }, 429);
        if (result === 'wrong') return json({ error: 'Wrong password.' }, 401);
        return json({ token: await plaza(env).startTeacherSession() });
    }
    if (path.startsWith('/api/teacher/')) {
        const action = teacherAction(path, request.method, body);
        if (!action) return json({ error: 'That request is not valid.' }, 400);
        const result = await plaza(env).teacher(request.headers.get('x-teacher-session') || '', action);
        return 'error' in result ? json({ error: result.error }, result.status) : json(result);
    }

    return json({ error: 'Not found.' }, 404);
}

// Only /api/* reaches the Worker; the built app is served as static assets.
export default {
    async fetch(request, env): Promise<Response> {
        try {
            return await handle(request, env);
        } catch (error) {
            if (error instanceof PinPlayAuthError) return json({ error: error.message }, error.status);
            console.error(error);
            return json({ error: 'Something went wrong. Please try again.' }, 500);
        }
    }
} satisfies ExportedHandler<Env>;
