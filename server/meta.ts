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
