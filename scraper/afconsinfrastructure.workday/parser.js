import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';
import { parseNativeRole } from '../../scraper-support/shared/rmkNativePair.js';
import { parseNativeTilePage } from '../../scraper-support/shared/successFactorsNativeTiles.js';

export const ORIGIN = 'https://careers.afcons.com';
export const HOME = ORIGIN + '/';
export const SEARCH = ORIGIN + '/search/';
export const API = ORIGIN + '/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=';
export const NATIVE_CONFIG = Object.freeze({ source: 'afconsinfrastructure', companyName: 'Afcons Infrastructure', origin: ORIGIN, companyToken: 'afconsinfr', nativeEmployer: 'Afcons Infrastructure Limited' });
const rolePath = /^\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Afcons URL'); const url = new URL(value);
  requireNative(url.href === value && url.origin === ORIGIN && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Afcons origin/credentials');
  if (url.pathname === '/tile-search-results/') {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 25 && Number(offset) <= 10000 && Number(offset) % 25 === 0 && value === API + Number(offset), 'Native tile search scope/offset changed');
  } else requireNative(!url.search && (url.pathname === '/' || url.pathname === '/search/' || rolePath.test(url.pathname)), 'Unapproved Afcons job/search/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(doc.root).includes('Afcons is a part of the Shapoorji Pallonji Group'), 'Native Afcons about identity changed');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href === 'https://www.afcons.com/' && doc.text(node) === 'Corporate Site').length > 0, 'Native Afcons corporate backlink missing');
}
function field(doc, row, name, suffix = 'value') {
  const values = doc.nodes(node => node.attrs.id?.endsWith('-section-' + name + '-' + suffix), row).map(node => doc.text(node));
  requireNative(values.length && new Set(values).size === 1 && values[0], 'Missing/conflicting native tile field ' + name + '-' + suffix);
  return values[0];
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function listingDay(value) {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2}|Sept) (\d{4})$/.exec(value || ''), month = months.indexOf(match?.[2] === 'Sept' ? 'Sep' : match?.[2]);
  requireNative(match && month >= 0, 'Unrecognized native listing Date label');
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
  requireNative(date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() === month && date.getUTCDate() === Number(match[1]), 'Invalid native listing calendar day');
  return date.toISOString().slice(0, 10);
}
export function parseLocation(value) {
  const parts = value.split(',').map(norm), code = parts.at(-1), country = nativeCountryName(code);
  requireNative(parts.length === 3 && parts.every(Boolean) && /^[A-Z]{2}$/.test(code) && country, 'Unrecognized native Afcons location');
  for (const part of parts.slice(0, -1)) {
    const namedCountry = nativeCountryName(part);
    requireNative(!namedCountry || namedCountry === country, 'Native location country label conflicts with ISO country');
  }
  let locationScope = code === 'IN' ? 'india-city' : 'foreign';
  if (code === 'IN' && parts[0] === 'India') locationScope = 'india-wide';
  if (code === 'IN' && /\babroad\b/i.test(parts.slice(0, -1).join(' '))) locationScope = 'india-or-abroad';
  return { countryCode: code, country, locationScope, nativeLocalityLabel: parts[0], nativeRegionLabel: parts[1] };
}
function parseTile(doc, tile, offset, position) {
  requireNative(tile.tag === 'li' && hasClass(tile, 'job-tile') && tile.attrs['data-row-index'] === String(offset + position + 1), 'Native tile row index/layout mismatch');
  const url = new URL(tile.attrs['data-url'], ORIGIN).href, identity = rolePath.exec(validateURL(url).pathname); requireNative(identity, 'Missing native public posting ID');
  const titles = doc.nodes(node => node.tag === 'a' && hasClass(node, 'jobTitle-link'), tile);
  requireNative(titles.length > 0, 'Missing native tile title'); const title = doc.text(titles[0]);
  requireNative(title && titles.every(node => doc.text(node) === title && new URL(node.attrs.href, ORIGIN).href === url), 'Conflicting responsive title/public ID');
  requireNative(field(doc, tile, 'facility', 'label') === 'Job Req ID', 'Native requisition label changed');
  const requisitionId = field(doc, tile, 'facility'), location = field(doc, tile, 'location'), dateLabel = field(doc, tile, 'date');
  requireNative(/^[1-9]\d*$/.test(requisitionId), 'Invalid native listing requisition');
  const geography = parseLocation(location);
  return { id: identity[1], jobId: identity[1], publicJobID: identity[1], requisitionId, title, url, sourceUrl: url, locations: [location], expectedLocationCount: 1,
    ...geography, countries: [geography.country], nativeListingDateLabel: dateLabel, nativeListingDateDay: listingDay(dateLabel),
    nativeListingDateMeaning: 'native-generic-Date-label-publication-or-update-semantics-unknown', rawListingHTML: doc.outer(tile) };
}
export function parseDetail(html, row) {
  const doc = docOf(html), fact = parseNativeRole(html, row, NATIVE_CONFIG);
  if (fact.excluded) return fact;
  requireNative(fact.sourceDetailComplete === true, 'Missing complete native role description');
  requireNative(fact.nativeDatePosted && fact.postingDate, 'Missing native source publication evidence');
  if (row.locationScope === 'india-or-abroad') throw Object.assign(Error('Afcons native placement includes unresolved India-or-abroad scope'), { code: 'NATIVE_SCOPE_UNKNOWN', incompleteScope: true });
  requireNative(row.locationScope === 'india-wide' || row.locationScope === 'india-city', 'Unqualified native India location scope');
  const countryOnly = row.locationScope === 'india-wide', nativeAddress = oneNative(fact.nativeLocations, 'native Afcons address');
  requireNative(nativeAddress.nativeCountryCode === 'IN', 'Native role lacks typed India country');
  if (countryOnly) requireNative(nativeAddress.addressLocality === 'India', 'Native country-wide locality disagrees');
  else requireNative([nativeAddress.addressLocality, nativeAddress.addressRegion, nativeAddress.nativeCountryCode, nativeAddress.postalCode].filter(Boolean).join(', ') === row.locations[0], 'Native India city/state/postal labels disagree');
  const application = new URL(fact.applyUrl); requireNative(!application.hash && application.search === '?locale=en_US', 'Native application query changed');
  const location = countryOnly ? 'India' : fact.location;
  return { ...fact, id: row.requisitionId, jobId: row.requisitionId, requisitionId: row.requisitionId,
    nativeDetailRequisitionID: fact.requisitionId, nativeRequisitionEvidence: 'explicit-native-listing-Job-Req-ID;detail-field-unavailable',
    city: countryOnly ? null : fact.city, location, locations: [location], nativeIndiaLocationGranularity: countryOnly ? 'country-only' : 'city', nativeRegionLabelMeaningKnown: !countryOnly,
    nativeListingRecord: row, nativeListingDateDay: row.nativeListingDateDay, nativeListingDateMeaning: row.nativeListingDateMeaning,
    nativeVisibleGenericDateLabels: doc.nodes(node => hasClass(node, 'jobDate')).map(node => doc.text(node)),
    lifecycleCleanupAllowed: false, publicEligibility: null, applicationVisited: false };
}
export function createSourceConfig() {
  let model = null;
  return { source: 'afconsinfrastructure', companyName: 'Afcons Infrastructure', boardURL: SEARCH, validateURL, handoffs: [{ url: HOME, verify: verifyHome }],
    parseListing: (html, url) => { const page = parseNativeTilePage(html, url, model, { validateURL, nativeConfig: NATIVE_CONFIG, apiPrefix: API, parseTile }); if (!model) model = page.model; return page; },
    parseDetail, candidateForIndia: row => row.countryCode === 'IN', sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records.map(row => [row.id, row.requisitionId, row.title, row.locations, row.nativeListingDateLabel]), errors: page.errors }),
  };
}
