import { parseNativeTilePage } from '../../scraper-support/shared/successFactorsNativeTiles.js';
import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';
import { parseNativeRole } from '../../scraper-support/shared/rmkNativePair.js';

export const ORIGIN = 'https://careers.cipla.com';
export const HOME = ORIGIN + '/';
export const SEARCH = ORIGIN + '/search/';
export const API = ORIGIN + '/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=';
export const NATIVE_CONFIG = Object.freeze({ source: 'cipla', companyName: 'Cipla', origin: ORIGIN, companyToken: 'C0001172882P', nativeEmployer: 'Cipla Limited', requisitionProperty: 'customfield5', caseInsensitiveNativeCountryCodes: true });
const rolePath = /^\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Cipla URL');
  const url = new URL(value);
  requireNative(url.href === value && url.origin === ORIGIN && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Cipla origin/credentials');
  if (url.pathname === '/tile-search-results/') {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 25 && Number(offset) <= 10000 && Number(offset) % 25 === 0, 'Unapproved native tile offset');
    requireNative(value === API + Number(offset), 'Native tile search scope changed');
  } else requireNative(!url.search && (url.pathname === '/' || url.pathname === '/search/' || rolePath.test(url.pathname)), 'Unapproved Cipla job/search/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native Cipla heading')) === 'Cipla Limited Careers', 'Native Cipla brand heading changed');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { const target = new URL(node.attrs.href, HOME); return target.origin === ORIGIN && /^\/search\/?$/.test(target.pathname); } catch { return false; }
  }), 'Native public job-search handoff missing');
}
const countryCodes = new Map();
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = nativeCountryName(code); if (name) countryCodes.set(name, code);
}
function field(doc, row, name, required = true) {
  const values = doc.nodes(node => typeof node.attrs.id === 'string' && node.attrs.id.endsWith('-section-' + name + '-value'), row).map(node => doc.text(node));
  requireNative((!required || values.length > 0) && new Set(values).size <= 1, 'Missing/conflicting native tile field ' + name);
  return values[0] || null;
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function postedDay(value) {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2}|Sept) (\d{4})$/.exec(value || ''), month = months.indexOf(match?.[2] === 'Sept' ? 'Sep' : match?.[2]);
  requireNative(match && month >= 0, 'Unrecognized native posting date label');
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  requireNative(date.getUTCDate() === Number(match[1]) && date.getUTCMonth() === month, 'Invalid native posting day');
  return date.toISOString().slice(0, 10);
}
function parseTile(doc, tile, offset, position) {
  requireNative(tile.tag === 'li' && hasClass(tile, 'job-tile') && tile.attrs['data-row-index'] === String(offset + position + 1), 'Native tile row index/layout mismatch');
  const url = new URL(tile.attrs['data-url'], ORIGIN).href, identity = rolePath.exec(validateURL(url).pathname); requireNative(identity, 'Native tile has no public posting ID');
  const titles = doc.nodes(node => node.tag === 'a' && hasClass(node, 'jobTitle-link'), tile);
  requireNative(titles.length > 0, 'Missing native tile title');
  const title = doc.text(titles[0]);
  requireNative(title && titles.every(node => doc.text(node) === title && new URL(node.attrs.href, ORIGIN).href === url), 'Conflicting responsive title/public ID');
  const req = field(doc, tile, 'customfield5'), city = field(doc, tile, 'customfield2'), state = field(doc, tile, 'customfield3', false), countryRaw = field(doc, tile, 'customfield4', false), dateLabel = field(doc, tile, 'date');
  requireNative(/^[1-9]\d*$/.test(req), 'Invalid native requisition ID');
  const country = nativeCountryName(countryRaw), countryCode = country ? countryCodes.get(country) || null : null;
  return { id: identity[1], jobId: identity[1], publicJobID: identity[1], requisitionId: req, title: norm(title), url, sourceUrl: url, expectedLocationCount: 1,
    locations: [[city, state, countryCode || countryRaw].filter(Boolean).join(', ')], countries: [country || 'unknown-country'], country, countryCode,
    nativePostedDay: postedDay(dateLabel), nativeFields: { city, state, country: countryRaw, requisitionId: req, dateLabel }, rawListingHTML: doc.outer(tile) };
}
export function parsePage(html, url, priorModel = null) {
  return parseNativeTilePage(html, url, priorModel, { validateURL, nativeConfig: NATIVE_CONFIG, apiPrefix: API, parseTile });
}
export function parseDetail(html, row) {
  const doc = docOf(html), input = { ...row };
  if (!input.countryCode) {
    const codes = [...new Set(doc.nodes(node => node.attrs.itemprop === 'addressCountry').map(node => (node.attrs.content || '').toUpperCase()))];
    requireNative(codes.length === 1 && nativeCountryName(codes[0]), 'Missing/ambiguous native country evidence'); input.countryCode = codes[0];
  }
  const fact = parseNativeRole(html, input, NATIVE_CONFIG);
  if (fact.excluded) return fact;
  requireNative(fact.requisitionId === row.requisitionId, 'Native listing/detail requisition mismatch');
  requireNative(fact.sourceDetailComplete === true, 'Missing complete native role description');
  const nativeDay = row.nativePostedDay;
  requireNative(nativeDay && (!fact.postingDate || fact.postingDate.slice(0, 10) === nativeDay), 'Native publication date disagreement');
  const visibleDates = doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'date').map(node => doc.text(node));
  requireNative(visibleDates.length <= 1 && (!visibleDates.length || postedDay(visibleDates[0]) === nativeDay), 'Visible native publication date disagreement');
  const application = new URL(fact.applyUrl);
  requireNative(!application.username && !application.password && !application.hash && application.searchParams.getAll('locale').length === 1 && application.searchParams.get('locale') === 'en_GB' && [...application.searchParams.keys()].every(key => key === 'locale'), 'Native application query changed');
  return { ...fact, id: fact.jobId, postingDate: fact.postingDate || nativeDay + 'T00:00:00.000Z', postedAt: fact.postedAt || nativeDay + 'T00:00:00.000Z',
    nativeListingRecord: row, nativePostingDateEvidence: fact.nativeDatePosted ? 'native-datePosted-and-visible-listing-day-agree' : 'explicit-visible-listing-day;native-datePosted-missing',
    nativeStateLabelFromListing: row.nativeFields?.state ?? null, nativeStateLabelEquivalenceUnknown: true,
    lifecycleCleanupAllowed: false, publicEligibility: null, applicationVisited: false };
}
export function createSourceConfig() {
  let model = null;
  return { source: 'cipla', companyName: 'Cipla', boardURL: SEARCH, validateURL,
    handoffs: [{ url: HOME, verify: verifyHome }],
    parseListing: (html, url) => { const page = parsePage(html, url, model); if (!model) model = page.model; return page; },
    parseDetail, candidateForIndia: row => !row.countryCode || row.countryCode === 'IN',
    sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records.map(row => [row.id, row.requisitionId, row.title, row.locations, row.countryCode, row.nativePostedDay]), errors: page.errors }),
  };
}
