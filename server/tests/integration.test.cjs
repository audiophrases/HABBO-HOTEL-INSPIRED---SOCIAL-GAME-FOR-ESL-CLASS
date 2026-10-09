const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Client } = require('../../node_modules/colyseus.js');

async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Game server did not start.');
}

test('class PIN and PinPlay identity gate the room, and mutes survive reconnects', { timeout: 15000 }, async () => {
  const pinPlay = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/student/config') return res.end(JSON.stringify({ loginEnabled: true, googleClientId: 'test-client', allowedDomains: [] }));
    if (req.url === '/api/student/login') return res.end(JSON.stringify({ studentToken: 'signed-test', expiresAt: Date.now() + 60000 }));
    if (req.url === '/api/student/me') {
      res.statusCode = req.headers['x-student-token'] === 'signed-test' ? 200 : 401;
      return res.end(JSON.stringify(res.statusCode === 200
        ? { student: { studentKey: 'stu_1', displayName: 'Alex', className: '4B' } }
        : { error: 'Please sign in again.' }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise(resolve => pinPlay.listen(0, '127.0.0.1', resolve));
  const gamePort = await freePort();
  const game = spawn(process.execPath, ['build/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(gamePort), CLASS_PIN: '654321',
      TEACHER_KEY: 'local-test-key-123456789', PINPLAY_API_URL: `http://127.0.0.1:${pinPlay.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const api = `http://127.0.0.1:${gamePort}`;
  const teacherHeaders = { 'x-teacher-key': 'local-test-key-123456789', 'content-type': 'application/json' };
  const client = new Client(`ws://127.0.0.1:${gamePort}`);
  let firstRoom;
  let secondRoom;
  try {
    await waitForServer(`${api}/api/health`);
    const config = await (await fetch(`${api}/api/student/config`)).json();
    assert.equal(config.googleClientId, 'test-client');
    const signedIn = await (await fetch(`${api}/api/student/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ googleIdToken: 'google-test' }) })).json();
    assert.equal(signedIn.student.studentKey, 'stu_1');
    await fetch(`${api}/api/teacher/class`, { method: 'POST', headers: teacherHeaders, body: JSON.stringify({ open: true }) });

    await assert.rejects(client.joinOrCreate('lobby', { pin: 'wrong', studentToken: 'signed-test' }));
    await assert.rejects(client.joinOrCreate('lobby', { pin: '654321', studentToken: 'fake' }));
    firstRoom = await client.joinOrCreate('lobby', { pin: '654321', studentToken: 'signed-test', username: 'Impostor' });
    for (let attempt = 0; attempt < 30 && !firstRoom.state.players.get(firstRoom.sessionId); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(firstRoom.state.players.get(firstRoom.sessionId).username, 'Alex');
    firstRoom.send('chat', { text: 'Hello class!' });
    await new Promise(resolve => setTimeout(resolve, 100));
    const status = await (await fetch(`${api}/api/teacher/status`, { headers: teacherHeaders })).json();
    assert.equal(status.entries[0].studentKey, 'stu_1');
    assert.equal(status.entries[0].status, 'pending');

    await fetch(`${api}/api/teacher/mute`, { method: 'POST', headers: teacherHeaders, body: JSON.stringify({ studentKey: 'stu_1', muted: true }) });
    await firstRoom.leave();
    firstRoom = undefined;
    secondRoom = await client.joinOrCreate('lobby', { pin: '654321', studentToken: 'signed-test' });
    const warning = new Promise(resolve => secondRoom.onMessage('chat_warning', resolve));
    secondRoom.send('chat', { text: 'Can you hear me?' });
    assert.match((await warning).message, /unavailable/);
  } finally {
    await firstRoom?.leave();
    await secondRoom?.leave();
    game.kill();
    await new Promise(resolve => pinPlay.close(resolve));
  }
});
