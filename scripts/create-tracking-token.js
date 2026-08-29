import { createTrackingToken, validateTrackingSecret } from '../api/_lib/tracking-token.js';
import { isValidEmail, isValidIdentifier } from '../api/_lib/request-data.js';

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: npm run token -- <pixel|bot> <email> <subscriber_id> <post_id> [ttl_days]');
  process.exitCode = 1;
}

const [, , audience, email, subscriberId, postId, ttlDaysValue = '90'] = process.argv;
const secret = process.env.TRACKING_TOKEN_SECRET;
const ttlDays = Number(ttlDaysValue);

if (!['pixel', 'bot'].includes(audience) || !email || !subscriberId || !postId) {
  usage('Missing or invalid token fields.');
} else if (!isValidEmail(email)
  || !isValidIdentifier(subscriberId)
  || !isValidIdentifier(postId)) {
  usage('Email or identifier fields are invalid.');
} else if (!validateTrackingSecret(secret)) {
  usage('TRACKING_TOKEN_SECRET must contain at least 32 bytes.');
} else if (!Number.isFinite(ttlDays) || ttlDays <= 0 || ttlDays > 365) {
  usage('ttl_days must be greater than 0 and no more than 365.');
} else {
  const ttlSeconds = Math.floor(ttlDays * 86400);
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) {
    usage('ttl_days resolves to an invalid lifetime.');
  } else {
    const token = createTrackingToken({
      aud: audience,
      email,
      subscriber_id: subscriberId,
      post_id: postId,
    }, secret, { ttlSeconds });
    process.stdout.write(`${token}\n`);
  }
}
