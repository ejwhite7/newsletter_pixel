import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRequestData } from '../api/_lib/request-data.js';
import { createTrackingToken } from '../api/_lib/tracking-token.js';
import { TEST_NOW, TEST_SECRET } from './helpers.js';

test('accepts provider-compatible opaque IDs and plus-addresses', () => {
  for (const values of [
    ['beehiiv@example.com', '123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    ['mailchimp+news@example.com', 'ABC123.def', 'CAMPAIGN_UID-42'],
    ['convertkit@example.com', '123', '456'],
  ]) {
    const token = createTrackingToken({
      aud: 'pixel',
      email: values[0],
      subscriber_id: values[1],
      post_id: values[2],
    }, TEST_SECRET, { now: TEST_NOW });
    const result = resolveRequestData({ t: token }, 'pixel', {
      secret: TEST_SECRET,
      now: TEST_NOW,
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.email, values[0]);
  }
});

test('rejects placeholders, duplicate values, and unsigned requests by default', () => {
  assert.equal(resolveRequestData({
    email: 'person@example.com', subscriber_id: '123', post_id: '456',
  }, 'pixel', { secret: TEST_SECRET }).code, 'unsigned_tracking_disabled');
  assert.equal(resolveRequestData({
    email: 'person@example.com', subscriber_id: ['123', '456'], post_id: '789',
  }, 'pixel', { secret: TEST_SECRET, allowUnsigned: true }).code, 'invalid_legacy_parameters');
  assert.equal(resolveRequestData({
    email: 'person@example.com', subscriber_id: '{{subscriber_id}}', post_id: '789',
  }, 'pixel', { secret: TEST_SECRET, allowUnsigned: true }).code, 'invalid_subscriber_id');
});

test('supports explicitly enabled legacy migration mode with numeric IDs', () => {
  const result = resolveRequestData({
    email: 'person+legacy@example.com', subscriber_id: '123', post_id: '456',
  }, 'pixel', { secret: TEST_SECRET, allowUnsigned: true });
  assert.equal(result.ok, true);
  assert.equal(result.tracking_version, 'legacy');
});
