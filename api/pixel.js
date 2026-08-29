import { createTrackingHandler } from './_lib/handler.js';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export default createTrackingHandler({
  audience: 'pixel',
  eventType: 'email_opened',
  contentType: 'image/png',
  pixel: PIXEL,
});
