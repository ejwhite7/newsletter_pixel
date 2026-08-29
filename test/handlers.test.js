import assert from 'node:assert/strict';
import test from 'node:test';
import botHandler from '../api/bot-trap.js';
import pixelHandler from '../api/pixel.js';
import { createTrackingToken } from '../api/_lib/tracking-token.js';
import {
  assertTransparentImageResponse,
  createHarness,
  createRequest,
  createResponse,
  TEST_NOW,
  TEST_SECRET,
} from './helpers.js';

function token(audience, overrides = {}) {
  return createTrackingToken({
    aud: audience,
    email: 'alice+newsletter@example.com',
    subscriber_id: 'subscriber-123',
    post_id: 'campaign-456',
    ...overrides,
  }, TEST_SECRET, { now: TEST_NOW, ttlSeconds: 60 });
}

test('returns the pixel immediately while scheduling valid delivery', async () => {
  let resolveFetch;
  const fetchImpl = async (url, init) => new Promise((resolve) => {
    resolveFetch = () => resolve({ ok: true, status: 200, url, init });
  });
  const harness = createHarness({ fetchImpl });
  const response = createResponse();
  pixelHandler(createRequest({ t: token('pixel') }), response, harness.overrides);

  assertTransparentImageResponse(response, 'image/png');
  assert.equal(harness.scheduled.length, 1);
  assert.equal(typeof resolveFetch, 'function');
  resolveFetch();
  await harness.settle();
});

test('delivers signed pixel payload with corrected classification fields', async () => {
  const harness = createHarness();
  const response = createResponse();
  pixelHandler(createRequest({ t: token('pixel') }, { userAgent: 'Outlook-iOS/723.2.0' }), response, harness.overrides);
  await harness.settle();

  assert.equal(harness.requests.length, 1);
  const { payload } = harness.requests[0];
  assert.equal(payload.email, 'alice+newsletter@example.com');
  assert.equal(payload.tracking_version, 'v1');
  assert.equal(payload.client_family, 'outlook_ios');
  assert.equal(payload.likely_spam_filter, false);
});

test('rejects tampered and wrong-endpoint tokens without delivery', async () => {
  const tokenParts = token('pixel').split('.');
  tokenParts[2] = `${tokenParts[2][0] === 'A' ? 'B' : 'A'}${tokenParts[2].slice(1)}`;
  for (const query of [
    { t: tokenParts.join('.') },
    { t: token('bot') },
    {},
  ]) {
    const harness = createHarness();
    const response = createResponse();
    pixelHandler(createRequest(query), response, harness.overrides);
    assertTransparentImageResponse(response, 'image/png');
    assert.equal(harness.scheduled.length, 0);
  }
});

test('bot endpoint emits an audience-bound bot event', async () => {
  const harness = createHarness();
  const response = createResponse();
  botHandler(createRequest({ t: token('bot') }), response, harness.overrides);
  await harness.settle();
  assertTransparentImageResponse(response, 'image/gif');
  assert.equal(harness.requests[0].payload.event_type, 'bot_trap_triggered');
  assert.equal(harness.requests[0].payload.is_bot, true);
});

test('supports temporary numeric legacy traffic only when explicitly enabled', async () => {
  const query = { email: 'legacy@example.com', subscriber_id: '123', post_id: '456' };
  const disabled = createHarness();
  pixelHandler(createRequest(query), createResponse(), disabled.overrides);
  assert.equal(disabled.scheduled.length, 0);

  const enabled = createHarness({
    overrides: { allowUnsigned: true, unsignedExpiresAt: TEST_NOW + 60 },
  });
  pixelHandler(createRequest(query), createResponse(), enabled.overrides);
  await enabled.settle();
  assert.equal(enabled.requests[0].payload.tracking_version, 'legacy');
});

test('automatically disables unsigned migration without a future cutoff', () => {
  const query = { email: 'legacy@example.com', subscriber_id: '123', post_id: '456' };
  for (const unsignedExpiresAt of [undefined, TEST_NOW, TEST_NOW - 1]) {
    const harness = createHarness({
      overrides: { allowUnsigned: true, unsignedExpiresAt },
    });
    pixelHandler(createRequest(query), createResponse(), harness.overrides);
    assert.equal(harness.scheduled.length, 0);
  }
});

test('suppresses immediate signed-token replays and uses a stable event ID bucket', async () => {
  const trackingToken = token('pixel');
  const first = createHarness({ overrides: { eventId: undefined } });
  pixelHandler(createRequest({ t: trackingToken }), createResponse(), first.overrides);
  await first.settle();
  assert.equal(first.requests.length, 1);

  const replay = createHarness({
    overrides: { eventId: undefined, now: TEST_NOW + 1 },
  });
  for (let index = 0; index < 100; index += 1) {
    pixelHandler(createRequest({ t: trackingToken }), createResponse(), replay.overrides);
  }
  assert.equal(replay.scheduled.length, 0);

  const later = createHarness({
    overrides: { eventId: undefined, now: TEST_NOW + 11 },
  });
  pixelHandler(createRequest({ t: trackingToken }), createResponse(), later.overrides);
  await later.settle();
  assert.equal(later.requests.length, 1);
  assert.equal(later.requests[0].payload.event_id, first.requests[0].payload.event_id);
});

test('bounds repeated invalid-request diagnostics per warm instance', () => {
  const harness = createHarness({
    overrides: { allowUnsigned: true, unsignedExpiresAt: TEST_NOW + 60 },
  });
  const invalidQuery = {
    email: 'invalid@example.com',
    subscriber_id: '{{subscriber_id}}',
    post_id: 'post',
  };
  for (let index = 0; index < 100; index += 1) {
    pixelHandler(createRequest(invalidQuery), createResponse(), harness.overrides);
  }
  assert.equal(harness.scheduled.length, 0);
  assert.equal(harness.logs.filter((entry) => entry.message === 'Tracking event rejected').length, 1);
});

test('allows GET only and does not schedule delivery for invalid configuration', () => {
  const methodHarness = createHarness();
  const methodResponse = createResponse();
  pixelHandler(createRequest({}, { method: 'POST' }), methodResponse, methodHarness.overrides);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.getHeader('allow'), 'GET');

  const configHarness = createHarness({ overrides: { webhookUrl: 'not-a-url' } });
  pixelHandler(createRequest({ t: token('pixel') }), createResponse(), configHarness.overrides);
  assert.equal(configHarness.scheduled.length, 0);
  assert.equal(configHarness.logs[0].message, 'Tracking delivery disabled: invalid POSTHOG_WEBHOOK_URL');

  const secretHarness = createHarness({ overrides: { secret: 'short' } });
  pixelHandler(createRequest({ t: token('pixel') }), createResponse(), secretHarness.overrides);
  assert.equal(secretHarness.scheduled.length, 0);
  assert.equal(secretHarness.logs[0].message, 'Tracking delivery disabled: invalid TRACKING_TOKEN_SECRET');
});
