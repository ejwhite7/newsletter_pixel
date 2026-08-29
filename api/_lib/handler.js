import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { classifyRequest } from './classifier.js';
import { deliverWebhook, isValidWebhookUrl } from './delivery.js';
import { resolveRequestData } from './request-data.js';
import { validateTrackingSecret } from './tracking-token.js';

const loggedRejectionCategories = new Set();
const recentSignedEvents = new Map();
const REPLAY_SUPPRESSION_SECONDS = 10;
const EVENT_ID_BUCKET_SECONDS = 300;
const MAX_RECENT_SIGNED_EVENTS = 10_000;

function boundedHeader(value, maxLength) {
  if (typeof value !== 'string') return 'unknown';
  return value.slice(0, maxLength).replace(/[\u0000-\u001f\u007f]/g, '').trim() || 'unknown';
}

function requestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const candidate = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.connection?.remoteAddress;
  return isIP(candidate) ? candidate : 'unknown';
}

function booleanEnvironment(value) {
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

function logRejectionOnce(logger, category) {
  if (loggedRejectionCategories.has(category)) return;
  loggedRejectionCategories.add(category);
  logger.warn('Tracking event rejected', { category });
}

function parseExpiry(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}

function unsignedMigrationEnabled(environment, overrides, now, logger) {
  const requested = overrides.allowUnsigned
    ?? booleanEnvironment(environment.ALLOW_UNSIGNED_TRACKING);
  if (!requested) return false;
  const expiresAt = parseExpiry(
    overrides.unsignedExpiresAt ?? environment.UNSIGNED_TRACKING_EXPIRES_AT,
  );
  if (!expiresAt || expiresAt <= now) {
    logRejectionOnce(logger, 'unsigned_migration_expired_or_unconfigured');
    return false;
  }
  return true;
}

function signedEventIdentity(token, audience, now) {
  const tokenHash = createHash('sha256').update(token).digest('base64url');
  const bucket = Math.floor(now / EVENT_ID_BUCKET_SECONDS);
  return {
    eventId: `${audience}:${tokenHash}:${bucket}`,
    replayKey: `${audience}:${tokenHash}`,
  };
}

function shouldSuppressReplay(replayKey, now) {
  const previous = recentSignedEvents.get(replayKey);
  if (previous !== undefined && now - previous < REPLAY_SUPPRESSION_SECONDS) return true;
  recentSignedEvents.set(replayKey, now);
  if (recentSignedEvents.size > MAX_RECENT_SIGNED_EVENTS) {
    const oldestKey = recentSignedEvents.keys().next().value;
    recentSignedEvents.delete(oldestKey);
  }
  return false;
}

export function createTrackingHandler(config) {
  return function handler(req, res, overrides = {}) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).end();
      return;
    }

    res.setHeader('Content-Type', config.contentType);
    res.setHeader('Content-Length', config.pixel.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.status(200).end(config.pixel);

    const environment = overrides.environment ?? process.env;
    const logger = overrides.logger ?? console;
    const webhookUrl = overrides.webhookUrl ?? environment.POSTHOG_WEBHOOK_URL;
    if (!isValidWebhookUrl(webhookUrl)) {
      logger.warn('Tracking delivery disabled: invalid POSTHOG_WEBHOOK_URL');
      return;
    }

    const secret = overrides.secret ?? environment.TRACKING_TOKEN_SECRET;
    if (!validateTrackingSecret(secret)) {
      logger.warn('Tracking delivery disabled: invalid TRACKING_TOKEN_SECRET');
      return;
    }

    const now = overrides.now ?? Math.floor(Date.now() / 1000);
    const resolved = resolveRequestData(req.query, config.audience, {
      secret,
      previousSecret: overrides.previousSecret ?? environment.TRACKING_TOKEN_SECRET_PREVIOUS,
      allowUnsigned: unsignedMigrationEnabled(environment, overrides, now, logger),
      now,
    });
    if (!resolved.ok) {
      logRejectionOnce(logger, resolved.code);
      return;
    }

    let eventId = overrides.eventId;
    if (!eventId && resolved.tracking_version === 'v1') {
      const identity = signedEventIdentity(req.query.t, config.audience, now);
      if (shouldSuppressReplay(identity.replayKey, now)) return;
      eventId = identity.eventId;
    }
    eventId ??= randomUUID();
    const userAgent = boundedHeader(req.headers?.['user-agent'], 500);
    const payload = {
      event_id: eventId,
      event_type: config.eventType,
      email: resolved.data.email,
      subscriber_id: resolved.data.subscriber_id,
      post_id: resolved.data.post_id,
      timestamp: new Date(now * 1000).toISOString(),
      user_agent: userAgent,
      ip_address: requestIp(req),
      tracking_version: resolved.tracking_version,
    };

    if (config.audience === 'pixel') {
      Object.assign(payload, classifyRequest(req.headers));
    } else {
      Object.assign(payload, {
        is_bot: true,
        bot_session_ip: payload.ip_address,
        bot_session_ua: userAgent,
      });
    }

    const deliveryPromise = deliverWebhook(webhookUrl, payload, {
      fetchImpl: overrides.fetchImpl,
      logger,
      timeoutMs: overrides.timeoutMs,
      maxAttempts: overrides.maxAttempts,
      retryDelayMs: overrides.retryDelayMs,
      sleep: overrides.sleep,
    });
    const schedule = overrides.waitUntil ?? vercelWaitUntil;
    schedule(deliveryPromise);
  };
}
