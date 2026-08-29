# Newsletter Tracking Pixel

A small Vercel service that returns an email tracking pixel immediately and forwards authenticated open events to PostHog or another webhook.

## Security model

Tracking URLs contain an encrypted, authenticated token instead of raw subscriber data. Each token is bound to either the pixel or bot-trap endpoint and has an expiry time. Modified, expired, malformed, unsigned, or endpoint-swapped tokens still receive the transparent image but do not generate analytics events.

Webhook delivery runs through Vercel `waitUntil()`, checks HTTP status codes, times out slow requests, and retries bounded transient failures.

## Deploy

1. Deploy this repository to Vercel.
2. Configure these environment variables for the target environment:

   | Variable | Required | Description |
   |---|---:|---|
   | `POSTHOG_WEBHOOK_URL` | Yes | HTTPS destination for event payloads |
   | `TRACKING_TOKEN_SECRET` | Yes | At least 32 random bytes used to encrypt and authenticate tokens |
   | `TRACKING_TOKEN_SECRET_PREVIOUS` | No | Previous secret during a controlled rotation |
   | `ALLOW_UNSIGNED_TRACKING` | No | Temporary migration flag; secure default is `false` |
   | `UNSIGNED_TRACKING_EXPIRES_AT` | With legacy mode | ISO timestamp after which unsigned delivery stops automatically |

3. Generate a secret without committing or printing it in logs:

   ```bash
   openssl rand -base64 32
   ```

4. Store the secret in Vercel-managed environment variables and redeploy.

Never reuse a secret that has appeared in source control.

## Generate tracking tokens

For a single token during local testing:

```bash
npm run token -- pixel alice@example.com subscriber-123 campaign-456 90
```

Arguments are:

```text
<pixel|bot> <email> <subscriber_id> <post_id> [ttl_days]
```

The token generator accepts provider identifiers as bounded opaque strings. Beehiiv UUIDs, Mailchimp identifiers, and ConvertKit numeric IDs are supported.

For newsletters, generate tokens upstream and populate provider custom fields such as `tracking_token` and `bot_tracking_token`. Newsletter templates must not attempt to calculate the token in the email client.

For a batch export, provide newline-delimited JSON records:

```bash
npm run token:batch -- 90 < recipients.ndjson > tokens.ndjson
```

Each input record requires `email`, `subscriber_id`, and `post_id`. Each output record preserves those fields and adds `tracking_token` and `bot_tracking_token` for import into provider custom fields. The command stops at the first invalid record and reports only its line number.

## Email integration

Pixel:

```html
<img src="https://YOUR-DEPLOYMENT.vercel.app/api/pixel?t={{tracking_token}}" width="1" height="1" alt="" style="display:block;border:0;opacity:0;" />
```

Bot-trap link:

```html
<a href="https://YOUR-DEPLOYMENT.vercel.app/api/bot-trap?t={{bot_tracking_token}}" style="display:none;visibility:hidden;width:0;height:0;overflow:hidden;position:absolute;">Verify subscription</a>
```

Generate pixel and bot tokens separately. A pixel token cannot be used on the bot endpoint.

### Provider contract

Before sending a campaign:

1. Export or obtain each recipient's email and provider subscriber ID.
2. Generate one `pixel` token and, if used, one `bot` token for the campaign/post ID.
3. Store the values in provider custom fields.
4. Reference the custom fields in the provider's HTML template syntax.
5. Send a provider test message and confirm one event in a nonproduction webhook destination.

The exact custom-field import and merge-tag syntax varies by provider. Token values use base64url and therefore do not contain query-string `+`, `&`, or `=` characters.

## Legacy migration

Unsigned query parameters are disabled by default. If already-scheduled campaigns still use the old URL contract, temporarily set both values:

```text
ALLOW_UNSIGNED_TRACKING=true
UNSIGNED_TRACKING_EXPIRES_AT=2026-09-15T00:00:00Z
```

Legacy mode accepts bounded non-placeholder email, subscriber, and post values, including numeric IDs. It does not prevent event forgery. The handler automatically disables legacy delivery at the configured timestamp. After migration, set the flag to `false` and remove the expiry; old URLs will continue returning a transparent image but will no longer forward events.

## Event payloads

Every event contains:

```json
{
  "event_id": "uuid",
  "event_type": "email_opened",
  "email": "alice@example.com",
  "subscriber_id": "subscriber-123",
  "post_id": "campaign-456",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "user_agent": "mail client user agent",
  "ip_address": "203.0.113.10",
  "tracking_version": "v1"
}
```

Pixel events also contain:

```json
{
  "client_family": "outlook_ios",
  "is_image_proxy": false,
  "image_proxy": null,
  "is_prefetch": false,
  "scanner_vendor": null,
  "suspicious_user_agent": false,
  "automation_confidence": "none",
  "known_proxy": null,
  "likely_spam_filter": false
}
```

Bot-trap events use `event_type: "bot_trap_triggered"` and include `is_bot`, `bot_session_ip`, and `bot_session_ua`.

### PostHog webhook mapping

Map all request properties that you intend to analyze. A complete mapping is:

```json
{
  "event": "{request.body.event_type}",
  "distinct_id": "{request.body.subscriber_id}",
  "$lib": "newsletter-pixel",
  "$set": {
    "email": "{request.body.email}",
    "subscriber_id": "{request.body.subscriber_id}"
  },
  "$insert_id": "{request.body.event_id}",
  "email": "{request.body.email}",
  "subscriber_id": "{request.body.subscriber_id}",
  "post_id": "{request.body.post_id}",
  "timestamp": "{request.body.timestamp}",
  "tracking_version": "{request.body.tracking_version}",
  "ip_address": "{request.body.ip_address}",
  "user_agent": "{request.body.user_agent}",
  "client_family": "{request.body.client_family}",
  "is_image_proxy": "{request.body.is_image_proxy}",
  "image_proxy": "{request.body.image_proxy}",
  "is_prefetch": "{request.body.is_prefetch}",
  "scanner_vendor": "{request.body.scanner_vendor}",
  "suspicious_user_agent": "{request.body.suspicious_user_agent}",
  "automation_confidence": "{request.body.automation_confidence}",
  "known_proxy": "{request.body.known_proxy}",
  "likely_spam_filter": "{request.body.likely_spam_filter}",
  "is_bot": "{request.body.is_bot}",
  "bot_session_ip": "{request.body.bot_session_ip}",
  "bot_session_ua": "{request.body.bot_session_ua}"
}
```

`is_image_proxy` does not mean spam. Gmail and Yahoo proxy legitimate opens. `automation_confidence` is evidence, not certainty. Use explicit scanner or prefetch signals alongside campaign timing before suppressing engagement.

`$insert_id` makes bounded delivery retries idempotent in PostHog. The service also suppresses immediate duplicate loads of the same signed token within one warm function instance and assigns a stable five-minute event ID bucket. Repeated opens outside that bucket remain measurable.

## Local development

```bash
npm install
cp .env.example .env.local
vercel dev
```

Create a token, then request:

```text
http://localhost:3000/api/pixel?t=TOKEN
```

Token commands automatically load the ignored `.env.local` file when it exists. You can instead export `TRACKING_TOKEN_SECRET` from an approved secret manager. Do not place the literal secret in a command that will be stored in shell history.

Run the complete local quality gate:

```bash
npm run check
npm audit --omit=dev
git diff --check
```

## Privacy and limitations

- The encrypted URL token prevents subscriber email addresses from appearing as plaintext in URLs.
- Event payloads still contain subscriber email and IP address. Configure access, retention, consent, and deletion practices accordingly.
- Image proxies and privacy-focused mail clients limit the accuracy of open tracking.
- Do not treat a missing open as proof that a subscriber did not read an email.
- Do not permanently classify a subscriber as a bot based on one request.

## License

MIT. See [LICENSE](LICENSE).
