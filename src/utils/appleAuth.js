import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import jwt from 'jsonwebtoken';
import { isAsciiEmailIdentity } from './authSecurity.js';

const ISSUER = 'https://appleid.apple.com';
const invalid = () => new Error('Apple sign-in could not be verified.');
export const hashAppleChallenge = value => createHash('sha256').update(String(value)).digest('hex');

const encryptionKey = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw invalid();
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw invalid();
  return key;
};

// Treat incomplete configuration as disabled; no button or challenge is exposed.
export function readAppleConfig(env = process.env) {
  if (String(env.APPLE_AUTH_ENABLED).toLowerCase() !== 'true') return null;
  try {
    const clientId = String(env.APPLE_CLIENT_ID ?? '').trim();
    const teamId = String(env.APPLE_TEAM_ID ?? '').trim();
    const keyId = String(env.APPLE_KEY_ID ?? '').trim();
    const redirectURI = String(env.APPLE_REDIRECT_URI ?? '').trim();
    const tokenEncryptionKey = String(env.APPLE_TOKEN_ENCRYPTION_KEY ?? '').trim();
    const redirect = new URL(redirectURI);
    if (!clientId || clientId.length > 255 || /\s/.test(clientId)
      || !/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId)
      || redirect.protocol !== 'https:' || redirect.hash || redirect.username || redirect.password
      || !redirect.hostname.includes('.') || isIP(redirect.hostname)) return null;
    const privateKey = createPrivateKey(String(env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'));
    if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return null;
    encryptionKey(tokenEncryptionKey);
    return { clientId, teamId, keyId, redirectURI, privateKey, tokenEncryptionKey };
  } catch { return null; }
}

export function encryptAppleRefreshToken(token, key) {
  if (typeof token !== 'string' || !token || token.length > 10000) throw invalid();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptAppleRefreshToken(value, key) {
  const [version, iv, tag, ciphertext, extra] = String(value).split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw invalid();
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export const sanitizeAppleName = name => [name?.firstName, name?.lastName]
  .filter(part => typeof part === 'string' && !/[<>&]/.test(part))
  .map(part => part.normalize('NFC').replace(/\p{C}/gu, '').trim())
  .filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 80);

export async function verifyAppleIdentityToken(token, { clientId, nonceHash, keys }) {
  if (typeof token !== 'string' || token.length > 12000 || !/^[a-f0-9]{64}$/.test(nonceHash ?? '')) throw invalid();
  const header = jwt.decode(token, { complete: true })?.header;
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid();
  const jwk = keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
  if (!jwk) throw invalid();
  const payload = jwt.verify(token, createPublicKey({ key: jwk, format: 'jwk' }), {
    algorithms: ['RS256'], issuer: ISSUER, audience: clientId, maxAge: '10m', clockTolerance: 30,
  });
  if (payload.aud !== clientId || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255
    || !Number.isFinite(payload.iat) || payload.iat > Date.now() / 1000 + 30
    || !Number.isFinite(payload.exp) || typeof payload.nonce !== 'string'
    || hashAppleChallenge(payload.nonce) !== nonceHash) throw invalid();
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (email && (!emailVerified || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw invalid();
  return { sub: payload.sub, email, emailVerified, emailIsAscii: isAsciiEmailIdentity(payload.email),
    privateEmail: payload.is_private_email === true || payload.is_private_email === 'true' };
}

let cachedKeys;
let keysExpireAt = 0;
async function getKeys(kid) {
  if (!cachedKeys || keysExpireAt < Date.now() || !cachedKeys.some(key => key.kid === kid)) {
    const response = await fetch(`${ISSUER}/auth/keys`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw invalid();
    const body = await response.json();
    if (!Array.isArray(body.keys) || body.keys.length > 20) throw invalid();
    cachedKeys = body.keys;
    keysExpireAt = Date.now() + 60 * 60 * 1000;
  }
  return cachedKeys;
}

function clientSecret(config) {
  return jwt.sign({}, config.privateKey, { algorithm: 'ES256', keyid: config.keyId,
    issuer: config.teamId, subject: config.clientId, audience: ISSUER, expiresIn: 300 });
}

async function appleRequest(path, params, config) {
  const response = await fetch(`${ISSUER}/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret(config), ...params }),
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!response.ok) throw invalid();
  return path === 'revoke' ? undefined : response.json();
}

export const appleIdentity = {
  async verifyResponse({ idToken, code, nonceHash }, env = process.env) {
    const config = readAppleConfig(env);
    if (!config || typeof code !== 'string' || !code || code.length > 5000) throw invalid();
    const keys = await getKeys(jwt.decode(idToken, { complete: true })?.header?.kid);
    const initial = await verifyAppleIdentityToken(idToken, { clientId: config.clientId, nonceHash, keys });
    const tokens = await appleRequest('token', { code, grant_type: 'authorization_code', redirect_uri: config.redirectURI }, config);
    const confirmed = await verifyAppleIdentityToken(tokens.id_token, {
      clientId: config.clientId, nonceHash, keys: await getKeys(jwt.decode(tokens.id_token, { complete: true })?.header?.kid),
    });
    if (confirmed.sub !== initial.sub || (confirmed.email && initial.email && confirmed.email !== initial.email)
      || typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.refresh_token.length > 10000) throw invalid();
    return { ...confirmed, refreshToken: tokens.refresh_token };
  },
  async revokeEncryptedToken(encryptedToken, clientId, env = process.env) {
    // Disabling new Apple sign-ins must not disable deletion-time revocation.
    const config = readAppleConfig({ ...env, APPLE_AUTH_ENABLED: 'true' });
    if (!config || config.clientId !== clientId) throw invalid();
    await appleRequest('revoke', { token: decryptAppleRefreshToken(encryptedToken, config.tokenEncryptionKey), token_type_hint: 'refresh_token' }, config);
  },
};
