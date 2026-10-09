const test = require('node:test');
const assert = require('node:assert/strict');
const { studentConfig, studentLogin, resolveStudent, PinPlayAuthError } = require('../build/pinplay.js');

test('PinPlay config, login, and identity use the existing API contract', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/api/student/config')) return Response.json({ loginEnabled: true, googleClientId: 'client-id', allowedDomains: [] });
    if (url.endsWith('/api/student/login')) return Response.json({ studentToken: 'signed-token', expiresAt: Date.now() + 100000 });
    if (url.endsWith('/api/student/me')) return Response.json({ student: { studentKey: 'stu_123', displayName: 'Alex', className: '4B', email: 'private@example.com' } });
    throw new Error('unexpected endpoint');
  };
  try {
    assert.equal((await studentConfig()).googleClientId, 'client-id');
    assert.equal((await studentLogin('google-credential')).studentToken, 'signed-token');
    assert.deepEqual(await resolveStudent('signed-token'), { studentKey: 'stu_123', displayName: 'Alex', className: '4B' });
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[2].init.headers['X-Student-Token'], 'signed-token');
  } finally { global.fetch = originalFetch; }
});

test('missing student tokens are rejected before reaching PinPlay', async () => {
  await assert.rejects(resolveStudent(''), error => error instanceof PinPlayAuthError && error.status === 401);
});
