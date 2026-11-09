import { isIP } from 'node:net';
import { requestProviderJson, SeoError } from './providerHttp.js';

function normalizeTarget(domain, keyword) {
  if (typeof domain !== 'string' || domain.length > 300 || typeof keyword !== 'string' || keyword.length > 200) {
    throw new SeoError(400, 'invalid_query', 'Provide a domain and a keyword of at most 200 characters.');
  }
  const raw = domain.trim();
  let url;
  try { url = new URL(raw.includes('://') ? raw : `https://${raw}`); } catch { /* validated below */ }
  if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
    || url.pathname !== '/' || url.search || url.hash || /:\d+(?:\/|$)/.test(raw)
    || isIP(url.hostname) || !url.hostname.includes('.') || url.hostname.length > 253
    || !url.hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw new SeoError(400, 'invalid_domain', 'Use a domain or HTTP(S) origin without a path, port, credentials or query.');
  }
  let phrase = keyword.trim();
  if (phrase.startsWith('"') && phrase.endsWith('"')) phrase = phrase.slice(1, -1).trim();
  if (!phrase || /["\x00-\x1f\x7f]/.test(phrase)) {
    throw new SeoError(400, 'invalid_keyword', 'Use one non-empty keyword or exact phrase without embedded quotes or control characters.');
  }
  return { domain: url.hostname.toLowerCase(), keyword: phrase.replace(/\s+/g, ' ') };
}

function hasPhrase(value, phrase) {
  const text = String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
  const needle = phrase.normalize('NFKC').toLowerCase();
  let position = text.indexOf(needle);
  while (position !== -1) {
    const before = position ? text[position - 1] : '';
    const after = text[position + needle.length] || '';
    if ((!before || !/[\p{L}\p{N}_]/u.test(before)) && (!after || !/[\p{L}\p{N}_]/u.test(after))) return true;
    position = text.indexOf(needle, position + 1);
  }
  return false;
}

export async function findIndexedPages(input, { env = process.env, fetchImpl = fetch } = {}) {
  const target = normalizeTarget(input?.domain, input?.keyword);
  if (!env.SERPAPI_KEY?.trim()) throw new SeoError(503, 'search_not_configured', 'Configure SERPAPI_KEY on the API server to query Google results.');
  const query = `site:${target.domain} "${target.keyword}"`;
  const endpoint = new URL('https://serpapi.com/search.json');
  for (const [key, value] of Object.entries({ engine: 'google', q: query, api_key: env.SERPAPI_KEY, hl: 'en', gl: 'in' })) endpoint.searchParams.set(key, value);
  const data = await requestProviderJson(endpoint.href, {}, { fetchImpl });
  if (!data || typeof data !== 'object' || data.error || (data.organic_results !== undefined && !Array.isArray(data.organic_results))) {
    throw new SeoError(502, 'invalid_search_response', 'Google search provider could not complete the query. Check provider quota and configuration.');
  }
  const results = [];
  const seen = new Set();
  let unverifiedCount = 0;
  for (const [index, entry] of (data.organic_results || []).slice(0, 10).entries()) {
    if (!entry || typeof entry.link !== 'string' || entry.link.length > 2048) continue;
    let page;
    try { page = new URL(entry.link); } catch { continue; }
    if (!['http:', 'https:'].includes(page.protocol) || page.username || page.password
      || !(page.hostname === target.domain || page.hostname.endsWith(`.${target.domain}`))) continue;
    page.hash = '';
    if (seen.has(page.href)) continue;
    seen.add(page.href);
    const title = String(entry.title || '').slice(0, 500);
    const snippet = String(entry.snippet || '').slice(0, 1500);
    let decodedUrl = page.href;
    try { decodedUrl = decodeURIComponent(page.href); } catch { /* keep encoded URL */ }
    const matchedFields = Object.entries({ title, snippet, url: decodedUrl }).filter(([, value]) => hasPhrase(value, target.keyword)).map(([key]) => key);
    if (!matchedFields.length) { unverifiedCount++; continue; }
    const rank = Number.isInteger(entry.position) && entry.position > 0 ? entry.position : index + 1;
    results.push({ rank, url: page.href, title, snippet, matchedFields });
  }
  results.sort((left, right) => left.rank - right.rank);
  return {
    ...target, query, provider: 'SerpApi / Google', checkedAt: new Date().toISOString(), results, unverifiedCount,
    summary: `${results.length} landing page(s) with exact phrase evidence in the returned Google results.${results[0] ? ` Highest observed result: ${results[0].url} (position ${results[0].rank}).` : ''}`,
    notes: [
      'Positions reflect this site-restricted Google query, not traffic, clicks or rankings for the unrestricted keyword.',
      'One results page (up to 10 organic entries), English / India. Search results are a sample, not complete index coverage.',
      'Exact phrase evidence comes from the returned title, snippet or URL. Landing-page HTML has not been fetched; omitted phrases may still occur on the page.',
    ],
  };
}
