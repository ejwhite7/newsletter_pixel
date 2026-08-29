const SCANNER_PATTERNS = [
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

const IMAGE_PROXY_PATTERNS = [
  'GoogleImageProxy',
  'YahooMailProxy',
  'YahooCacheSystem',
];

const CLIENT_PATTERNS = [
  ['Outlook-iOS', 'outlook_ios'],
  ['Outlook-Android', 'outlook_android'],
  ['Microsoft Office', 'outlook_desktop'],
  ['Thunderbird', 'thunderbird'],
  ['AppleWebKit', 'webkit'],
];

function matchPattern(userAgent, patterns) {
  if (typeof userAgent !== 'string') return null;
  const normalized = userAgent.toLowerCase();
  return patterns.find((pattern) => normalized.includes(pattern.toLowerCase())) ?? null;
}

function clientFamily(userAgent) {
  if (typeof userAgent !== 'string') return null;
  const normalized = userAgent.toLowerCase();
  return CLIENT_PATTERNS.find(([pattern]) => normalized.includes(pattern.toLowerCase()))?.[1] ?? null;
}

function isPrefetch(headers) {
  const purpose = headers?.purpose || headers?.['x-purpose'] || headers?.['sec-purpose'] || '';
  const mozPrefetch = headers?.['x-moz'] || '';
  return typeof purpose === 'string'
    && typeof mozPrefetch === 'string'
    && (/prefetch|preview/i.test(purpose) || /prefetch/i.test(mozPrefetch));
}

function suspiciousUserAgent(userAgent, knownClient, imageProxy, scanner) {
  if (knownClient || imageProxy || scanner) return false;
  if (typeof userAgent !== 'string' || userAgent.length < 20) return true;
  if (/^Mozilla\/[\d.]+$/.test(userAgent.trim())) return true;
  const hasPlatform = /Windows|Macintosh|Linux|Android|iPhone|iPad/i.test(userAgent);
  const hasClient = /AppleWebKit|Gecko|Chrome|Safari|Outlook|Thunderbird/i.test(userAgent);
  return !hasPlatform && !hasClient;
}

export function classifyRequest(headers = {}) {
  const userAgent = headers['user-agent'];
  const scannerVendor = matchPattern(userAgent, SCANNER_PATTERNS);
  const imageProxy = matchPattern(userAgent, IMAGE_PROXY_PATTERNS);
  const family = clientFamily(userAgent);
  const prefetch = isPrefetch(headers);
  const suspicious = suspiciousUserAgent(userAgent, family, imageProxy, scannerVendor);
  const automationConfidence = scannerVendor || prefetch
    ? 'high'
    : suspicious
      ? 'low'
      : 'none';

  return {
    client_family: family,
    is_image_proxy: Boolean(imageProxy),
    image_proxy: imageProxy,
    is_prefetch: prefetch,
    scanner_vendor: scannerVendor,
    suspicious_user_agent: suspicious,
    automation_confidence: automationConfidence,
    // Compatibility fields. These now exclude ordinary mail clients and image proxies.
    known_proxy: imageProxy,
    likely_spam_filter: Boolean(scannerVendor || prefetch),
  };
}
