import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const TOKEN_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const MIN_SECRET_BYTES = 32;

export class TrackingTokenError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TrackingTokenError';
    this.code = code;
  }
}

export function validateTrackingSecret(secret) {
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= MIN_SECRET_BYTES;
}

function keyFromSecret(secret) {
  if (!validateTrackingSecret(secret)) {
    throw new TrackingTokenError('invalid_secret');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function createTrackingToken(payload, secret, options = {}) {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 24 * 90;
  const iv = options.iv ?? randomBytes(IV_LENGTH);
  const completePayload = {
    v: 1,
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + ttlSeconds,
  };

  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secret), iv);
  cipher.setAAD(Buffer.from(TOKEN_VERSION));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(completePayload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

function decryptWithSecret(parts, secret) {
  const [, ivValue, ciphertextValue, tagValue] = parts;
  const iv = Buffer.from(ivValue, 'base64url');
  const ciphertext = Buffer.from(ciphertextValue, 'base64url');
  const tag = Buffer.from(tagValue, 'base64url');
  if (iv.length !== IV_LENGTH || tag.length !== 16 || ciphertext.length === 0) {
    throw new TrackingTokenError('malformed_token');
  }

  const decipher = createDecipheriv(ALGORITHM, keyFromSecret(secret), iv);
  decipher.setAAD(Buffer.from(TOKEN_VERSION));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

export function verifyTrackingToken(token, options) {
  if (typeof token !== 'string' || token.length > 4096) {
    throw new TrackingTokenError('malformed_token');
  }
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    throw new TrackingTokenError('unsupported_token');
  }

  const secrets = [options.secret, options.previousSecret]
    .filter(validateTrackingSecret);
  if (secrets.length === 0) {
    throw new TrackingTokenError('invalid_secret');
  }

  let payload;
  for (const secret of secrets) {
    try {
      payload = decryptWithSecret(parts, secret);
      break;
    } catch {
      // Try the previous rotation secret without exposing which key failed.
    }
  }
  if (!payload) throw new TrackingTokenError('invalid_token');

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (payload.v !== 1 || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    throw new TrackingTokenError('invalid_payload');
  }
  if (payload.exp <= now) throw new TrackingTokenError('expired_token');
  if (payload.iat > now + 300 || payload.exp <= payload.iat) {
    throw new TrackingTokenError('invalid_time_range');
  }
  if (payload.aud !== options.audience) {
    throw new TrackingTokenError('wrong_audience');
  }
  return payload;
}
