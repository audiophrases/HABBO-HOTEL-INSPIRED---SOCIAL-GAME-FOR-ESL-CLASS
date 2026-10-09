import test from 'node:test';
import assert from 'node:assert/strict';
import { PinPlayAuthError, resolveStudent, studentConfig, studentLogin } from '../pinplay.ts';

function fakePinPlay(calls) {
    return async request => {
        calls.push(request);
        const path = new URL(request.url).pathname;
        if (path === '/api/student/config') return Response.json({ loginEnabled: true, googleClientId: 'client-id', allowedDomains: [] });
        if (path === '/api/student/login') return Response.json({ studentToken: 'signed-token', expiresAt: Date.now() + 100000 });
        if (path === '/api/student/me') return Response.json({ student: { studentKey: 'stu_123', displayName: 'Alex', className: '4B', email: 'private@example.com' } });
        return Response.json({}, { status: 404 });
    };
}

test('the service binding carries the existing PinPlay contract', async () => {
    const calls = [];
    const env = { PINPLAY_AUTH: { fetch: fakePinPlay(calls) } };
    assert.equal((await studentConfig(env)).googleClientId, 'client-id');
    assert.equal((await studentLogin(env, 'google-credential')).studentToken, 'signed-token');
    assert.deepEqual(await resolveStudent(env, 'signed-token'), { studentKey: 'stu_123', displayName: 'Alex', className: '4B' });
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[2].headers.get('X-Student-Token'), 'signed-token');
});

test('PINPLAY_API_URL replaces the binding, and only over HTTPS or locally', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => fakePinPlay(calls)(new Request(url, init));
    try {
        await studentConfig({ PINPLAY_API_URL: 'http://127.0.0.1:9999/' });
        assert.equal(calls[0].url, 'http://127.0.0.1:9999/api/student/config');
        await assert.rejects(studentConfig({ PINPLAY_API_URL: 'http://example.com' }), error => error.status === 503);
    } finally { globalThis.fetch = originalFetch; }
});

test('missing tokens never reach PinPlay, and PinPlay refusals keep their status', async () => {
    const calls = [];
    await assert.rejects(resolveStudent({ PINPLAY_AUTH: { fetch: fakePinPlay(calls) } }, ''),
        error => error instanceof PinPlayAuthError && error.status === 401);
    assert.equal(calls.length, 0);
    const refusing = { PINPLAY_AUTH: { fetch: async () => Response.json({ error: 'Please sign in again.' }, { status: 401 }) } };
    await assert.rejects(resolveStudent(refusing, 'old-token'), error => error.status === 401 && /sign in again/.test(error.message));
    const down = { PINPLAY_AUTH: { fetch: async () => { throw new Error('offline'); } } };
    await assert.rejects(resolveStudent(down, 'token'), error => error.status === 503);
});
