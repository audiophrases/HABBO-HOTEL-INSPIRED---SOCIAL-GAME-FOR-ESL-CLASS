const test = require('node:test');
const assert = require('node:assert/strict');
const { Classroom, chatProblem, secretsMatch, validUsername } = require('../build/classroom.js');

test('chat validation blocks invalid content and caps length', () => {
  assert.match(chatProblem('nobody likes you'), /rewrite/);
  assert.match(chatProblem('shit'), /rewrite/);
  assert.match(chatProblem('x'.repeat(201)), /1–200/);
  assert.equal(chatProblem('Hello class!'), null);
  assert.equal(validUsername('Alex'), true);
  assert.equal(validUsername('shit'), false);
});

test('teacher approval gates publication and closing the class rejects pending messages', () => {
  const room = new Classroom();
  const published = [];
  const decisions = [];
  room.setOpen(true);
  const first = room.submit('student-1', 'Alex', 'Hello!', () => published.push('Hello!'), value => decisions.push(value));
  assert.equal(first.status, 'pending');
  assert.deepEqual(published, []);
  assert.equal(room.review(first.id, true), true);
  assert.deepEqual(published, ['Hello!']);
  assert.deepEqual(decisions, [true]);
  assert.equal(room.review(first.id, true), false);

  const second = room.submit('student-1', 'Alex', 'How are you?', () => published.push('How are you?'), value => decisions.push(value));
  room.setOpen(false);
  assert.equal(second.status, 'rejected');
  assert.equal(room.review(second.id, true), false);
  assert.deepEqual(published, ['Hello!']);
  assert.deepEqual(decisions, [true, false]);
});

test('teacher and class secrets must match exactly', () => {
  assert.equal(secretsMatch('123456', '123456'), true);
  assert.equal(secretsMatch('1234567', '123456'), false);
  assert.equal(secretsMatch(undefined, '123456'), false);
});

test('a mute follows the stable student key across connections', () => {
  const room = new Classroom();
  room.setMuted('student_key_1', true);
  assert.equal(room.isMuted('student_key_1'), true);
  assert.equal(room.isMuted('student_key_2'), false);
  room.setMuted('student_key_1', false);
  assert.equal(room.isMuted('student_key_1'), false);
});
