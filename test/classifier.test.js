import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRequest } from '../api/_lib/classifier.js';

test('classifies Outlook as a client instead of a spam filter', () => {
  const result = classifyRequest({ 'user-agent': 'Outlook-iOS/723.2.0' });
  assert.equal(result.client_family, 'outlook_ios');
  assert.equal(result.likely_spam_filter, false);
  assert.equal(result.suspicious_user_agent, false);
});

test('classifies Gmail proxying separately from automation', () => {
  const result = classifyRequest({ 'user-agent': 'GoogleImageProxy' });
  assert.equal(result.is_image_proxy, true);
  assert.equal(result.image_proxy, 'GoogleImageProxy');
  assert.equal(result.likely_spam_filter, false);
});

test('retains explicit scanner and prefetch evidence', () => {
  const scanner = classifyRequest({ 'user-agent': 'Proofpoint URL Defense' });
  assert.equal(scanner.scanner_vendor, 'Proofpoint');
  assert.equal(scanner.automation_confidence, 'high');
  assert.equal(scanner.likely_spam_filter, true);

  const prefetch = classifyRequest({
    'user-agent': 'Mozilla/5.0 (Linux) AppleWebKit/537.36',
    purpose: 'prefetch',
  });
  assert.equal(prefetch.is_prefetch, true);
  assert.equal(prefetch.automation_confidence, 'high');
});
