const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 200;

export function isValidWebhookUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname));
  } catch {
    return false;
  }
}

function isTransientStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverWebhook(url, payload, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const logger = options.logger ?? console;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep = options.sleep ?? delay;

  if (!isValidWebhookUrl(url)) {
    logger.error('Webhook delivery skipped', {
      event_id: payload.event_id,
      category: 'invalid_webhook_configuration',
    });
    return { ok: false, category: 'invalid_webhook_configuration', attempts: 0 };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payload.event_id,
        },
        body: JSON.stringify(payload),
      }, timeoutMs);

      if (response.ok) return { ok: true, attempts: attempt, status: response.status };

      const transient = isTransientStatus(response.status);
      logger.error('Webhook delivery failed', {
        event_id: payload.event_id,
        category: transient ? 'transient_http_error' : 'permanent_http_error',
        status: response.status,
        attempt,
      });
      if (!transient || attempt === maxAttempts) {
        return {
          ok: false,
          category: transient ? 'transient_http_error' : 'permanent_http_error',
          attempts: attempt,
          status: response.status,
        };
      }
    } catch (error) {
      const category = error?.name === 'AbortError' ? 'timeout' : 'network_error';
      logger.error('Webhook delivery failed', {
        event_id: payload.event_id,
        category,
        attempt,
      });
      if (attempt === maxAttempts) {
        return { ok: false, category, attempts: attempt };
      }
    }
    await sleep(retryDelayMs * attempt);
  }

  return { ok: false, category: 'unknown', attempts: maxAttempts };
}
