import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { verifyTrackingToken } from '../api/_lib/tracking-token.js';
import { TEST_SECRET } from './helpers.js';

test('batch CLI creates audience-bound provider tokens without exposing plaintext', () => {
  const record = {
    email: 'batch+test@example.com',
    subscriber_id: '123',
    post_id: 'campaign-456',
  };
  const result = spawnSync(process.execPath, ['scripts/create-tracking-token-batch.js', '1'], {
    cwd: process.cwd(),
    env: { ...process.env, TRACKING_TOKEN_SECRET: TEST_SECRET },
    input: `${JSON.stringify(record)}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.tracking_token.includes(record.email), false);
  assert.equal(output.bot_tracking_token.includes(record.email), false);
  assert.equal(verifyTrackingToken(output.tracking_token, {
    secret: TEST_SECRET,
    audience: 'pixel',
  }).subscriber_id, '123');
  assert.equal(verifyTrackingToken(output.bot_tracking_token, {
    secret: TEST_SECRET,
    audience: 'bot',
  }).post_id, 'campaign-456');
});

test('batch CLI fails closed on an invalid record without echoing PII', () => {
  const email = 'private@example.com';
  const result = spawnSync(process.execPath, ['scripts/create-tracking-token-batch.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TRACKING_TOKEN_SECRET: TEST_SECRET },
    input: [
      JSON.stringify({ email: 'valid@example.com', subscriber_id: 'valid-id', post_id: 'post' }),
      JSON.stringify({ email, subscriber_id: '{{id}}', post_id: 'post' }),
    ].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /line 2/);
  assert.equal(result.stderr.includes(email), false);
  assert.equal(result.stdout, '');
});

test('single-token CLI rejects invalid fields without emitting a token', () => {
  const result = spawnSync(process.execPath, [
    'scripts/create-tracking-token.js',
    'pixel',
    'invalid email@example.com',
    '{{subscriber_id}}',
    'post',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, TRACKING_TOKEN_SECRET: TEST_SECRET },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('invalid email@example.com'), false);
});

test('batch CLI reports a null record without a stack trace or partial output', () => {
  const result = spawnSync(process.execPath, ['scripts/create-tracking-token-batch.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TRACKING_TOKEN_SECRET: TEST_SECRET },
    input: `${JSON.stringify({
      email: 'valid@example.com', subscriber_id: 'valid', post_id: 'post',
    })}\nnull\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /line 2/);
  assert.equal(result.stderr.includes('TypeError'), false);
});
