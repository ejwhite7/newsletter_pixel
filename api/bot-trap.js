import { createTrackingHandler } from './_lib/handler.js';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export default createTrackingHandler({
  audience: 'bot',
  eventType: 'bot_trap_triggered',
  contentType: 'image/gif',
  pixel: PIXEL,
});
