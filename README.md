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

Edit `api/pixel.js` and update the webhook URL:

```javascript
const POSTHOG_WEBHOOK = 'https://webhooks.us.posthog.com/public/webhooks/YOUR-WEBHOOK-ID';
```

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

## PostHog Webhook Configuration

In your PostHog webhook settings, use these event properties:

```json
{
  "event": "beehiiv.email_opened",
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
  "$source_url": "email",
  "subscriber_id": "{request.body.subscriber_id}"
}
```

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

For multiple environments or sensitive config, use Vercel environment variables:

```javascript
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://default-webhook.com';
```

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

Test locally at: `http://localhost:3000/api/pixel?email=test@example.com&subscriber_id=123&post_id=456`

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