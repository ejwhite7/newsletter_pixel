const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Pixel — Track Email Opens with PostHog</title>
  <meta name="description" content="A lightweight, privacy-focused email tracking pixel that forwards opens to PostHog. Own your engagement data.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0a0f;
      --bg-card: #12121a;
      --bg-card-hover: #1a1a26;
      --border: #2a2a3a;
      --text-primary: #f0f0f5;
      --text-secondary: #8888aa;
      --text-muted: #555577;
      --accent: #ff6b35;
      --accent-glow: rgba(255, 107, 53, 0.3);
      --purple: #a855f7;
      --cyan: #22d3ee;
      --green: #4ade80;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: var(--bg-dark);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }
    .bg-pattern {
      position: fixed; inset: 0; z-index: -1;
      background: 
        radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(255, 107, 53, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(34, 211, 238, 0.04) 0%, transparent 60%);
    }
    .grid-overlay {
      position: fixed; inset: 0; z-index: -1;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    header { padding: 24px 0; position: relative; }
    .logo {
      display: flex; align-items: center; gap: 12px;
      font-weight: 600; font-size: 1.1rem;
      color: var(--text-primary); text-decoration: none;
    }
    .logo-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .hero { padding: 80px 0 100px; text-align: center; position: relative; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 100px; font-size: 0.85rem;
      color: var(--purple); margin-bottom: 28px;
      animation: fadeInUp 0.6s ease-out;
    }
    .badge::before {
      content: ''; width: 6px; height: 6px;
      background: var(--purple); border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 700; line-height: 1.1; margin-bottom: 24px;
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: fadeInUp 0.6s ease-out 0.1s both;
    }
    .hero-subtitle {
      font-size: 1.25rem; color: var(--text-secondary);
      max-width: 600px; margin: 0 auto 40px; font-weight: 300;
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }
    .hero-cta {
      display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;
      animation: fadeInUp 0.6s ease-out 0.3s both;
    }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 14px 28px; border-radius: 10px;
      font-size: 1rem; font-weight: 500;
      text-decoration: none; transition: all 0.25s ease;
      cursor: pointer; border: none; font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent), #ff8f65);
      color: white; box-shadow: 0 4px 24px var(--accent-glow);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px var(--accent-glow);
    }
    .btn-secondary {
      background: var(--bg-card); color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: var(--bg-card-hover);
      border-color: var(--text-secondary);
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .demo-section { padding: 40px 0 100px; }
    .demo-visual {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px; padding: 32px;
      position: relative; overflow: hidden;
    }
    .demo-visual::before {
      content: ''; position: absolute;
      top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
    }
    .flow-diagram {
      display: flex; align-items: center; justify-content: center;
      gap: 20px; flex-wrap: wrap; padding: 20px 0;
    }
    .flow-step {
      display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 20px; min-width: 140px;
    }
    .flow-icon {
      width: 64px; height: 64px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; position: relative;
    }
    .flow-icon.email { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
    .flow-icon.pixel { background: linear-gradient(135deg, var(--accent), #ff8f65); }
    .flow-icon.posthog { background: linear-gradient(135deg, var(--purple), #7c3aed); }
    .flow-icon.data { background: linear-gradient(135deg, var(--green), #16a34a); }
    .flow-label { font-size: 0.9rem; font-weight: 500; color: var(--text-primary); }
    .flow-sublabel { font-size: 0.75rem; color: var(--text-secondary); }
    .flow-arrow { color: var(--text-muted); font-size: 24px; opacity: 0.5; }
    .features { padding: 80px 0; }
    .section-header { text-align: center; margin-bottom: 60px; }
    .section-header h2 { font-size: 2rem; font-weight: 600; margin-bottom: 16px; }
    .section-header p { color: var(--text-secondary); font-size: 1.1rem; max-width: 500px; margin: 0 auto; }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    .feature-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px; padding: 28px;
      transition: all 0.3s ease;
    }
    .feature-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--text-muted);
      transform: translateY(-4px);
    }
    .feature-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 20px;
    }
    .feature-icon.orange { background: rgba(255, 107, 53, 0.15); }
    .feature-icon.purple { background: rgba(168, 85, 247, 0.15); }
    .feature-icon.cyan { background: rgba(34, 211, 238, 0.15); }
    .feature-icon.green { background: rgba(74, 222, 128, 0.15); }
    .feature-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    .feature-card p { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; }
    .code-section { padding: 80px 0; }
    .code-block {
      background: #0d0d12; border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; margin-top: 24px;
    }
    .code-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
    }
    .code-dots { display: flex; gap: 8px; }
    .code-dot { width: 12px; height: 12px; border-radius: 50%; }
    .code-dot.red { background: #ff5f56; }
    .code-dot.yellow { background: #ffbd2e; }
    .code-dot.green { background: #27ca40; }
    .code-title { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--text-secondary); }
    .code-content { padding: 24px; overflow-x: auto; }
    .code-content pre { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; line-height: 1.8; color: var(--text-secondary); }
    .code-content .tag { color: #ff6b35; }
    .code-content .attr { color: #22d3ee; }
    .code-content .value { color: #4ade80; }
    .code-content .comment { color: #5a5a7a; }
    .setup { padding: 80px 0; }
    .steps { display: flex; flex-direction: column; gap: 32px; max-width: 700px; margin: 0 auto; }
    .step { display: flex; gap: 24px; align-items: flex-start; }
    .step-number {
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--bg-card); border: 2px solid var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 1.1rem; color: var(--accent); flex-shrink: 0;
    }
    .step-content h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: 8px; }
    .step-content p { color: var(--text-secondary); font-size: 0.95rem; }
    .step-content code { background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
    footer { padding: 60px 0 40px; border-top: 1px solid var(--border); text-align: center; }
    .footer-links { display: flex; justify-content: center; gap: 32px; margin-bottom: 24px; flex-wrap: wrap; }
    .footer-links a { color: var(--text-secondary); text-decoration: none; font-size: 0.95rem; transition: color 0.2s; }
    .footer-links a:hover { color: var(--text-primary); }
    .footer-note { color: var(--text-muted); font-size: 0.85rem; }
    @media (max-width: 768px) {
      .hero { padding: 60px 0 80px; }
      .flow-arrow { display: none; }
      .flow-diagram { gap: 12px; }
      .flow-step { min-width: 100px; padding: 12px; }
      .step { flex-direction: column; gap: 16px; }
    }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  <div class="grid-overlay"></div>
  <header>
    <div class="container">
      <a href="/" class="logo">
        <span class="logo-icon">◉</span>
        Newsletter Pixel
      </a>
    </div>
  </header>
  <main>
    <section class="hero">
      <div class="container">
        <div class="badge">Open Source Email Tracking</div>
        <h1>Track newsletter opens.<br>Own your data.</h1>
        <p class="hero-subtitle">
          A lightweight tracking pixel that forwards email opens to PostHog. 
          No vendor lock-in. Deploy in 60 seconds.
        </p>
        <div class="hero-cta">
          <a href="https://vercel.com/new/clone?repository-url=https://github.com/ejwhite7/newsletter_pixel" class="btn btn-primary" target="_blank">
            Deploy to Vercel →
          </a>
          <a href="https://github.com/ejwhite7/newsletter_pixel" class="btn btn-secondary" target="_blank">
            View on GitHub
          </a>
        </div>
      </div>
    </section>
    <section class="demo-section">
      <div class="container">
        <div class="demo-visual">
          <div class="flow-diagram">
            <div class="flow-step">
              <div class="flow-icon email">📧</div>
              <span class="flow-label">Email Sent</span>
              <span class="flow-sublabel">Newsletter delivered</span>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="flow-icon pixel">◉</div>
              <span class="flow-label">Pixel Loads</span>
              <span class="flow-sublabel">Subscriber opens email</span>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="flow-icon posthog">📊</div>
              <span class="flow-label">PostHog</span>
              <span class="flow-sublabel">Event captured</span>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="flow-icon data">✨</div>
              <span class="flow-label">Your Data</span>
              <span class="flow-sublabel">Export anywhere</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="features">
      <div class="container">
        <div class="section-header">
          <h2>Why use Newsletter Pixel?</h2>
          <p>Break free from platform lock-in and own your subscriber engagement data</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon orange">🎯</div>
            <h3>Invisible 1×1 Pixel</h3>
            <p>A transparent PNG that's completely invisible in emails. Subscribers never know it's there.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon purple">📊</div>
            <h3>PostHog Integration</h3>
            <p>Events flow directly to PostHog via webhooks. Combine email data with your product analytics.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon cyan">⚡</div>
            <h3>Lightning Fast</h3>
            <p>Returns the pixel instantly, then sends the webhook async. Zero impact on email load times.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon green">🔓</div>
            <h3>No Lock-in</h3>
            <p>Export data to any CRM, ad platform, or analytics tool. Your engagement data, your rules.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon orange">🛠️</div>
            <h3>Platform Agnostic</h3>
            <p>Works with Beehiiv, Mailchimp, ConvertKit, Substack, and any platform that supports HTML.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon purple">🚀</div>
            <h3>Zero Maintenance</h3>
            <p>Deploy once on Vercel's free tier. Scales automatically with your subscriber base.</p>
          </div>
        </div>
      </div>
    </section>
    <section class="code-section">
      <div class="container">
        <div class="section-header">
          <h2>Simple Integration</h2>
          <p>Add one line of HTML to your email template</p>
        </div>
        <div class="code-block">
          <div class="code-header">
            <div class="code-dots">
              <span class="code-dot red"></span>
              <span class="code-dot yellow"></span>
              <span class="code-dot green"></span>
            </div>
            <span class="code-title">email-template.html</span>
          </div>
          <div class="code-content">
            <pre><span class="comment">&lt;!-- Add this anywhere in your email HTML --&gt;</span>
<span class="tag">&lt;img</span> <span class="attr">src</span>=<span class="value">"https://your-app.vercel.app/api/pixel?email={{email}}&amp;subscriber_id={{subscriber_id}}&amp;post_id={{post_id}}"</span>
     <span class="attr">width</span>=<span class="value">"1"</span> <span class="attr">height</span>=<span class="value">"1"</span> <span class="attr">alt</span>=<span class="value">""</span>
     <span class="attr">style</span>=<span class="value">"display:block;border:0;opacity:0;"</span> <span class="tag">/&gt;</span></pre>
          </div>
        </div>
      </div>
    </section>
    <section class="setup">
      <div class="container">
        <div class="section-header">
          <h2>Get Started in 3 Steps</h2>
          <p>From zero to tracking in under 5 minutes</p>
        </div>
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>Deploy to Vercel</h3>
              <p>Click the deploy button or clone the repo. Set your <code>POSTHOG_WEBHOOK_URL</code> environment variable in Vercel's dashboard.</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>Configure PostHog Webhook</h3>
              <p>Create a webhook in PostHog and map the incoming event properties to your desired schema.</p>
            </div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>Add to Your Emails</h3>
              <p>Insert the tracking pixel HTML snippet into your newsletter template. Use your platform's merge tags for dynamic values.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <footer>
    <div class="container">
      <div class="footer-links">
        <a href="https://github.com/ejwhite7/newsletter_pixel" target="_blank">GitHub</a>
        <a href="https://github.com/ejwhite7/newsletter_pixel#readme" target="_blank">Documentation</a>
        <a href="https://github.com/ejwhite7/newsletter_pixel/issues" target="_blank">Report Issue</a>
      </div>
      <p class="footer-note">MIT License · Built for newsletter creators who own their data</p>
    </div>
  </footer>
</body>
</html>`;

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
}

