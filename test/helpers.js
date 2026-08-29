import assert from 'node:assert/strict';

export const TEST_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';
export const TEST_WEBHOOK = 'https://example.test/webhook';
export const TEST_NOW = 1_800_000_000;

export function createRequest(query = {}, options = {}) {
  return {
    method: options.method ?? 'GET',
    query,
    headers: {
      'user-agent': options.userAgent
        ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Safari/537.36',
      'x-forwarded-for': options.ip ?? '203.0.113.10',
      ...options.headers,
    },
    connection: {},
  };
}

export function createResponse() {
  const headers = new Map();
  return {
    statusCode: null,
    body: null,
    ended: false,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
  };
}

export function createHarness(options = {}) {
  const scheduled = [];
  const requests = [];
  const logs = [];
  const fetchImpl = options.fetchImpl ?? (async (url, init) => {
    requests.push({ url, init, payload: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  });
  return {
    scheduled,
    requests,
    logs,
    overrides: {
      secret: TEST_SECRET,
      webhookUrl: TEST_WEBHOOK,
      now: TEST_NOW,
      eventId: '00000000-0000-4000-8000-000000000001',
      fetchImpl,
      waitUntil(promise) {
        scheduled.push(promise);
      },
      logger: {
        warn(message, details) { logs.push({ level: 'warn', message, details }); },
        error(message, details) { logs.push({ level: 'error', message, details }); },
      },
      retryDelayMs: 0,
      sleep: async () => {},
      ...options.overrides,
    },
    async settle() {
      await Promise.all(scheduled);
    },
  };
}

export function assertTransparentImageResponse(response, contentType) {
  assert.equal(response.statusCode, 200);
  assert.equal(response.ended, true);
  assert.ok(Buffer.isBuffer(response.body));
  assert.equal(response.getHeader('content-type'), contentType);
  assert.equal(response.getHeader('content-length'), response.body.length);
  assert.match(response.getHeader('cache-control'), /no-store/);
}
