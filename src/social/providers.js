import { decryptSocialToken } from './security.js';
import { PLATFORMS, socialError } from './policy.js';

export const SOCIAL_SCOPES = {
  linkedin: ['w_organization_social', 'r_organization_social'],
  instagram: ['instagram_business_basic', 'instagram_business_content_publish'],
};
const providerError = (values = {}) => Object.assign(new Error('The social provider request could not be completed.'), { statusCode: 502, ...values });
const scopesOf = value => Array.isArray(value) ? value : String(value || '').split(/[\s,]+/).filter(Boolean);
const littleReserved = new Set('\\|{}@[]()<>#*_~');
const linkedinText = value => [...value].map(character => littleReserved.has(character) ? `\\${character}` : character).join('');
const tokenSeconds = value => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 370 * 86400) throw providerError({ retryable: false });
  return seconds;
};
export function socialAccountConfig(platform, env = process.env) {
  if (!PLATFORMS.includes(platform)) throw socialError('Unknown social platform.');
  const prefix = `SOCIAL_${platform.toUpperCase()}`;
  const clientId = env[`${prefix}_CLIENT_ID`]; const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  const id = platform === 'linkedin' ? env.SOCIAL_LINKEDIN_ORGANIZATION_ID : env.SOCIAL_INSTAGRAM_ACCOUNT_ID;
  if (!clientId || !clientSecret || !/^\d+$/.test(id ?? '') || !/^[A-Za-z0-9+/]{43}=$/.test(env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? '')) throw socialError(`${platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} connection is not configured.`, 503);
  const apiOrigin = new URL(env.PUBLIC_API_ORIGIN || 'https://api.jobverify.in');
  if (apiOrigin.protocol !== 'https:' || apiOrigin.username || apiOrigin.password || apiOrigin.search || apiOrigin.hash || apiOrigin.pathname !== '/') throw socialError('Configure the public HTTPS API origin.', 503);
  return { clientId, clientSecret, destination: platform === 'linkedin' ? `urn:li:organization:${id}` : id,
    redirectURI: `${apiOrigin.origin}/api/admin/social-accounts/${platform}/callback`, scopes: SOCIAL_SCOPES[platform] };
}

export function createSocialProvider({ env = process.env, fetch: fetcher = (...args) => globalThis.fetch(...args) } = {}) {
  const linkedinVersion = env.SOCIAL_LINKEDIN_API_VERSION || '202611';
  const instagramVersion = env.SOCIAL_INSTAGRAM_API_VERSION || 'v27.0';
  const access = account => {
    try { return decryptSocialToken(account.accessToken, env.SOCIAL_TOKEN_ENCRYPTION_KEY); }
    catch { throw providerError({ auth: true, rejected: true, retryable: false }); }
  };
  async function request(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(15_000), redirect: 'error' }); }
    catch { throw providerError({ rejected: false, retryable: true }); }
    const raw = await response.text().catch(() => { throw providerError({ rejected: false, retryable: true }); });
    let data;
    try { if (raw.length > 128 * 1024) throw new Error(); data = raw ? JSON.parse(raw) : {}; }
    catch { if (response.ok) throw providerError({ rejected: false, retryable: true }); data = {}; }
    if (!response.ok || data.error) {
      const status = response.status;
      const auth = status === 401 || status === 403 || [102, 190].includes(data.error?.code);
      const rate = status === 429 || [4, 17, 32, 613].includes(data.error?.code);
      const retryAfter = response.headers.get('retry-after');
      const retryAfterMs = /^\d+$/.test(retryAfter ?? '') ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 30_000;
      throw providerError({ auth, rejected: status >= 400 && status < 500, retryable: !auth && (rate || status >= 500), retryAfterMs });
    }
    return { data, response };
  }
  const form = (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const api = (platform, path, account, options = {}) => {
    if (!/^\d{6}$/.test(linkedinVersion) || !/^v\d{2}\.0$/.test(instagramVersion)) throw socialError('Configure supported social API versions.', 503);
    return request(`${platform === 'linkedin' ? 'https://api.linkedin.com/rest' : `https://graph.instagram.com/${instagramVersion}`}/${path}`, {
      ...options, headers: { Authorization: `Bearer ${access(account)}`,
        ...(platform === 'linkedin' ? { 'Linkedin-Version': linkedinVersion, 'X-Restli-Protocol-Version': '2.0.0' } : {}), ...options.headers },
    });
  };
  const uploadUrl = value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || !url.pathname.startsWith('/dms-uploads/') || url.port || url.username || url.password || url.hash) throw providerError({ retryable: false });
    return url.href;
  };
  const alt = delivery => `${delivery.snapshot.facts.company}: ${delivery.snapshot.facts.title}`.slice(0, 120);

  return {
    authorizationUrl(platform, state) {
      const config = socialAccountConfig(platform, env);
      const url = new URL(platform === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/authorization' : 'https://www.instagram.com/oauth/authorize');
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectURI, response_type: 'code', scope: config.scopes.join(platform === 'linkedin' ? ' ' : ','), state,
        ...(platform === 'instagram' ? { enable_fb_login: 'false', force_reauth: 'true' } : {}) }).toString();
      return url.href;
    },
    async exchange(platform, code) {
      const config = socialAccountConfig(platform, env);
      const initial = (await form(platform === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/accessToken' : 'https://api.instagram.com/oauth/access_token', {
        client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'authorization_code', redirect_uri: config.redirectURI, code,
      })).data;
      const short = initial.data?.[0] || initial;
      if (typeof short.access_token !== 'string' || !short.access_token) throw providerError({ retryable: false });
      let tokens = short; let scopes; let label;
      if (platform === 'linkedin') {
        const introspection = (await form('https://www.linkedin.com/oauth/v2/introspectToken', { client_id: config.clientId, client_secret: config.clientSecret, token: short.access_token })).data;
        if (introspection.active !== true || introspection.client_id !== config.clientId) throw providerError({ auth: true, retryable: false });
        scopes = scopesOf(introspection.scope);
        if (config.scopes.some(scope => !scopes.includes(scope))) throw providerError({ auth: true, retryable: false });
        const temporary = { accessToken: null };
        const { encryptSocialToken } = await import('./security.js');
        temporary.accessToken = encryptSocialToken(short.access_token, env.SOCIAL_TOKEN_ENCRYPTION_KEY);
        await api(platform, `posts?${new URLSearchParams({ q: 'author', author: config.destination, count: '1' })}`, temporary);
        label = env.SOCIAL_LINKEDIN_PAGE_NAME || 'Jobverify LinkedIn Page';
      } else {
        scopes = scopesOf(short.permissions);
        if (config.scopes.some(scope => !scopes.includes(scope))) throw providerError({ auth: true, retryable: false });
        const exchangeUrl = new URL('https://graph.instagram.com/access_token');
        exchangeUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: config.clientSecret, access_token: short.access_token }).toString();
        tokens = (await request(exchangeUrl)).data;
        const profileUrl = new URL(`https://graph.instagram.com/${instagramVersion}/me`); profileUrl.search = new URLSearchParams({ fields: 'user_id,username,account_type' }).toString();
        const identity = (await request(profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } })).data;
        const profile = identity.data?.[0] || identity;
        if (String(profile.user_id) !== config.destination || !['BUSINESS', 'MEDIA_CREATOR'].includes(String(profile.account_type).toUpperCase())) throw providerError({ auth: true, retryable: false });
        label = profile.username || 'Jobverify Instagram';
      }
      return { destination: config.destination, label, scopes, accessToken: tokens.access_token, expiresIn: tokenSeconds(tokens.expires_in),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token, refreshExpiresIn: tokenSeconds(tokens.refresh_token_expires_in) } : {}) };
    },
    async step(delivery, account, { now, getImage, imageUrl, videoUrl, coverUrl }) {
      const state = delivery.providerState || {};
      if (delivery.platform === 'linkedin') {
        if (delivery.phase === 'prepare') {
          const { data } = await api('linkedin', 'images?action=initializeUpload', account, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initializeUploadRequest: { owner: delivery.destination } }) });
          if (!/^urn:li:image:[\w-]+$/.test(data.value?.image || '')) throw providerError({ retryable: false });
          return { phase: 'upload', providerState: { imageId: data.value.image, uploadUrl: uploadUrl(data.value.uploadUrl), polls: 0 } };
        }
        if (delivery.phase === 'upload') {
          // Upload responses need not be JSON. The short-lived URL is accepted
          // only on LinkedIn's upload origin and is never returned to the runner.
          let response;
          try { response = await fetcher(uploadUrl(state.uploadUrl), { method: 'PUT', headers: { Authorization: `Bearer ${access(account)}`, 'Content-Type': 'image/jpeg' }, body: await getImage(), signal: AbortSignal.timeout(15_000), redirect: 'error' }); }
          catch { throw providerError({ retryable: true }); }
          await response.body?.cancel();
          if (!response.ok) throw providerError({ retryable: response.status >= 500 || response.status === 429, auth: [401, 403].includes(response.status) });
          return { phase: 'poll', providerState: { imageId: state.imageId, polls: 0 }, nextPollAt: now };
        }
        if (delivery.phase === 'poll') {
          const { data } = await api('linkedin', `images/${encodeURIComponent(state.imageId)}`, account);
          if (data.status === 'AVAILABLE') return { phase: 'publish', providerState: state, nextPollAt: now };
          if (['PROCESSING_FAILED', 'WAITING_UPLOAD'].includes(data.status) || (state.polls || 0) >= 4) throw providerError({ retryable: false });
          return { phase: 'poll', providerState: { ...state, polls: (state.polls || 0) + 1 }, nextPollAt: new Date(now.getTime() + 60_000) };
        }
      } else {
        if (delivery.phase === 'prepare') {
          const { data } = await api('instagram', `${encodeURIComponent(delivery.destination)}/media`, account, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(delivery.snapshot.instagramMediaType === 'reel'
              ? { media_type: 'REELS', video_url: videoUrl, cover_url: coverUrl, caption: delivery.snapshot.caption }
              : { image_url: imageUrl, caption: delivery.snapshot.caption, alt_text: alt(delivery) }) });
          if (!data.id) throw providerError({ retryable: false });
          return { phase: 'poll', providerState: { containerId: String(data.id), polls: 0 }, nextPollAt: new Date(now.getTime() + 60_000) };
        }
        if (delivery.phase === 'poll') {
          const { data } = await api('instagram', `${encodeURIComponent(state.containerId)}?fields=status_code`, account);
          if (data.status_code === 'FINISHED') return { phase: 'publish', providerState: state, nextPollAt: now };
          if (data.status_code !== 'IN_PROGRESS' || (state.polls || 0) >= 5) throw providerError({ retryable: false });
          return { phase: 'poll', providerState: state, nextPollAt: new Date(now.getTime() + 60_000) };
        }
      }
      throw providerError({ retryable: false });
    },
    async publish(delivery, account) {
      if (delivery.phase !== 'publish') throw providerError({ rejected: true, retryable: false });
      if (delivery.platform === 'linkedin') {
        const { response } = await api('linkedin', 'posts', account, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          author: delivery.destination, commentary: linkedinText(delivery.snapshot.caption), visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false, content: { media: { id: delivery.providerState.imageId, title: delivery.snapshot.facts.title, altText: alt(delivery) } },
        }) });
        const id = response.headers.get('x-restli-id');
        if (!/^urn:li:(share|ugcPost):\d+$/.test(id || '')) throw providerError({ rejected: false });
        return { providerId: id, permalink: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/` };
      }
      const { data } = await api('instagram', `${encodeURIComponent(delivery.destination)}/media_publish`, account, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ creation_id: delivery.providerState.containerId }) });
      if (!data.id) throw providerError({ rejected: false });
      return { providerId: String(data.id) };
    },
    async receipt(delivery, account, id) {
      if (delivery.platform === 'linkedin') {
        if (!/^urn:li:(share|ugcPost):\d+$/.test(id || '')) return null;
        const { data } = await api('linkedin', `posts/${encodeURIComponent(id)}`, account);
        return data.author === delivery.destination && [delivery.snapshot.caption, linkedinText(delivery.snapshot.caption)].includes(data.commentary) && data.lifecycleState === 'PUBLISHED'
          && data.visibility === 'PUBLIC' && data.distribution?.feedDistribution === 'MAIN_FEED'
          && delivery.providerState?.imageId && data.content?.media?.id === delivery.providerState.imageId
          ? { published: true, permalink: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/` } : null;
      }
      if (!/^\d+$/.test(id || '')) return null;
      const { data } = await api('instagram', `${encodeURIComponent(id)}?fields=id,owner,caption,permalink${delivery.snapshot.instagramMediaType === 'reel' ? ',media_type,media_product_type' : ''}`, account);
      const matches = (delivery.snapshot.instagramMediaType !== 'reel' || data.media_type === 'VIDEO' && data.media_product_type === 'REELS') && data.id === id && String(data.owner?.id ?? data.owner) === delivery.destination && data.caption === delivery.snapshot.caption;
      return matches ? { published: true, permalink: /^https:\/\/(www\.)?instagram\.com\//.test(data.permalink || '') ? data.permalink : '' } : null;
    },
    async refresh(account) {
      if (account._id === 'linkedin') {
        if (!account.refreshToken || !account.refreshExpiresAt || account.refreshExpiresAt <= new Date()) return null;
        const config = socialAccountConfig('linkedin', env);
        const { data } = await form('https://www.linkedin.com/oauth/v2/accessToken', { grant_type: 'refresh_token', refresh_token: decryptSocialToken(account.refreshToken, env.SOCIAL_TOKEN_ENCRYPTION_KEY), client_id: config.clientId, client_secret: config.clientSecret });
        return { accessToken: data.access_token, expiresIn: tokenSeconds(data.expires_in), refreshToken: data.refresh_token };
      }
      const url = new URL('https://graph.instagram.com/refresh_access_token');
      url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: access(account) }).toString();
      const { data } = await request(url);
      return { accessToken: data.access_token, expiresIn: tokenSeconds(data.expires_in) };
    },
  };
}
export const socialProvider = createSocialProvider();
