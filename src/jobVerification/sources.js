import { gzipSync, gunzipSync } from 'node:zlib';
import SourceCache from '../models/VerificationSourceCache.js';
import { fetchPublic } from './safeFetch.js';
import { loadPublicSuffixRules } from './publicSuffix.js';
import { registrableDomain } from './urls.js';

export const PHISHING_FEED = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';
export const SUFFIX_FEED = 'https://publicsuffix.org/list/public_suffix_list.dat';
const DAY = 86_400_000;
const mongoCache = {
  async get(key) {
    const item = await SourceCache.findById(key).lean();
    if (!item) return null;
    return { text: gunzipSync(item.payload, { maxOutputLength: 24_000_000 }).toString('utf8'), observedAt: new Date(item.observedAt).toISOString() };
  },
  async put(key, value) {
    const payload = gzipSync(Buffer.from(value.text));
    if (payload.length > 8_000_000) throw new Error('Source cache limit exceeded.');
    await SourceCache.updateOne({ _id: key }, { $set: { payload, observedAt: new Date(value.observedAt), expiresAt: new Date(Date.parse(value.observedAt) + 30 * DAY) } }, { upsert: true });
  },
};

export function createSourceChecks({ cache = mongoCache, fetchPage = fetchPublic, now = () => new Date() } = {}) {
  const memory = new Map(), flights = new Map();
  let parsedFeed;
  const remember = (key, value) => {
    memory.delete(key); memory.set(key, value);
    while (memory.size > 64) memory.delete(memory.keys().next().value);
  };
  async function read(key, url, validate, signal, ttl = DAY, maxBytes = 16_000_000) {
    let existing = memory.get(key);
    if (!existing) { try { existing = await cache.get(key); } catch { /* A missing cache does not imply an available source. */ } }
    if (existing && now().getTime() - Date.parse(existing.observedAt) < ttl && now().getTime() >= Date.parse(existing.observedAt)) {
      validate(existing.text); remember(key, existing); return existing;
    }
    if (flights.has(key)) return flights.get(key);
    const flight = (async () => {
      const response = await fetchPage(url, { signal, maxBytes, timeoutMs: 10_000, accept: key.startsWith('rdap:') ? 'application/rdap+json,application/json' : 'text/plain' });
      if (response.status !== 200) throw new Error('Source unavailable.');
      validate(response.body);
      const value = { text: response.body, observedAt: now().toISOString() };
      remember(key, value);
      try { await cache.put(key, value); } catch { /* A successful live observation remains evidence if cache storage fails. */ }
      return value;
    })().finally(() => flights.delete(key));
    flights.set(key, flight); return flight;
  }
  const parseFeed = text => {
    if (parsedFeed?.text === text) return parsedFeed.hosts;
    if (/<html|<!doctype/i.test(text)) throw new Error('Invalid feed.');
    const hosts = new Set(text.split(/\r?\n/).map(line => line.trim().toLowerCase().replace(/\.$/, '')).filter(line => /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/.test(line)));
    if (!hosts.size) throw new Error('Empty feed.');
    parsedFeed = { text, hosts };
    return hosts;
  };
  const parseRdap = text => { const value = JSON.parse(text); if (!value || !Array.isArray(value.events)) throw new Error('Invalid registration response.'); return value; };
  async function prepareSources({ signal } = {}) {
    const value = await read('public-suffix-list', SUFFIX_FEED, loadPublicSuffixRules, signal, 7 * DAY, 2_000_000);
    loadPublicSuffixRules(value.text);
  }
  async function checkRisk(url, { signal } = {}) {
    const hostname = new URL(url).hostname;
    const domain = registrableDomain(url);
    const phishing = async () => {
      try {
        const source = await read('phishing-domains', PHISHING_FEED, parseFeed, signal);
        const hosts = parseFeed(source.text);
        // Check the exact host and subdomains only down to the actual registrable domain.
        const labels = hostname.split('.');
        const lowest = domain ? domain.split('.').length : labels.length;
        const hit = labels.some((_, index) => labels.length - index >= lowest && hosts.has(labels.slice(index).join('.')));
        return { id: 'phishing', phase: 'risk', title: 'Phishing reputation', status: 'completed', outcome: hit ? 'threat' : 'neutral',
          detail: hit ? 'This host or its registrable parent appears in the current Phishing.Database feed.' : 'No match was found in the checked Phishing.Database feed. This is not proof of safety.',
          sourceUrl: PHISHING_FEED, observedAt: source.observedAt, excerpt: `${hostname} · ${hit ? 'listed' : 'not listed'} · Phishing.Database (MIT)` };
      } catch { return { id: 'phishing', phase: 'risk', title: 'Phishing reputation', status: 'unavailable', outcome: 'neutral', detail: 'A current phishing feed was unavailable. This check cannot establish whether the host is listed.', sourceUrl: PHISHING_FEED, observedAt: now().toISOString() }; }
    };
    const registration = async () => {
      const sourceUrl = domain ? `https://rdap.org/domain/${encodeURIComponent(domain)}` : SUFFIX_FEED;
      try {
        if (!domain) throw new Error('Domain identity unavailable.');
        const source = await read(`rdap:${domain}`, sourceUrl, parseRdap, signal, DAY, 1_000_000);
        const data = parseRdap(source.text);
        const event = data.events.find(item => item.eventAction === 'registration');
        const registered = Date.parse(event?.eventDate);
        if (!Number.isFinite(registered) || registered > now().getTime()) throw new Error('No registration date.');
        const days = Math.floor((now().getTime() - registered) / DAY);
        return { id: 'domain_age', phase: 'risk', title: 'Domain registration', status: 'completed', outcome: days < 90 ? 'caution' : 'neutral',
          detail: `${domain} was registered ${days} days before this check. Domain age alone does not establish authenticity.`, sourceUrl, observedAt: source.observedAt, excerpt: `Registration date: ${new Date(registered).toISOString().slice(0, 10)}` };
      } catch { return { id: 'domain_age', phase: 'risk', title: 'Domain registration', status: 'unavailable', outcome: 'neutral', detail: 'A registration date could not be obtained. This is not evidence that the employer or vacancy is fake.', sourceUrl, observedAt: now().toISOString() }; }
    };
    return Promise.all([phishing(), registration()]);
  }
  return { prepareSources, checkRisk };
}
export const sourceChecks = createSourceChecks();
