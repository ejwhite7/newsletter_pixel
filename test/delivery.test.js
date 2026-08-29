import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverWebhook } from '../api/_lib/delivery.js';
import { TEST_WEBHOOK } from './helpers.js';

const payload = { event_id: 'event-1' };
const silentLogger = { error() {} };

test('does not retry permanent HTTP failures', async () => {
  let attempts = 0;
  const result = await deliverWebhook(TEST_WEBHOOK, payload, {
    fetchImpl: async () => { attempts += 1; return { ok: false, status: 401 }; },
    logger: silentLogger,
    sleep: async () => {},
  });
  assert.equal(attempts, 1);
  assert.deepEqual(result, {
    ok: false, category: 'permanent_http_error', attempts: 1, status: 401,
  });
});

test('retries transient HTTP failures and preserves success', async () => {
  let attempts = 0;
  const idempotencyKeys = [];
  const result = await deliverWebhook(TEST_WEBHOOK, payload, {
    fetchImpl: async (_url, init) => {
      attempts += 1;
      idempotencyKeys.push(init.headers['Idempotency-Key']);
      return attempts === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 };
    },
    logger: silentLogger,
    sleep: async () => {},
  });
  assert.equal(attempts, 2);
  assert.deepEqual(idempotencyKeys, ['event-1', 'event-1']);
  assert.deepEqual(result, { ok: true, attempts: 2, status: 200 });
});

test('times out bounded attempts', async () => {
  let attempts = 0;
  const result = await deliverWebhook(TEST_WEBHOOK, payload, {
    fetchImpl: async (_url, init) => {
      attempts += 1;
      await new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    },
    timeoutMs: 5,
    logger: silentLogger,
    sleep: async () => {},
  });
  assert.equal(attempts, 2);
  assert.equal(result.category, 'timeout');
});
