import { domainFromPublicSuffix } from './publicSuffix.js';
import ipaddr from 'ipaddr.js';

const TRACKING = /^(utm_.+|fbclid|gclid|msclkid|ref|referrer|source)$/i;
const SENSITIVE = /(?:token|secret|password|signature|authorization|auth|session|email|candidate|resume|credential|saml|x-amz-|x-goog-)|^(?:api[_-]?key|key|code|jwt|sid|ticket|hmac|policy|login_hint)$/i;
const fail = (message) => Object.assign(new Error(message), { status: 400, code: 'invalid_url' });

export function normalizeJobUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw fail('Paste a public job link of at most 2,048 characters.');
  let url;
  try { url = new URL(value.trim()); } catch { throw fail('Paste a complete http or https job link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
    || (url.port && !['80', '443'].includes(url.port))) throw fail('Use a public http or https job link without login credentials or a custom port.');
  if ([...url.searchParams.keys()].some(key => SENSITIVE.test(key))) throw fail('This appears to be a private or signed link. Paste the public job posting instead.');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

export function redactUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.username = ''; url.password = ''; url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (SENSITIVE.test(key) || TRACKING.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

export function redactText(value, max = 800) {
  return String(value ?? '').replace(/https?:\/\/[^\s<>"']+/gi, url => redactUrl(url) || '[link]')
    .replace(/\b(?:access_token|token|password|secret|signature)\s*[=:]\s*[^\s&,;]+/gi, '[redacted]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
}

export function registrableDomain(value) {
  try {
    const host = new URL(value.includes('://') ? value : `https://${value}`).hostname;
    return domainFromPublicSuffix(host);
  } catch { return null; }
}

export function isPublicAddress(value) {
  try {
    const address = ipaddr.parse(value.replace(/^\[|\]$/g, ''));
    return address.range() === 'unicast';
  } catch { return false; }
}

export function atsTenant(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!['http:', 'https:'].includes(url.protocol) || !/^[\w-]+$/.test(parts[0] || '')) return null;
    const greenhouse = ['boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards.eu.greenhouse.io', 'job-boards.eu.greenhouse.io'];
    if (greenhouse.includes(url.hostname) && (parts.length === 1 || parts[1] === 'jobs' && /^\d+$/.test(parts[2] || ''))) {
      return { provider: 'greenhouse', tenant: parts[0].toLowerCase(), region: url.hostname.includes('.eu.') ? 'eu' : 'global' };
    }
    if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname) && (parts.length === 1 || /^[\w-]+$/.test(parts[1]))) {
      return { provider: 'lever', tenant: parts[0].toLowerCase(), region: url.hostname.includes('.eu.') ? 'eu' : 'global' };
    }
  } catch { /* Invalid identifiers are not evidence. */ }
  return null;
}

export function atsIdentity(value) {
  const tenant = atsTenant(value);
  if (!tenant) return null;
  const parts = new URL(value).pathname.split('/').filter(Boolean);
  const roleId = parts[tenant.provider === 'greenhouse' ? 2 : 1];
  return roleId ? { ...tenant, roleId } : null;
}

export const tenantKey = identity => identity ? `tenant:${identity.provider}:${identity.region}:${identity.tenant}` : null;
export const roleKey = identity => identity ? `role:${identity.provider}:${identity.region}:${identity.tenant}:${identity.roleId}` : null;

export function verificationKeys(job = {}) {
  const keys = new Set();
  for (const value of [job.sourceUrl, job.applyUrl, job.sourceAvailability?.canonicalUrl]) {
    if (!value) continue;
    try {
      keys.add(`url:${normalizeJobUrl(value)}`);
      const identity = atsIdentity(value);
      if (identity) { keys.add(tenantKey(identity)); keys.add(roleKey(identity)); }
    } catch { /* A private application URL is never a verification identity. */ }
  }
  return [...keys];
}

export function sameVacancyUrl(left, right) {
  try {
    const a = atsIdentity(left), b = atsIdentity(right);
    return a && b ? roleKey(a) === roleKey(b) : normalizeJobUrl(left) === normalizeJobUrl(right);
  } catch { return false; }
}
