// The whole flow against a real `wrangler dev`, with a fake PinPlay. The local
// Durable Object storage is kept between two runs to prove progress survives a
// restart (which is what a deploy is).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sha256Hex } from '../rules.ts';

const root = path.join(import.meta.dirname, '..', '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PIN = '654321';
const PASSWORD = 'local test password';
const students = { 'signed-a': { studentKey: 'stu_a', displayName: 'Alex', className: '4B' },
    'signed-b': { studentKey: 'stu_b', displayName: 'Sam', className: '4B' } };

async function freePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    await new Promise(resolve => server.close(resolve));
    return port;
}

function startPinPlay() {
    const server = http.createServer((req, res) => {
        res.setHeader('content-type', 'application/json');
        const student = students[req.headers['x-student-token']];
        if (req.url === '/api/student/me' && student) return res.end(JSON.stringify({ student }));
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Please sign in again.' }));
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function startPlaza(pinPlayUrl, persistTo) {
    const port = await freePort();
    const child = spawn(process.execPath, [wrangler, 'dev', '--port', String(port), '--inspector-port', '0',
        '--persist-to', persistTo, '--show-interactive-dev-session=false',
        '--var', `CLASS_PIN:${PIN}`, '--var', `CREATE_PASSWORD_HASH:${await sha256Hex(PASSWORD)}`,
        '--var', `PINPLAY_API_URL:${pinPlayUrl}`], {
        cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    child.stdout.on('data', chunk => { log += chunk; });
    child.stderr.on('data', chunk => { log += chunk; });
    const base = `http://127.0.0.1:${port}`;
    const stop = () => new Promise(resolve => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', resolve);
        // wrangler runs workerd as a child process; take the whole tree down.
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else child.kill('SIGTERM');
    });
    for (let attempt = 0; attempt < 120; attempt++) {
        try { if ((await fetch(`${base}/api/health`)).ok) return { base, stop }; } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    await stop();
    throw new Error(`wrangler dev did not start:\n${log}`);
}

async function api(base, route, { token, session, body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers['x-student-token'] = token;
    if (session) headers['x-teacher-session'] = session;
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
}

function openSocket(base, ticket) {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/api/plaza/ws?ticket=${ticket}`);
    const inbox = [];
    const waiters = [];
    const deliver = () => {
        for (const waiter of [...waiters]) {
            const index = inbox.findIndex(waiter.match);
            if (index < 0) continue;
            waiters.splice(waiters.indexOf(waiter), 1);
            clearTimeout(waiter.timer);
            waiter.resolve(inbox.splice(index, 1)[0]);
        }
    };
    ws.onmessage = event => { if (event.data !== 'pong') { inbox.push(JSON.parse(event.data)); deliver(); } };
    const closed = new Promise(resolve => { ws.onclose = event => resolve(event.code); });
    return {
        ws, closed, inbox,
        send: message => ws.send(JSON.stringify(message)),
        next: (match, what = 'a message') => new Promise((resolve, reject) => {
            const waiter = { match, resolve, timer: setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), 5000) };
            waiters.push(waiter);
            deliver();
        })
    };
}

async function enter(base, token, avatar) {
    const joined = await api(base, '/api/plaza/join', { token, body: { pin: PIN, avatar } });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    const socket = openSocket(base, joined.body.ticket);
    const welcome = await socket.next(message => message.t === 'welcome', 'welcome');
    return { ...socket, welcome, me: welcome.players.find(player => player.id === welcome.id) };
}

test('a lesson in the plaza, then a restart that keeps everyone\'s progress', { timeout: 120000 }, async () => {
    const pinPlay = await startPinPlay();
    const persistTo = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-plaza-test-'));
    const pinPlayUrl = `http://127.0.0.1:${pinPlay.address().port}`;
    let plaza = await startPlaza(pinPlayUrl, persistTo);
    const sockets = [];
    try {
        let { base } = plaza;

        // Teacher signs in with the PinPlay password and opens the class.
        assert.equal((await api(base, '/api/teacher/login', { body: { password: 'nope' } })).status, 401);
        const { body: { token: session } } = await api(base, '/api/teacher/login', { body: { password: PASSWORD } });
        assert.equal((await api(base, '/api/teacher/status', { session: 'forged' })).status, 401);
        const closedJoin = await api(base, '/api/plaza/join', { token: 'signed-a', body: { pin: PIN } });
        assert.equal(closedJoin.status, 403);
        assert.match(closedJoin.body.error, /not opened/);
        assert.equal((await api(base, '/api/teacher/class', { session, body: { open: true } })).body.open, true);

        // The PIN and the PinPlay identity both gate the door.
        assert.equal((await api(base, '/api/plaza/join', { token: 'signed-a', body: { pin: '000000' } })).status, 403);
        assert.equal((await api(base, '/api/plaza/join', { token: 'fake', body: { pin: PIN } })).status, 401);
        assert.equal((await api(base, '/api/plaza/join', { token: 'signed-a', body: { pin: PIN, avatar: { hair: 99 } } })).status, 400);

        // Alex arrives with new looks and walks somewhere.
        const alex = await enter(base, 'signed-a', { skin: 2, hair: 3 });
        sockets.push(alex);
        assert.equal(alex.me.name, 'Alex');
        assert.equal(alex.me.hair, 3);
        alex.send({ t: 'move', x: 900, y: 800 });
        await new Promise(resolve => setTimeout(resolve, 300));

        // Sam sees Alex where Alex is, and Alex sees Sam arrive.
        const sam = await enter(base, 'signed-b', null);
        sockets.push(sam);
        const alexSeenBySam = sam.welcome.players.find(player => player.name === 'Alex');
        assert.deepEqual([alexSeenBySam.x, alexSeenBySam.y, alexSeenBySam.hair], [900, 800, 3]);
        assert.equal((await alex.next(message => message.t === 'join', 'join')).player.name, 'Sam');
        await alex.next(message => message.t === 'chat' && /Sam has joined/.test(message.text), 'join announcement');
        const moved = sam.next(message => message.t === 'move', 'move');
        alex.send({ t: 'move', x: 910, y: 805 });
        assert.deepEqual([(await moved).x, (await moved).y], [910, 805]);

        // Chat waits for the teacher.
        alex.send({ t: 'chat', text: 'Hello class!' });
        assert.match((await alex.next(message => message.t === 'notice', 'pending notice')).text, /approval/);
        let status = (await api(base, '/api/teacher/status', { session })).body;
        assert.deepEqual(status.online.map(student => student.name).sort(), ['Alex', 'Sam']);
        assert.equal(status.entries[0].status, 'pending');
        assert.equal(status.entries[0].studentKey, 'stu_a');
        assert.equal(sam.inbox.some(message => message.t === 'chat' && message.text === 'Hello class!'), false);
        await api(base, '/api/teacher/review', { session, body: { id: status.entries[0].id, approve: true } });
        assert.equal((await sam.next(message => message.t === 'chat' && message.sender === 'Alex', 'approved chat')).text, 'Hello class!');
        assert.match((await alex.next(message => message.t === 'notice', 'decision')).text, /approved/);

        const emote = sam.next(message => message.t === 'emote', 'emote');
        alex.send({ t: 'emote', emote: '👍' });
        assert.deepEqual([(await emote).id, (await emote).emote], [alex.welcome.id, '👍']);

        // A second window takes over Alex's avatar, quietly and in the same spot.
        const alexAgain = await enter(base, 'signed-a', null);
        sockets.push(alexAgain);
        assert.equal(await alex.closed, 4009);
        assert.deepEqual([alexAgain.me.x, alexAgain.me.y], [910, 805]);
        assert.equal((await sam.next(message => message.t === 'leave', 'leave')).id, alex.welcome.id);
        assert.equal((await sam.next(message => message.t === 'join', 'rejoin')).player.id, alexAgain.welcome.id);

        // A mute follows the student, not the connection.
        await api(base, '/api/teacher/mute', { session, body: { studentKey: 'stu_a', muted: true } });
        alexAgain.send({ t: 'chat', text: 'Can you hear me?' });
        assert.match((await alexAgain.next(message => message.t === 'notice', 'muted notice')).text, /unavailable/);

        alexAgain.ws.close();
        await sam.next(message => message.t === 'chat' && /Alex left/.test(message.text), 'leave announcement');
        assert.equal(sam.inbox.filter(message => message.t === 'chat' && /Alex left/.test(message.text)).length, 0);
        sam.ws.close();
        await sam.closed;
        await new Promise(resolve => setTimeout(resolve, 300));

        // Restart: everything that matters is still there.
        await plaza.stop();
        plaza = await startPlaza(pinPlayUrl, persistTo);
        base = plaza.base;
        assert.deepEqual((await api(base, '/api/student/me', { token: 'signed-a' })).body.avatar,
            { skin: 2, hairColor: 0, hair: 3, eyes: 0, mouth: 0, glasses: 0, shirt: 0, hat: 0 });
        assert.equal((await api(base, '/api/student/me', { token: 'signed-b' })).body.avatar, null);
        status = (await api(base, '/api/teacher/status', { session })).body;
        assert.equal(status.open, true);
        assert.deepEqual(status.muted, ['stu_a']);
        assert.equal(status.entries.find(entry => entry.text === 'Hello class!').status, 'approved');

        const alexNextLesson = await enter(base, 'signed-a', null);
        sockets.push(alexNextLesson);
        assert.deepEqual([alexNextLesson.me.x, alexNextLesson.me.y, alexNextLesson.me.hair], [910, 805, 3]);

        // Closing the class keeps new students out.
        await api(base, '/api/teacher/class', { session, body: { open: false } });
        assert.equal((await api(base, '/api/plaza/join', { token: 'signed-b', body: { pin: PIN } })).status, 403);
    } finally {
        for (const socket of sockets) socket.ws.close();
        await plaza.stop();
        await new Promise(resolve => pinPlay.close(resolve));
        fs.rmSync(persistTo, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});
