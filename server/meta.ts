import crypto from 'crypto';

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);

  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function sendMessengerMessage(pageAccessToken: string, recipientPsid: string, text: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Messenger send failed: ${res.status} ${body}`);
  }
}

export async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, recipientWaId: string, text: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientWaId,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${body}`);
  }
}

export async function fetchMessengerProfileName(pageAccessToken: string, psid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
    return name || null;
  } catch (err) {
    console.error('Failed to fetch Messenger profile name:', err);
    return null;
  }
}

export async function sendInstagramMessage(igAccountId: string, accessToken: string, recipientIgUserId: string, text: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(igAccountId)}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientIgUserId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram send failed: ${res.status} ${body}`);
  }
}

export async function fetchInstagramProfileName(accessToken: string, igUserId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}?fields=name,username&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.username || data.name || null;
  } catch (err) {
    console.error('Failed to fetch Instagram profile name:', err);
    return null;
  }
}

const FACEBOOK_OAUTH_SCOPES = [
  'pages_messaging',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_messages',
  'business_management',
  'whatsapp_business_messaging',
  'whatsapp_business_management',
];

export function getFacebookOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID || '',
    redirect_uri: redirectUri,
    state,
    scope: FACEBOOK_OAUTH_SCOPES.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForUserToken(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID || '',
    client_secret: process.env.META_APP_SECRET || '',
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Facebook code exchange failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

export interface ManagedPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function listManagedPages(userAccessToken: string): Promise<ManagedPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list managed Pages: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.data || [];
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
}

export async function listWhatsAppPhoneNumbers(userAccessToken: string): Promise<{ wabaId: string; wabaName: string; phoneNumbers: WhatsAppPhoneNumber[] }[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}&access_token=${encodeURIComponent(userAccessToken)}`
    );
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return (data.data || []).map((acc: any) => ({
      wabaId: acc.id,
      wabaName: acc.name || 'WhatsApp Business Account',
      phoneNumbers: acc.phone_numbers?.data || [],
    }));
  } catch (err) {
    console.error('Failed to list WhatsApp accounts:', err);
    return [];
  }
}

export async function subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,instagram_messages&access_token=${encodeURIComponent(pageAccessToken)}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to subscribe Page webhook: ${res.status} ${body}`);
  }
}
