// 1x1 transparent PNG (base64)
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Security: Use environment variable for webhook URL
const POSTHOG_WEBHOOK = process.env.POSTHOG_WEBHOOK_URL;

// Known email security scanners and image proxy User-Agent patterns
const KNOWN_PROXY_PATTERNS = [
  'GoogleImageProxy',
  'YahooMailProxy',
  'YahooCacheSystem',
  'Outlook-iOS',
  'Outlook-Android',
  'Microsoft Office',
  'ms-office',
  'Barracuda',
  'Mimecast',
  'Proofpoint',
  'FireEye',
  'ZScaler',
  'Symantec',
  'MessageLabs',
  'Cisco IronPort',
  'Sophos',
  'Trend Micro',
  'FortiGuard',
  'Websense',
  'SpamAssassin',
];

// Check if the request has prefetch/preview headers
function isPrefetch(headers) {
  const purpose = headers['purpose'] || headers['x-purpose'] || headers['sec-purpose'] || '';
  const mozPrefetch = headers['x-moz'] || '';
  return /prefetch|preview/i.test(purpose) || /prefetch/i.test(mozPrefetch);
}

// Check if the User-Agent matches a known email proxy or security scanner
function matchKnownProxy(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const ua = userAgent.toLowerCase();
  for (const pattern of KNOWN_PROXY_PATTERNS) {
    if (ua.includes(pattern.toLowerCase())) return pattern;
  }
  return null;
}

// Heuristic: flag suspiciously short or generic User-Agents
function isUserAgentSuspicious(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return true;
  // Very short UAs are unusual for real email clients
  if (userAgent.length < 20) return true;
  // Generic single-token UAs like "Mozilla/5.0" with no platform detail
  if (/^Mozilla\/[\d.]+$/.test(userAgent.trim())) return true;
  // Missing typical browser/platform tokens
  const hasOSToken = /Windows|Macintosh|Linux|Android|iPhone|iPad/i.test(userAgent);
  const hasClientToken = /AppleWebKit|Gecko|Chrome|Safari|Outlook|Thunderbird/i.test(userAgent);
  if (!hasOSToken && !hasClientToken) return true;
  return false;
}

// Input sanitization - strip potentially dangerous characters and limit length
function sanitizeInput(input, maxLength = 255) {
  if (!input || typeof input !== 'string') return 'unknown';
  return input
    .slice(0, maxLength)
    .replace(/[<>'"\\]/g, '') // Remove XSS-prone characters
    .trim() || 'unknown';
}

// Validate email format loosely (basic check)
function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

// Validate UUID format (Beehiiv uses UUIDs for subscriber_id and post_id)
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function handler(req, res) {
  // Only allow GET requests (standard for tracking pixels)
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const { email, subscriber_id, post_id } = req.query;

  // Return pixel immediately (don't make email client wait)
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', PIXEL.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.status(200).end(PIXEL);

  // Skip webhook if not configured
  if (!POSTHOG_WEBHOOK) {
    console.warn('POSTHOG_WEBHOOK_URL environment variable not set');
    return;
  }

  // Validate required fields - skip webhook if invalid (e.g., unprocessed merge tags)
  if (!isValidEmailFormat(email)) {
    console.warn('Invalid email format, skipping webhook:', email);
    return;
  }
  if (!isValidUUID(subscriber_id)) {
    console.warn('Invalid subscriber_id format, skipping webhook:', subscriber_id);
    return;
  }
  if (!isValidUUID(post_id)) {
    console.warn('Invalid post_id format, skipping webhook:', post_id);
    return;
  }

  // Sanitize inputs before sending to webhook
  const sanitizedEmail = sanitizeInput(email, 320);
  const sanitizedSubscriberId = sanitizeInput(subscriber_id, 100);
  const sanitizedPostId = sanitizeInput(post_id, 100);

  // Get IP safely - take first IP if multiple are forwarded
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = forwardedFor 
    ? sanitizeInput(forwardedFor.split(',')[0], 45)
    : sanitizeInput(req.connection?.remoteAddress, 45);

  // Detect spam filter / email security scanner signals
  const userAgent = sanitizeInput(req.headers['user-agent'], 500);
  const prefetch = isPrefetch(req.headers);
  const proxyMatch = matchKnownProxy(req.headers['user-agent']);
  const suspiciousUA = isUserAgentSuspicious(req.headers['user-agent']);
  const likelySpamFilter = prefetch || !!proxyMatch || suspiciousUA;

  // Send to PostHog in background (don't await to avoid blocking response)
  fetch(POSTHOG_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'email_opened',
      email: sanitizedEmail,
      subscriber_id: sanitizedSubscriberId,
      post_id: sanitizedPostId,
      timestamp: new Date().toISOString(),
      user_agent: userAgent,
      ip_address: ipAddress,
      // Spam filter detection signals
      is_prefetch: prefetch,
      known_proxy: proxyMatch,
      suspicious_user_agent: suspiciousUA,
      likely_spam_filter: likelySpamFilter,
    })
  }).catch(error => {
    console.error('PostHog webhook error:', error.message);
  });
}