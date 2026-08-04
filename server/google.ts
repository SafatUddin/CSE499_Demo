import { OAuth2Client } from 'google-auth-library';

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  return `${appUrl}/api/auth/google/callback`;
}

// Read credentials lazily so dotenv.config() in server.ts has already run.
function buildClient(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID ?? '',
    process.env.GOOGLE_CLIENT_SECRET ?? '',
    getRedirectUri(),
  );
}

/** Returns the URL the browser should be redirected to for Google consent. */
export function buildGoogleAuthUrl(state: string): string {
  return buildClient().generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}

/**
 * Exchanges an authorization code for tokens, then fetches the Google profile.
 * Throws if the email is missing or unverified.
 */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const client = buildClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID ?? '',
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Empty Google ID token payload');
  if (!payload.email) throw new Error('Google account has no email address');
  if (payload.email_verified === false) throw new Error('Google email address is not verified');

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? null,
  };
}
