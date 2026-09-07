import express from 'express';

export function createLegalRouter(): express.Router {
  const router = express.Router();

  // Shared renderer for the static legal pages (Privacy Policy, Terms of Service,
  // Data Deletion Instructions) required by Meta's App Basic Settings before the app
  // can request Facebook Login / advanced permissions. Plain server-rendered HTML on
  // purpose — these are legal documents, not part of the SPA's tab-based navigation,
  // and must stay reachable even if the SPA bundle fails to load.
  const LEGAL_LAST_UPDATED = 'August 16, 2026';
  function renderLegalPage(pageTitle: string, tocHtml: string, bodyHtml: string): string {
    return `<!doctype html>
  <html lang="en">
  <head>
  <meta charset="UTF-8" />
  <title>${pageTitle} — Remlin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    min-height: 100vh;
    color: #ffffff;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    position: relative;
    background-color: #050506;
    background-image: radial-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px);
    background-size: 26px 26px;
    background-attachment: fixed;
    overflow-x: hidden;
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    background: radial-gradient(130% 70% at 50% -8%, rgba(255, 255, 255, 0.07), transparent 58%);
    pointer-events: none;
    z-index: 0;
  }
  .legal-page { position: relative; z-index: 1; max-width: 840px; margin: 0 auto; padding: 40px 24px 96px; }
  .legal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 36px; }
  .legal-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #fff; font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
  .legal-logo-mark { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(160deg, #2757d8, #14307c); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; border: 1px solid rgba(255,255,255,0.16); }
  .legal-back { color: rgba(255,255,255,0.55); text-decoration: none; font-size: 13px; font-weight: 600; }
  .legal-back:hover { color: #fff; }
  .legal-card {
    background: radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.09), transparent 46%),
                radial-gradient(90% 70% at 100% 100%, rgba(255,255,255,0.05), transparent 52%),
                linear-gradient(160deg, rgba(26,26,29,0.90), rgba(13,13,14,0.94) 55%, rgba(4,4,5,0.96));
    border: 1px solid rgba(255, 255, 255, 0.11);
    box-shadow: 0 40px 100px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.16);
    border-radius: 22px;
    padding: 44px 40px;
  }
  @media (max-width: 640px) { .legal-card { padding: 30px 22px; } }
  .legal-eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.45); margin: 0 0 10px; }
  h1 { font-size: 2rem; margin: 0 0 6px; color: #fff; letter-spacing: -0.02em; }
  .legal-updated { color: rgba(255,255,255,0.45); font-size: 13px; margin: 0 0 28px; }
  .legal-toc { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 14px; padding: 18px 22px; margin-bottom: 36px; }
  .legal-toc-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.5); margin: 0 0 10px; }
  .legal-toc ol { margin: 0; padding-left: 20px; columns: 2; column-gap: 24px; }
  @media (max-width: 640px) { .legal-toc ol { columns: 1; } }
  .legal-toc li { font-size: 13px; margin-bottom: 6px; break-inside: avoid; }
  .legal-toc a { color: rgba(255,255,255,0.7); text-decoration: none; }
  .legal-toc a:hover { color: #fff; }
  section { margin-top: 34px; padding-top: 2px; scroll-margin-top: 24px; }
  h2 { font-size: 1.2rem; margin: 0 0 12px; color: #fff; display: flex; align-items: baseline; gap: 10px; }
  h2 .legal-num { color: rgba(122,168,255,0.75); font-size: 0.95rem; font-weight: 700; }
  h3 { font-size: 0.98rem; margin: 20px 0 8px; color: #e4e4e7; }
  p, li { color: #b8b8bc; font-size: 0.95rem; line-height: 1.7; }
  p { margin: 0 0 14px; }
  ul, ol.legal-list { margin: 0 0 14px; padding-left: 22px; }
  li { margin-bottom: 6px; }
  strong { color: #e4e4e7; }
  a { color: #a9c6ff; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; font-size: 0.88rem; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); color: #b8b8bc; vertical-align: top; }
  th { color: rgba(255,255,255,0.55); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .legal-note { background: rgba(122,168,255,0.08); border: 1px solid rgba(122,168,255,0.22); border-radius: 12px; padding: 14px 16px; font-size: 0.88rem; color: #c9d8ff; margin: 16px 0; }
  .legal-footer-nav { margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px; }
  .legal-footer-nav a { color: rgba(255,255,255,0.55); text-decoration: none; font-weight: 600; }
  .legal-footer-nav a:hover { color: #fff; }
  </style>
  </head>
  <body>
  <div class="legal-page">
  <div class="legal-header">
    <a href="/" class="legal-logo"><span class="legal-logo-mark">R</span> Remlin</a>
    <a href="/" class="legal-back">← Back to Remlin</a>
  </div>
  <div class="legal-card">
    <p class="legal-eyebrow">Legal</p>
    <h1>${pageTitle}</h1>
    <p class="legal-updated">Last updated: ${LEGAL_LAST_UPDATED}</p>
    <nav class="legal-toc">
      <p class="legal-toc-title">On this page</p>
      <ol>
        ${tocHtml}
      </ol>
    </nav>
    ${bodyHtml}
    <div class="legal-footer-nav">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
      <a href="/data-deletion">Data Deletion</a>
    </div>
  </div>
  </div>
  </body>
  </html>`;
  }

  router.get('/privacy', (req, res) => {
    const toc = [
      'Overview', 'Information We Collect', 'How We Use Information',
      'How We Share Information', 'Meta Platform Data', 'Data Security',
      'Data Retention', 'Your Rights &amp; Data Deletion', 'Cookies &amp; Session Data',
      "Children's Privacy", 'International Data Transfers', 'Changes to This Policy', 'Contact Us',
    ].map((t, i) => `<li><a href="#s${i + 1}">${t}</a></li>`).join('\n        ');

    const body = `
    <section id="s1">
      <h2><span class="legal-num">1.</span> Overview</h2>
      <p>Remlin ("we," "us," "our," "the Service") is an AI sales-assistant platform that lets a merchant connect Facebook Messenger, Instagram, WhatsApp, and/or a website chat widget so an AI assistant can answer customer questions and take orders using the merchant's own product catalog and configured tone/instructions.</p>
      <p>This Privacy Policy explains what information we collect through the Service (including, specifically, data received through Meta's Platform — Facebook, Instagram, and WhatsApp), why we collect it, how it's used, who it's shared with, and the choices you have. It applies to merchants who create a Remlin account ("Merchants") and to the end customers who message a Merchant's connected channel ("Customers").</p>
      <p>This policy covers Remlin's own data practices specifically — it is not a generic website policy, and it does not cover the practices of Meta, Google, Shopify, or any other third-party platform you separately use, each of which is governed by its own privacy policy.</p>
    </section>

    <section id="s2">
      <h2><span class="legal-num">2.</span> Information We Collect</h2>
      <h3>2.1 Information Merchants provide directly</h3>
      <ul>
        <li><strong>Account information:</strong> name, email address, phone number, and password (stored only as a salted bcrypt hash — we never store or can recover your plaintext password).</li>
        <li><strong>Business information:</strong> store name, business phone number, and address, entered during onboarding.</li>
        <li><strong>Product catalog data:</strong> product names, SKUs, prices, inventory counts, descriptions, and photos you upload.</li>
        <li><strong>AI persona configuration:</strong> tone-of-voice instructions, response style, sales rules/guardrails, and an optional opening-greeting message and photo.</li>
        <li><strong>Profile photo:</strong> if you upload an avatar image.</li>
      </ul>
      <h3>2.2 Information received via connected channels (including Meta Platform Data)</h3>
      <p>When you connect a channel, we receive information from that platform necessary to operate the Service:</p>
      <table>
        <tr><th>Channel</th><th>What we receive</th></tr>
        <tr><td>Facebook Messenger</td><td>Page ID, a Page Access Token, the customer's Page-Scoped ID (PSID), the customer's name (where permitted), and message content sent to your Page.</td></tr>
        <tr><td>Instagram</td><td>Connected Instagram Business Account ID, an access token, the customer's Instagram-Scoped ID (IGSID), username, and DM/comment content.</td></tr>
        <tr><td>WhatsApp Business Platform</td><td>Phone Number ID, an access token, the customer's WhatsApp ID and profile name, and message content.</td></tr>
        <tr><td>Google Sign-In (optional)</td><td>Your name, email address, and profile photo, if you choose to sign up or log in with Google instead of a password.</td></tr>
        <tr><td>Shopify (optional)</td><td>Store domain and an access token used to read and sync your product catalog.</td></tr>
      </table>
      <h3>2.3 Customer conversation content</h3>
      <p>We store the text (and, where applicable, images) of conversations between Customers and a Merchant's AI assistant or staff, so the assistant can generate contextually relevant replies and so the Merchant can review conversation history, manage orders, and handle complaints.</p>
      <h3>2.4 Order and cart data</h3>
      <p>When a Customer builds a cart or places an order through a conversation, we store the items, quantities, shipping address, and order status necessary to fulfill and track that order.</p>
      <h3>2.5 Automatically collected technical data</h3>
      <p>Our servers automatically log standard request metadata (such as IP address and timestamps) for security, rate-limiting, and abuse-prevention purposes. We do not use this data for advertising or profiling.</p>
    </section>

    <section id="s3">
      <h2><span class="legal-num">3.</span> How We Use Information</h2>
      <ul>
        <li>To operate the core Service: generating AI replies to Customer messages using Google's Gemini API, based on the Merchant's catalog and persona configuration.</li>
        <li>To let Merchants manage their product catalog, view and respond to conversations, track orders, and configure the AI assistant.</li>
        <li>To authenticate Merchant accounts and maintain login sessions.</li>
        <li>To detect and prevent fraud, abuse, and security incidents (for example, rate-limiting login attempts).</li>
        <li>To fetch a Customer's public profile name from Meta's Graph API so conversations display a real name instead of a generic placeholder.</li>
        <li>To fulfill legal obligations, such as responding to a valid data-deletion request.</li>
      </ul>
      <p>We do <strong>not</strong> use Customer conversation content or any Meta Platform Data to serve advertisements, to build advertising audiences, or for any purpose unrelated to providing the messaging-automation functionality described in this policy — consistent with Meta's Platform Terms.</p>
    </section>

    <section id="s4">
      <h2><span class="legal-num">4.</span> How We Share Information</h2>
      <p>We do not sell personal data. We share information only with the following categories of recipients, and only as needed to operate the Service:</p>
      <ul>
        <li><strong>Google (Gemini API):</strong> conversation text is sent to Google's Gemini API as a subprocessor to generate AI reply suggestions. Google's use of this data is governed by its own API terms and privacy policy.</li>
        <li><strong>Meta Platform (Graph API):</strong> to send and receive messages, we call Meta's Graph API on the Merchant's behalf using their connected channel's access token.</li>
        <li><strong>Supabase:</strong> our database and file-storage provider, used to store account data, catalog data, conversation history, and uploaded images.</li>
        <li><strong>Railway:</strong> our application-hosting provider, which runs the Remlin server.</li>
        <li><strong>Shopify (if connected):</strong> catalog data is synced from your Shopify store using the access token you grant.</li>
      </ul>
      <p>We may also disclose information if required by law, to protect the rights, property, or safety of Remlin, our users, or the public, or in connection with a merger, acquisition, or sale of assets (in which case we'll provide notice before your data becomes subject to a different privacy policy).</p>
    </section>

    <section id="s5">
      <h2><span class="legal-num">5.</span> Meta Platform Data — Special Provisions</h2>
      <p>Data we receive from Facebook, Instagram, or WhatsApp ("Platform Data") is processed strictly as described in this policy and in accordance with Meta's Platform Terms and Developer Policies. Specifically:</p>
      <ul>
        <li>Platform Data is used only to provide the messaging-automation functionality a Merchant has explicitly connected — generating and delivering replies on their behalf.</li>
        <li>Access tokens issued via Facebook Login are encrypted at rest (AES-256-GCM) and are used only to call the Graph API for that specific connected channel.</li>
        <li>Platform Data is never sold, never used for advertising, and never shared with third parties except the subprocessors listed in Section 4, each bound to use it only to help provide the Service.</li>
        <li>A Merchant can revoke Remlin's access to a channel at any time from the Integrations page in the app, or directly through their Facebook Business settings — this immediately stops any further use of that channel's access token.</li>
      </ul>
    </section>

    <section id="s6">
      <h2><span class="legal-num">6.</span> Data Security</h2>
      <ul>
        <li>Passwords are hashed with bcrypt; we never store plaintext passwords.</li>
        <li>Channel access tokens are encrypted at rest using AES-256-GCM before being stored.</li>
        <li>All traffic to the Service is served over HTTPS.</li>
        <li>Session authentication uses an HttpOnly, SameSite cookie, which JavaScript cannot read, reducing the risk of token theft via cross-site scripting.</li>
        <li>Uploaded images are validated by inspecting file content (magic bytes), not just the filename or claimed file type, before being stored.</li>
      </ul>
      <p>No method of transmission or storage is 100% secure, and we cannot guarantee absolute security, but we take reasonable, industry-standard measures to protect your information.</p>
    </section>

    <section id="s7">
      <h2><span class="legal-num">7.</span> Data Retention</h2>
      <p>We retain Merchant and Customer data for as long as the Merchant's account remains active, so that conversation history, order records, and catalog data remain available to the Merchant. If a Merchant disconnects a channel, we stop using that channel's access token going forward, though prior conversation history tied to that channel is retained until account deletion is requested.</p>
      <div class="legal-note">As Remlin is currently operated as an educational (CSE499 capstone) project rather than a commercial service, data may occasionally be reset during development and testing. We do not currently offer commercial-grade retention guarantees.</div>
    </section>

    <section id="s8">
      <h2><span class="legal-num">8.</span> Your Rights &amp; Data Deletion</h2>
      <p>You may request access to, correction of, or deletion of your personal data at any time. See our <a href="/data-deletion">Data Deletion Instructions</a> for the specific process, what gets deleted, and expected turnaround time.</p>
      <p>Depending on your location, you may have additional rights under applicable law (such as the right to data portability, or to object to certain processing). To exercise any of these rights, contact us using the details in Section 13.</p>
    </section>

    <section id="s9">
      <h2><span class="legal-num">9.</span> Cookies &amp; Session Data</h2>
      <p>We use a single essential, HttpOnly session cookie to keep a Merchant logged in. We do not use third-party advertising or tracking cookies.</p>
    </section>

    <section id="s10">
      <h2><span class="legal-num">10.</span> Children's Privacy</h2>
      <p>The Service is intended for business use by Merchants who are at least 18 years old. We do not knowingly collect personal information from children under 13 (or the relevant minimum age in your jurisdiction). If we become aware that we've inadvertently collected such information, we will delete it.</p>
    </section>

    <section id="s11">
      <h2><span class="legal-num">11.</span> International Data Transfers</h2>
      <p>Our database is hosted in the Seoul (ap-northeast-2) region and our application servers are hosted via Railway; both may process data outside of your own country. By using the Service, you consent to this transfer and processing.</p>
    </section>

    <section id="s12">
      <h2><span class="legal-num">12.</span> Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page reflects the most recent revision. Material changes will be reflected here; continued use of the Service after an update constitutes acceptance of the revised policy.</p>
    </section>

    <section id="s13">
      <h2><span class="legal-num">13.</span> Contact Us</h2>
      <p>Questions about this policy, or requests relating to your data, can be directed to the project maintainers via the contact email on file with this app's Meta Developer account.</p>
    </section>`;

    res.type('html').send(renderLegalPage('Privacy Policy', toc, body));
  });

  router.get('/terms', (req, res) => {
    const toc = [
      'Acceptance of Terms', 'Description of the Service', 'Eligibility &amp; Account Registration',
      'Merchant Responsibilities', 'AI-Generated Content Disclaimer', 'Acceptable Use',
      'Third-Party Services', 'Intellectual Property', 'Fees', 'Termination',
      'Disclaimer of Warranties', 'Limitation of Liability', 'Indemnification',
      'Governing Law', 'Changes to These Terms', 'Contact Us',
    ].map((t, i) => `<li><a href="#s${i + 1}">${t}</a></li>`).join('\n        ');

    const body = `
    <section id="s1">
      <h2><span class="legal-num">1.</span> Acceptance of Terms</h2>
      <p>These Terms of Service ("Terms") govern your access to and use of Remlin (the "Service"), an AI sales-assistant platform for Facebook Messenger, Instagram, WhatsApp, and website chat. By creating an account, connecting a messaging channel, or otherwise using the Service, you agree to be bound by these Terms. If you don't agree, don't use the Service.</p>
    </section>

    <section id="s2">
      <h2><span class="legal-num">2.</span> Description of the Service</h2>
      <p>Remlin lets a merchant ("you," "Merchant") connect one or more messaging channels so an AI assistant can respond to customer messages using your product catalog and a persona you configure (tone, response style, sales rules, and an optional opening greeting). The AI assistant can answer questions, recommend products, build a cart, and — depending on your configuration — finalize an order once a customer confirms.</p>
      <p>Remlin is currently operated as a student capstone (CSE499) project. It is provided on an evolving, "as available" basis and is not represented as a finished commercial product.</p>
    </section>

    <section id="s3">
      <h2><span class="legal-num">3.</span> Eligibility &amp; Account Registration</h2>
      <p>You must be at least 18 years old and have the authority to act on behalf of the business you register to use the Service. You agree to provide accurate registration information and to keep your login credentials confidential. You're responsible for all activity that occurs under your account.</p>
    </section>

    <section id="s4">
      <h2><span class="legal-num">4.</span> Merchant Responsibilities</h2>
      <ul>
        <li>You're responsible for the accuracy of your product catalog (prices, inventory, descriptions) and any persona instructions you configure.</li>
        <li>You're responsible for how you use any messaging channel you connect, including compliance with that platform's own rules — for example, Meta's Platform Terms, Developer Policies, Commerce Policies, and Community Standards for Facebook, Instagram, and WhatsApp.</li>
        <li>You're responsible for reviewing and appropriately supervising automated (AI Managed) conversations in your store, particularly around order confirmation and customer complaints.</li>
        <li>You must have a lawful basis to process any customer data that flows through the Service, and to have informed your customers as required by applicable law.</li>
      </ul>
    </section>

    <section id="s5">
      <h2><span class="legal-num">5.</span> AI-Generated Content Disclaimer</h2>
      <p>Replies are generated by a third-party large language model (Google's Gemini API) based on your catalog and configuration. While the Service includes guardrails intended to keep the assistant accurate and on-topic (for example, restricting it to your actual catalog and validating cart/order actions server-side before they take effect), AI-generated replies may occasionally be incomplete, inaccurate, or contextually inappropriate. You remain responsible for monitoring automated behavior in your store and for any consequences of relying on AI-generated content, especially around pricing, availability, and order confirmations.</p>
    </section>

    <section id="s6">
      <h2><span class="legal-num">6.</span> Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Send unsolicited bulk messages, spam, or messages outside a messaging platform's permitted contact window (e.g., Meta's messaging policies for Messenger/Instagram/WhatsApp).</li>
        <li>Advertise, sell, or facilitate the sale of illegal goods or services, or goods/services prohibited by Meta's Commerce Policies.</li>
        <li>Post or transmit deceptive, misleading, fraudulent, harassing, or abusive content.</li>
        <li>Infringe the intellectual property, privacy, or other rights of any third party.</li>
        <li>Attempt to reverse-engineer, probe, or disrupt the Service's infrastructure, or circumvent rate limits or security controls.</li>
        <li>Use the Service in any way that violates the terms, policies, or community standards of any connected third-party platform (Meta, Google, Shopify).</li>
      </ul>
      <p>We may suspend or terminate access for accounts that violate this section.</p>
    </section>

    <section id="s7">
      <h2><span class="legal-num">7.</span> Third-Party Services</h2>
      <p>The Service relies on and interoperates with third-party platforms — Meta's Graph API (Messenger, Instagram, WhatsApp), Google's Gemini API, Google Sign-In, and optionally Shopify. Your use of those platforms through Remlin is also subject to their own terms of service, and we're not responsible for their availability, changes, or conduct. If a third-party platform changes or restricts its API, related functionality in Remlin may be affected.</p>
    </section>

    <section id="s8">
      <h2><span class="legal-num">8.</span> Intellectual Property</h2>
      <p>Remlin and its underlying software, design, and branding are owned by the project's creators. You retain all rights to the content you upload (catalog data, product photos, persona instructions). By uploading content, you grant us a limited license to store, process, and display it solely for the purpose of operating the Service on your behalf.</p>
    </section>

    <section id="s9">
      <h2><span class="legal-num">9.</span> Fees</h2>
      <p>Remlin is currently provided free of charge, as an educational capstone project. We do not currently process payments, charge subscription fees, or handle order payments on your behalf — any payment collection for orders placed through the Service is your own responsibility, outside of Remlin.</p>
    </section>

    <section id="s10">
      <h2><span class="legal-num">10.</span> Termination</h2>
      <p>You may stop using the Service and disconnect any channel at any time. We may suspend or terminate your access if you violate these Terms, misuse the Service, or if required to comply with a connected platform's own enforcement action against your account. Sections that by their nature should survive termination (including Sections 8, 11, 12, and 13) will continue to apply.</p>
    </section>

    <section id="s11">
      <h2><span class="legal-num">11.</span> Disclaimer of Warranties</h2>
      <p>The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, or non-infringement. As a student project, we do not guarantee uptime, data durability, or that the Service will be error-free or uninterrupted.</p>
    </section>

    <section id="s12">
      <h2><span class="legal-num">12.</span> Limitation of Liability</h2>
      <p>To the fullest extent permitted by law, Remlin and its creators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunity, arising from your use of (or inability to use) the Service — including reliance on AI-generated content or automated order handling.</p>
    </section>

    <section id="s13">
      <h2><span class="legal-num">13.</span> Indemnification</h2>
      <p>You agree to indemnify and hold harmless Remlin and its creators from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party (including a connected platform's policies).</p>
    </section>

    <section id="s14">
      <h2><span class="legal-num">14.</span> Governing Law</h2>
      <p>These Terms are governed by the laws applicable to the jurisdiction in which the Service operators are based, without regard to conflict-of-law principles, except where applicable local law requires otherwise.</p>
    </section>

    <section id="s15">
      <h2><span class="legal-num">15.</span> Changes to These Terms</h2>
      <p>We may update these Terms from time to time. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of the Service after an update constitutes acceptance of the revised Terms.</p>
    </section>

    <section id="s16">
      <h2><span class="legal-num">16.</span> Contact Us</h2>
      <p>Questions about these Terms can be directed to the project maintainers via the contact email on file with this app's Meta Developer account.</p>
    </section>`;

    res.type('html').send(renderLegalPage('Terms of Service', toc, body));
  });

  router.get('/data-deletion', (req, res) => {
    const toc = [
      'Overview', 'What Gets Deleted', 'How to Request Deletion',
      'Response Timeline', 'Disconnecting a Channel Without Full Deletion', 'What We Retain After Deletion',
    ].map((t, i) => `<li><a href="#s${i + 1}">${t}</a></li>`).join('\n        ');

    const body = `
    <section id="s1">
      <h2><span class="legal-num">1.</span> Overview</h2>
      <p>You can request deletion of your Remlin account and all associated data at any time, whether or not you connected a channel through Meta's Platform (Facebook, Instagram, or WhatsApp). This page explains what gets deleted, how to request it, and how long it takes.</p>
    </section>

    <section id="s2">
      <h2><span class="legal-num">2.</span> What Gets Deleted</h2>
      <p>A full account deletion permanently removes:</p>
      <ul>
        <li>Your merchant profile and login credentials.</li>
        <li>Your store's product catalog, including uploaded photos.</li>
        <li>Your AI persona configuration (tone, instructions, opening greeting).</li>
        <li>All conversation history and order records tied to your store.</li>
        <li>Any encrypted access tokens for connected channels (Facebook, Instagram, WhatsApp, Shopify) — these are also effectively invalidated on our side, though you should also disconnect/revoke access from the platform's own settings for full revocation on their end.</li>
      </ul>
    </section>

    <section id="s3">
      <h2><span class="legal-num">3.</span> How to Request Deletion</h2>
      <ol class="legal-list">
        <li>Email the project maintainers at the contact address on file with this app's Meta Developer account, from the email address associated with your Remlin account.</li>
        <li>Use the subject line <strong>"Data deletion request"</strong> and include the email address / store name on your account so we can locate it.</li>
        <li>We'll confirm the request against the account on file before deleting anything, to prevent unauthorized deletion requests.</li>
      </ol>
    </section>

    <section id="s4">
      <h2><span class="legal-num">4.</span> Response Timeline</h2>
      <p>As an educational project without a dedicated support team, deletion requests are processed manually. We aim to complete verified requests within a few business days of receipt.</p>
    </section>

    <section id="s5">
      <h2><span class="legal-num">5.</span> Disconnecting a Channel Without Full Deletion</h2>
      <p>If you only want to disconnect a specific channel (Facebook Page, Instagram account, or WhatsApp number) without deleting your whole Remlin account, use the Integrations page in the app, or revoke access directly from your Facebook Business settings. This immediately stops Remlin from sending or receiving messages on that channel, without affecting the rest of your account.</p>
    </section>

    <section id="s6">
      <h2><span class="legal-num">6.</span> What We Retain After Deletion</h2>
      <p>Once a deletion request is completed, we do not retain your personal data, catalog data, or conversation history. We do not currently have a legal or regulatory obligation requiring extended retention of deleted account data beyond what's needed to process the deletion itself.</p>
    </section>`;

    res.type('html').send(renderLegalPage('Data Deletion Instructions', toc, body));
  });

  return router;
}
