import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTrackingToken,
  verifyTrackingToken,
} from '../api/_lib/tracking-token.js';
import { TEST_NOW, TEST_SECRET } from './helpers.js';

const payload = {
  aud: 'pixel',
  email: 'alice+newsletter@example.com',
  subscriber_id: 'mailchimp-A1.B2',
  post_id: '456',
};

test('round trips an opaque authenticated token', () => {
  const token = createTrackingToken(payload, TEST_SECRET, { now: TEST_NOW, ttlSeconds: 60 });
  assert.equal(token.includes('alice'), false);
  assert.deepEqual(
    verifyTrackingToken(token, { secret: TEST_SECRET, audience: 'pixel', now: TEST_NOW }),
    { v: 1, ...payload, iat: TEST_NOW, exp: TEST_NOW + 60 },
  );
});

test('rejects tampered, expired, and wrong-audience tokens', () => {
  const token = createTrackingToken(payload, TEST_SECRET, { now: TEST_NOW, ttlSeconds: 60 });
  const parts = token.split('.');
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  const tampered = parts.join('.');
  assert.throws(() => verifyTrackingToken(tampered, {
    secret: TEST_SECRET,
    audience: 'pixel',
    now: TEST_NOW,
  }), /invalid_token/);
  assert.throws(() => verifyTrackingToken(token, {
    secret: TEST_SECRET,
    audience: 'pixel',
    now: TEST_NOW + 61,
  }), /expired_token/);
  assert.throws(() => verifyTrackingToken(token, {
    secret: TEST_SECRET,
    audience: 'bot',
    now: TEST_NOW,
  }), /wrong_audience/);
});

test('accepts a previous secret during rotation', () => {
  const previousSecret = `${TEST_SECRET}-previous`;
  const token = createTrackingToken(payload, previousSecret, { now: TEST_NOW });
  const verified = verifyTrackingToken(token, {
    secret: TEST_SECRET,
    previousSecret,
    audience: 'pixel',
    now: TEST_NOW,
  });
  assert.equal(verified.email, payload.email);
});
