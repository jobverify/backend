import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';
import { parseNativeRole } from '../../scraper-support/shared/rmkNativePair.js';
import { parseNativeTilePage } from '../../scraper-support/shared/successFactorsNativeTiles.js';

export const ORIGIN = 'https://careers.agcocorp.com';
export const CORPORATE = 'https://www.agcocorp.com/us/en/home.html';
export const HOME = ORIGIN + '/';
export const SEARCH = ORIGIN + '/search/';
export const API = ORIGIN + '/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=';
export const NATIVE_CONFIG = Object.freeze({ source: 'agco', companyName: 'AGCO', origin: ORIGIN, companyToken: 'Agco', nativeEmployer: 'AGCO', requisitionProperty: 'customfield3', allowForeignStreetAddressCountries: true });
const rolePath = /^\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid AGCO URL'); const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved AGCO credentials/URL');
  if (value === CORPORATE) return url;
  requireNative(url.origin === ORIGIN, 'Unapproved AGCO origin');
  if (url.pathname === '/tile-search-results/') {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 25 && Number(offset) <= 10000 && Number(offset) % 25 === 0 && value === API + Number(offset), 'Native tile search scope/offset changed');
  } else requireNative(!url.search && (url.pathname === '/' || url.pathname === '/search/' || rolePath.test(url.pathname)), 'Unapproved AGCO job/search/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyCorporate(html) {
  const doc = docOf(html);
  requireNative(doc.text(doc.root).includes('AGCO') && doc.nodes(node => node.tag === 'a' && node.attrs.href === HOME).some(node => doc.text(node) === 'Careers'), 'Official AGCO corporate Careers handoff missing');
}
export function verifyHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native AGCO heading')) === 'Jobs at AGCO', 'Native AGCO brand heading changed');
}
function field(doc, row, name) {
  const values = doc.nodes(node => node.attrs.id?.endsWith('-section-' + name + '-value'), row).map(node => doc.text(node));
  requireNative(values.length && new Set(values).size === 1 && values[0], 'Missing/conflicting native tile field ' + name);
  return values[0];
}
function countryCode(location) {
  const parts = location.split(',').map(norm), last = parts.at(-1);
  const code = /\d/.test(last) && /^[\da-z -]+$/i.test(last) ? parts.at(-2) : last;
  requireNative(/^[A-Z]{2}$/.test(code || '') && nativeCountryName(code), 'Unrecognized native tile country: ' + location);
  return code;
}
function parseTile(doc, tile, offset, position) {
  requireNative(tile.tag === 'li' && hasClass(tile, 'job-tile') && tile.attrs['data-row-index'] === String(offset + position + 1), 'Native tile row index/layout mismatch');
  const url = new URL(tile.attrs['data-url'], ORIGIN).href, identity = rolePath.exec(validateURL(url).pathname); requireNative(identity, 'Missing native public posting ID');
  const titles = doc.nodes(node => node.tag === 'a' && hasClass(node, 'jobTitle-link'), tile);
  requireNative(titles.length > 0, 'Missing native tile title'); const title = doc.text(titles[0]);
  requireNative(title && titles.every(node => doc.text(node) === title && new URL(node.attrs.href, ORIGIN).href === url), 'Conflicting responsive title/public ID');
  const requisitionId = field(doc, tile, 'customfield3'), primary = field(doc, tile, 'location'), groupedLabel = field(doc, tile, 'multilocation');
  requireNative(/^[1-9]\d*$/.test(requisitionId), 'Invalid native requisition ID');
  const listed = groupedLabel.split('•').map(norm); requireNative(listed.every(Boolean) && listed.includes(primary), 'Grouped/primary native locations conflict');
  const codes = listed.map(countryCode), primaryCode = countryCode(primary);
  const remaining = [...listed]; remaining.splice(remaining.indexOf(primary), 1);
  return { id: identity[1], jobId: identity[1], publicJobID: identity[1], requisitionId, title, url, sourceUrl: url,
    nativeListedLocations: listed, nativeCountryCodes: codes, nativePrimaryLocation: primary, nativeGroupedLocationLabel: groupedLabel,
    locations: [primary, ...remaining], expectedLocationCount: listed.length,
    countryCode: primaryCode, country: nativeCountryName(primaryCode), countries: [...new Set(codes)].map(nativeCountryName), rawListingHTML: doc.outer(tile) };
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function visibleDay(value) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(value || ''), month = months.indexOf(match?.[1]);
  requireNative(match && month >= 0, 'Unrecognized native visible publication date');
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  requireNative(date.getUTCDate() === Number(match[2]) && date.getUTCMonth() === month, 'Invalid native publication day');
  return date.toISOString().slice(0, 10);
}
export function parseDetail(html, row) {
  const doc = docOf(html), fact = parseNativeRole(html, row, NATIVE_CONFIG);
  if (fact.excluded) return fact;
  requireNative(fact.requisitionId === row.requisitionId, 'Native listing/detail requisition mismatch');
  requireNative(fact.sourceDetailComplete === true, 'Missing complete native role description');
  const visibleDate = oneNative(doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'date'), 'native visible publication day'), day = visibleDay(doc.text(visibleDate));
  requireNative(!fact.postingDate || fact.postingDate.slice(0, 10) === day, 'Native/visible publication date disagreement');
  const unmatched = [...row.nativeListedLocations], foreignStateLabels = [];
  for (const address of fact.nativeLocations) {
    const label = [address.addressLocality, address.addressRegion, address.nativeCountryCode, address.postalCode].filter(Boolean).join(', ');
    const index = unmatched.findIndex(listed => address.nativeCountryCode === 'IN' ? listed === label
      : address.countryEvidence === 'native-full-streetAddress-explicit-foreign-country-corroborated' ? listed === address.streetAddress
      : listed.split(',')[0].trim() === address.addressLocality && countryCode(listed) === address.nativeCountryCode
        && (!address.postalCode || listed.endsWith(', ' + address.postalCode)));
    requireNative(index >= 0, 'Full grouped native listing/detail locations disagree');
    if (address.nativeCountryCode !== 'IN' && unmatched[index] !== label) foreignStateLabels.push({ listedLabel: unmatched[index], nativeAddress: address, stateLabelEquivalenceKnown: false });
    unmatched.splice(index, 1);
  }
  requireNative(unmatched.length === 0, 'Unmatched grouped native location');
  const application = new URL(fact.applyUrl);
  requireNative(!application.hash && application.search === '?locale=en_US', 'Native application locale/query changed');
  const indiaLocations = fact.nativeLocations.filter(address => address.nativeCountryCode === 'IN').map(address => [address.addressLocality, address.addressRegion, 'India', address.postalCode].filter(Boolean).join(', '));
  return { ...fact, id: fact.jobId, locations: indiaLocations, postingDate: fact.postingDate || day + 'T00:00:00.000Z', postedAt: fact.postedAt || day + 'T00:00:00.000Z',
    nativeListingRecord: row, nativePostingDateEvidence: fact.nativeDatePosted ? 'native-datePosted-and-visible-day-agree' : 'explicit-visible-day;native-datePosted-missing',
    nativeListingPrimaryCountry: row.countryCode, nativeListingIncludesIndiaBehindForeignPrimary: row.countryCode !== 'IN',
    nativeForeignStateLabels: foreignStateLabels,
    lifecycleCleanupAllowed: false, publicEligibility: null, applicationVisited: false };
}
export function createSourceConfig() {
  let model = null;
  return { source: 'agco', companyName: 'AGCO', boardURL: SEARCH, validateURL,
    handoffs: [{ url: CORPORATE, verify: verifyCorporate }, { url: HOME, verify: verifyHome }],
    parseListing: (html, url) => { const page = parseNativeTilePage(html, url, model, { validateURL, nativeConfig: NATIVE_CONFIG, apiPrefix: API, parseTile }); if (!model) model = page.model; return page; },
    parseDetail, candidateForIndia: row => row.nativeCountryCodes.includes('IN'),
    sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records.map(row => [row.id, row.requisitionId, row.title, row.locations]), errors: page.errors }),
  };
}
