import { verifyTrackingToken } from './tracking-token.js';

const MERGE_TAG_PATTERN = /{{|}}|\*\||\|\*|<%|%>/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

export function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= 320
    && !CONTROL_PATTERN.test(email)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !MERGE_TAG_PATTERN.test(email);
}

export function isValidIdentifier(value) {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 128
    && !CONTROL_PATTERN.test(value)
    && !MERGE_TAG_PATTERN.test(value);
}

function isSingleString(value) {
  return typeof value === 'string';
}

function validateFields(data) {
  if (!isValidEmail(data.email)) return { ok: false, code: 'invalid_email' };
  if (!isValidIdentifier(data.subscriber_id)) return { ok: false, code: 'invalid_subscriber_id' };
  if (!isValidIdentifier(data.post_id)) return { ok: false, code: 'invalid_post_id' };
  return { ok: true, data };
}

export function resolveRequestData(query, audience, options) {
  const token = query?.t;
  if (isSingleString(token)) {
    try {
      const payload = verifyTrackingToken(token, {
        secret: options.secret,
        previousSecret: options.previousSecret,
        audience,
        now: options.now,
      });
      const validation = validateFields({
        email: payload.email,
        subscriber_id: payload.subscriber_id,
        post_id: payload.post_id,
      });
      return validation.ok
        ? { ...validation, tracking_version: 'v1' }
        : validation;
    } catch (error) {
      return { ok: false, code: error.code ?? 'invalid_token' };
    }
  }
  if (token !== undefined) return { ok: false, code: 'invalid_token' };

  if (!options.allowUnsigned) return { ok: false, code: 'unsigned_tracking_disabled' };
  const { email, subscriber_id, post_id } = query ?? {};
  if (![email, subscriber_id, post_id].every(isSingleString)) {
    return { ok: false, code: 'invalid_legacy_parameters' };
  }
  const validation = validateFields({ email, subscriber_id, post_id });
  return validation.ok
    ? { ...validation, tracking_version: 'legacy' }
    : validation;
}
