import { createCipheriv, createDecipheriv, createPublicKey, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { socialError } from './policy.js';

function encryptionKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw socialError('Social token encryption is not configured.', 503);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw socialError('Social token encryption is not configured.', 503);
  return key;
}
export function encryptSocialToken(token, key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
  if (typeof token !== 'string' || !token || token.length > 16000) throw socialError('Invalid social token.');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function decryptSocialToken(value, key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
  const [version, iv, tag, ciphertext, extra] = String(value).split('.');
  if (version !== 'v1' || extra || !/^[\w-]{16}$/.test(iv ?? '') || !/^[\w-]{22}$/.test(tag ?? '') || !/^[\w-]+$/.test(ciphertext ?? '')) throw socialError('Social account needs reconnecting.', 409);
  if ([iv, tag, ciphertext].some(part => Buffer.from(part, 'base64url').toString('base64url') !== part)) throw socialError('Invalid encrypted social token.', 409);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

let keyCache; let keyExpiry = 0;
async function githubKeys(kid) {
  if (!keyCache || Date.now() >= keyExpiry || !keyCache.some(key => key.kid === kid)) {
    const response = await fetch('https://token.actions.githubusercontent.com/.well-known/jwks', { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok) throw socialError('Publisher identity keys are unavailable.', 503);
    const body = await response.json();
    if (!Array.isArray(body.keys) || body.keys.length > 20) throw socialError('Invalid publisher identity keys.', 503);
    keyCache = body.keys; keyExpiry = Date.now() + 10 * 60_000;
  }
  return keyCache;
}

async function verifySocialWorkflowToken(token, { env = process.env, keys, renderer = false } = {}) {
  const repository = env.SOCIAL_GITHUB_REPOSITORY || 'jobverify/backend';
  const audience = renderer ? env.SOCIAL_VIDEO_OIDC_AUDIENCE : env.SOCIAL_OIDC_AUDIENCE;
  if (renderer && (!/^https:\/\/[^/]+\/api\/social-video-drafts$/.test(audience || '') || audience === env.SOCIAL_OIDC_AUDIENCE)) throw socialError('Social renderer identity is not configured.', 503);
  if (!/^\d+$/.test(env.SOCIAL_GITHUB_REPOSITORY_ID ?? '') || !/^\d+$/.test(env.SOCIAL_GITHUB_OWNER_ID ?? '')
    || !audience || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw socialError('Social publisher identity is not configured.', 503);
  try {
    if (typeof token !== 'string' || token.length > 20000) throw new Error();
    const header = jwt.decode(token, { complete: true })?.header;
    if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200) throw new Error();
    const jwk = (keys ?? await githubKeys(header.kid)).find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
    if (!jwk) throw new Error();
    const claims = jwt.verify(token, createPublicKey({ key: jwk, format: 'jwk' }), {
      issuer: 'https://token.actions.githubusercontent.com', audience, algorithms: ['RS256'], maxAge: '10m', clockTolerance: 5,
    });
    if (claims.aud !== audience || claims.repository_id !== env.SOCIAL_GITHUB_REPOSITORY_ID
      || claims.repository_owner_id !== env.SOCIAL_GITHUB_OWNER_ID || claims.repository !== repository
      || claims.ref !== 'refs/heads/main' || claims.sub !== `repo:${repository}:ref:refs/heads/main`
      || claims.workflow_ref !== `${repository}/.github/workflows/${renderer ? 'social-video-drafts' : 'social-publisher'}.yml@refs/heads/main`
      || !(renderer ? ['schedule', 'workflow_dispatch', 'workflow_run'] : ['schedule', 'workflow_dispatch']).includes(claims.event_name) || !/^\d+$/.test(claims.run_id ?? '')
      || !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) || claims.iat > Date.now() / 1000 + 5) throw new Error();
    return claims;
  } catch (error) {
    if (error.statusCode === 503) throw error;
    throw socialError('Invalid social publisher identity.', 401);
  }
}

export const verifyPublisherToken = (token, options = {}) => verifySocialWorkflowToken(token, options);
export const verifyVideoRendererToken = (token, options = {}) => verifySocialWorkflowToken(token, { ...options, renderer: true });
