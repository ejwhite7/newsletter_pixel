# Newsletter Tracking Pixel

A simple, privacy-focused email tracking pixel service that forwards email open events to PostHog or any webhook endpoint. Perfect for tracking newsletter engagement without vendor lock-in.

## Why Track Email Opens?

By tracking which subscribers are opening your emails, you can:

- **Assess subscriber value** - Identify your most engaged readers who consistently open emails
- **Improve targeting** - Send special content or offers to highly engaged subscribers
- **Clean your list** - Remove inactive subscribers to improve deliverability rates
- **Optimize send times** - Analyze when your most valuable subscribers are most active
- **Measure content performance** - See which newsletter topics drive the highest engagement
- **Segment audiences** - Create cohorts based on engagement patterns for personalized campaigns

Understanding subscriber engagement helps you focus on readers who find real value in your content, leading to better retention and monetization opportunities.

**Break free from platform lock-in**: While email platforms provide basic open tracking, this critical engagement data is typically locked inside their systems. By tracking opens in PostHog, you can:

- **Export to CRM systems** - Sync engaged subscriber lists to HubSpot, Salesforce, or other CRMs
- **Power ad platforms** - Create lookalike audiences on Facebook, Google Ads based on engaged subscribers
- **Feed analytics tools** - Combine email engagement with website analytics for complete customer journey tracking
- **Build custom audiences** - Use engagement data in any third-party tool that accepts PostHog data
- **Own your data** - Never lose access to subscriber engagement history if you switch email platforms

## Features

- 🎯 **1x1 transparent tracking pixel** - Invisible in emails
- 📊 **PostHog integration** - Forward events to PostHog webhooks
- 🚀 **Zero maintenance** - Deploy once on Vercel
- 🔧 **Newsletter platform agnostic** - Works with any email service
- 📧 **Beehiiv ready** - Pre-configured merge tags
- ⚡ **Fast response** - Returns pixel immediately, processes webhook async
- 🤖 **Bot detection honeypot** - Identify and filter out bot clicks from analytics

## Quick Start

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ejwhite7/newsletter_pixel)

Or manually:

```bash
git clone https://github.com/YOUR-USERNAME/newsletter-pixel.git
cd newsletter-pixel
npm install -g vercel
vercel --prod
```

### 2. Configure Your Webhook

Set the `POSTHOG_WEBHOOK_URL` environment variable in your Vercel dashboard:

1. Go to your Vercel project → Settings → Environment Variables
2. Add `POSTHOG_WEBHOOK_URL` with your PostHog webhook URL:
   ```
   https://webhooks.us.posthog.com/public/webhooks/YOUR-WEBHOOK-ID
   ```
3. Redeploy for changes to take effect

### 3. Add to Your Newsletter

Add this HTML to your email template:

```html
<img src="https://YOUR-DEPLOYMENT-URL.vercel.app/api/pixel?email={{email}}&subscriber_id={{subscriber_id}}&post_id={{post_id}}" width="1" height="1" alt="" style="display:block;border:0;opacity:0;" />
```

## Newsletter Platform Integration

### Beehiiv

Use these merge tags in your HTML snippet. Add this as an HTML Snippet in beehiiv with visibility set to "Hide on Desktop" to prevent it from appearing in web posts:

```html
<img src="https://YOUR-DEPLOYMENT-URL.vercel.app/api/pixel?email={{email}}&subscriber_id={{subscriber_id}}&post_id={{resource_id}}" width="1" height="1" alt="" style="display:block;border:0;opacity:0;" />
```

### Mailchimp

```html
<img src="https://YOUR-DEPLOYMENT-URL.vercel.app/api/pixel?email=*|EMAIL|*&subscriber_id=*|UNIQID|*&post_id=*|CAMPAIGN_UID|*" width="1" height="1" alt="" style="display:block;border:0;opacity:0;" />
```

### ConvertKit

```html
<img src="https://YOUR-DEPLOYMENT-URL.vercel.app/api/pixel?email={{ subscriber.email_address }}&subscriber_id={{ subscriber.id }}&post_id={{ broadcast.id }}" width="1" height="1" alt="" style="display:block;border:0;opacity:0;" />
```

## Bot Detection Honeypot

Many email security scanners and bots automatically click every link in an email before delivering it. This inflates your analytics with fake engagement. The honeypot endpoint catches these bots by using an invisible link that real users cannot see or click.

### How It Works

1. Add an invisible link to your email template pointing to `/api/bot-trap`
2. Real users never see or click it (it's hidden with CSS)
3. Bots programmed to click all links will trigger the trap
4. The endpoint sends a `bot_trap_triggered` event to PostHog with `is_bot: true`
5. Filter these subscribers from your analytics to get accurate engagement data

### Adding the Honeypot Link

Add this invisible link to your email template alongside your tracking pixel:

**Beehiiv:**
```html
<a href="https://YOUR-DEPLOYMENT-URL.vercel.app/api/bot-trap?email={{email}}&subscriber_id={{subscriber_id}}&post_id={{resource_id}}" style="display:none;visibility:hidden;width:0;height:0;overflow:hidden;position:absolute;">Verify subscription</a>
```

**Mailchimp:**
```html
<a href="https://YOUR-DEPLOYMENT-URL.vercel.app/api/bot-trap?email=*|EMAIL|*&subscriber_id=*|UNIQID|*&post_id=*|CAMPAIGN_UID|*" style="display:none;visibility:hidden;width:0;height:0;overflow:hidden;position:absolute;">Verify subscription</a>
```

**ConvertKit:**
```html
<a href="https://YOUR-DEPLOYMENT-URL.vercel.app/api/bot-trap?email={{ subscriber.email_address }}&subscriber_id={{ subscriber.id }}&post_id={{ broadcast.id }}" style="display:none;visibility:hidden;width:0;height:0;overflow:hidden;position:absolute;">Verify subscription</a>
```

### Best Practices

- Use boring text like "Verify subscription" that bots targeting verification links will click
- Never use text like "Don't click this" - curious humans might click it
- Test in Gmail, Outlook, and Apple Mail to ensure the link is truly invisible
- Place the link early in the email (bots often process links in order)

## PostHog Webhook Configuration

A single webhook handles both email opens and bot trap events. The `event_type` field differentiates them:

- `email_opened` - From the tracking pixel
- `bot_trap_triggered` - From the honeypot link

In your PostHog webhook settings, use this configuration:

```json
{
  "event": "{request.body.event_type}",
  "distinct_id": "{request.body.subscriber_id}",
  "$lib": "newsletter-pixel",
  "$set": {
    "email": "{request.body.email}",
    "subscriber_id": "{request.body.subscriber_id}"
  },
  "email": "{request.body.email}",
  "post_id": "{request.body.post_id}",
  "$set_once": {
    "first_email_open": "{request.body.timestamp}"
  },
  "timestamp": "{request.body.timestamp}",
  "ip_address": "{request.body.ip_address}",
  "user_agent": "{request.body.user_agent}",
  "is_bot": "{request.body.is_bot}",
  "bot_session_ip": "{request.body.bot_session_ip}",
  "bot_session_ua": "{request.body.bot_session_ua}",
  "$source_url": "email",
  "subscriber_id": "{request.body.subscriber_id}"
}
```

This creates two distinct events in PostHog:
- **email_opened** - Legitimate tracking pixel loads
- **bot_trap_triggered** - Bot clicks on the honeypot link (with `is_bot: true`)

### Filtering Bots in PostHog

Filter bot events from your analytics without excluding the entire subscriber:

**In Insights/Dashboards:**
- For email open events: No filter needed (bot trap uses a separate event name)
- To explicitly exclude: Filter `event` → `does not equal` → `bot_trap_triggered`

**Cross-referencing Bot Sessions:**
The `bot_session_ip` and `bot_session_ua` properties let you identify if other events came from the same bot session. Create an insight to find email opens that share IP/user-agent with bot trap events.

**Viewing Bot Activity:**
Create a separate insight to monitor bot activity:
- Filter: `event` → `equals` → `bot_trap_triggered`
- This helps you understand how many bots are targeting your emails

## Data Captured

Each pixel load captures:

- **email** - Subscriber email address
- **subscriber_id** - Unique subscriber identifier
- **post_id** - Newsletter/campaign identifier
- **timestamp** - ISO timestamp of pixel load
- **user_agent** - Email client information
- **ip_address** - Subscriber IP (for geolocation)

## Customization

### Change Webhook Endpoint

Edit `api/pixel.js`:

```javascript
const WEBHOOK_URL = 'https://your-webhook-endpoint.com/webhook';
```

### Add Custom Data

Modify the payload in `api/pixel.js`:

```javascript
body: JSON.stringify({
  email: email || 'unknown',
  subscriber_id: subscriber_id || 'unknown',
  post_id: post_id || 'unknown',
  timestamp: new Date().toISOString(),
  user_agent: req.headers['user-agent'] || 'unknown',
  ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
  // Add your custom fields here
  campaign_name: req.query.campaign_name,
  list_id: req.query.list_id
})
```

### Environment Variables

The following environment variable is **required**:

| Variable | Description |
|----------|-------------|
| `POSTHOG_WEBHOOK_URL` | Your PostHog webhook endpoint URL |

Set this in Vercel's dashboard under Settings → Environment Variables.

## Privacy & GDPR

- This service tracks email opens
- Ensure your privacy policy covers email tracking
- Consider providing opt-out mechanisms
- IP addresses are collected for geolocation

## Limitations

- Some email clients (Gmail) proxy/cache images, affecting accuracy
- Privacy-focused clients may block image loading
- Not all email opens will be tracked (expected ~70-85% accuracy)

## Development

```bash
git clone https://github.com/YOUR-USERNAME/newsletter-pixel.git
cd newsletter-pixel
vercel dev
```

Test the tracking pixel locally:
```
http://localhost:3000/api/pixel?email=test@example.com&subscriber_id=123&post_id=456
```

Test the bot trap locally:
```
http://localhost:3000/api/bot-trap?email=test@example.com&subscriber_id=123&post_id=456
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/YOUR-USERNAME/newsletter-pixel/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/YOUR-USERNAME/newsletter-pixel/discussions)
- 📧 **Email**: Create an issue for support

---

Made with ❤️ for newsletter creators who want simple, reliable email tracking.