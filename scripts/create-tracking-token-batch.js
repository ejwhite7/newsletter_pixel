import { once } from 'node:events';
import {
  createReadStream,
  createWriteStream,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import readline from 'node:readline';
import { isValidEmail, isValidIdentifier } from '../api/_lib/request-data.js';
import { createTrackingToken, validateTrackingSecret } from '../api/_lib/tracking-token.js';

const secret = process.env.TRACKING_TOKEN_SECRET;
const ttlDays = Number(process.argv[2] ?? '90');
const ttlSeconds = Math.floor(ttlDays * 86400);

if (!validateTrackingSecret(secret)) {
  console.error('TRACKING_TOKEN_SECRET must contain at least 32 bytes.');
  process.exit(1);
}
if (!Number.isFinite(ttlDays)
  || ttlDays <= 0
  || ttlDays > 365
  || !Number.isSafeInteger(ttlSeconds)
  || ttlSeconds < 1) {
  console.error('Usage: npm run token:batch -- [ttl_days] < recipients.ndjson > tokens.ndjson');
  process.exit(1);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'newsletter-pixel-tokens-'));
const temporaryOutput = join(temporaryDirectory, 'tokens.ndjson');
const output = createWriteStream(temporaryOutput, { mode: 0o600 });
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let lineNumber = 0;
let valid = true;

try {
  for await (const line of input) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      console.error(`Invalid JSON on line ${lineNumber}.`);
      valid = false;
      break;
    }
    if (!record
      || typeof record !== 'object'
      || Array.isArray(record)
      || !isValidEmail(record.email)
      || !isValidIdentifier(record.subscriber_id)
      || !isValidIdentifier(record.post_id)) {
      console.error(`Invalid tracking fields on line ${lineNumber}.`);
      valid = false;
      break;
    }

    const common = {
      email: record.email,
      subscriber_id: record.subscriber_id,
      post_id: record.post_id,
    };
    const tokenOptions = { ttlSeconds };
    const tokenizedRecord = {
      ...record,
      tracking_token: createTrackingToken({ aud: 'pixel', ...common }, secret, tokenOptions),
      bot_tracking_token: createTrackingToken({ aud: 'bot', ...common }, secret, tokenOptions),
    };
    if (!output.write(`${JSON.stringify(tokenizedRecord)}\n`)) await once(output, 'drain');
  }

  output.end();
  await once(output, 'finish');
  if (valid) {
    await pipeline(createReadStream(temporaryOutput), process.stdout);
  } else {
    process.exitCode = 1;
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
