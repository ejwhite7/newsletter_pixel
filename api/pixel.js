// 1x1 transparent PNG (base64)
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const POSTHOG_WEBHOOK = 'https://webhooks.us.posthog.com/public/webhooks/019aa352-82c1-0000-da2a-5ff0c17cc497';

export default async function handler(req, res) {
  const { email, subscriber_id, post_id } = req.query;

  // Return pixel immediately (don't make email client wait)
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', PIXEL.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).end(PIXEL);

  // Send to PostHog in background (don't await to avoid blocking response)
  fetch(POSTHOG_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email || 'unknown',
      subscriber_id: subscriber_id || 'unknown',
      post_id: post_id || 'unknown',
      timestamp: new Date().toISOString(),
      user_agent: req.headers['user-agent'] || 'unknown',
      ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
    })
  }).catch(error => {
    console.error('PostHog webhook error:', error);
  });
}