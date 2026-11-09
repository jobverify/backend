import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative } from '../../scraper-support/shared/nativeJobPosting.js';
import { parseRmkListing, verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';

export const ORIGIN = 'https://careers.anz.com';
export const CORPORATE = 'https://www.anz.com.au/careers/';
export const LIST_HOME = ORIGIN + '/go/ANZ-Jobs-List/4739210/';
export const SEARCH = ORIGIN + '/search/';
export const NATIVE_CONFIG = Object.freeze({ source: 'anz', companyName: 'ANZ', origin: ORIGIN, companyToken: 'anzbanking' });
const rolePath = /^\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
const continuation = ORIGIN + '/search?q=&sortColumn=referencedate&sortDirection=desc&startrow=';
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid ANZ URL'); const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved ANZ URL/credentials');
  if ([CORPORATE, LIST_HOME, SEARCH].includes(value)) return url;
  requireNative(url.origin === ORIGIN, 'Unapproved ANZ origin');
  if (url.pathname === '/search') {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 100 && Number(offset) <= 10000 && Number(offset) % 100 === 0 && value === continuation + Number(offset), 'Native search scope/offset changed');
  } else requireNative(rolePath.test(url.pathname) && !url.search, 'Unapproved ANZ job/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyCorporate(html) {
  const doc = docOf(html);
  requireNative(doc.nodes(node => node.tag === 'h1').some(node => doc.text(node) === 'Careers at ANZ'), 'Official ANZ Careers identity changed');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href === LIST_HOME).some(node => doc.text(node) === 'Search opportunities at ANZ'), 'Official ANZ native careers handoff missing');
}
export function verifyListHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native ANZ heading')) === 'ANZ Jobs List', 'Native ANZ jobs list identity changed');
  requireNative(doc.nodes(node => node.tag === 'form' && node.attrs.method?.toLowerCase() === 'get' && node.attrs.action === '/search/').length > 0, 'Native ANZ GET search handoff missing');
}
const meta = (doc, scope, name) => doc.nodes(node => node.attrs.itemprop === name, scope).map(node => node.attrs.content ?? doc.text(node));
function agreed(values, label) {
  requireNative(values.length > 0 && values.every(value => typeof value === 'string' && value.trim()) && new Set(values.map(norm)).size === 1, 'Missing/conflicting native ' + label);
  return norm(values[0]);
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function utcDate(value, label) {
  requireNative(typeof value === 'string' && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} \d{2} \d{2}:\d{2}:\d{2} UTC \d{4}$/.test(value), 'Missing/invalid native ' + label);
  const date = new Date(value); requireNative(Number.isFinite(+date), 'Invalid native ' + label);
  const pad = value => String(value).padStart(2, '0');
  const expected = `${weekdays[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC ${date.getUTCFullYear()}`;
  requireNative(value === expected, 'Invalid native calendar/weekday/time: ' + label); return date.toISOString();
}
export function parseDetail(html, row) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  const scope = oneNative(doc.nodes(node => Object.hasOwn(node.attrs, 'itemscope') && /^https?:\/\/schema\.org\/JobPosting\/?$/.test(node.attrs.itemtype || '')), 'ANZ JobPosting');
  if (/\b(?:this (?:job|position|requisition) is no longer (?:active|available)|position has been filled)\b/i.test(doc.text(scope))) return { excluded: true, reason: 'native-visible-source-closed', publicId: row.id };
  requireNative(agreed(meta(doc, scope, 'title'), 'responsive title') === row.title, 'Listing/detail title disagreement');
  const employer = oneNative(meta(doc, scope, 'hiringOrganization'), 'native employer');
  requireNative(employer === 'ANZ Banking Group Limited', 'Native ANZ employer mismatch');
  const addresses = doc.nodes(node => node.attrs.itemprop === 'address', scope).map(node => {
    requireNative(Object.hasOwn(node.attrs, 'itemscope') && node.attrs.itemtype === 'http://schema.org/PostalAddress', 'Unreviewed native address type');
    const read = name => { const values = meta(doc, node, name); requireNative(values.length <= 1, 'Conflicting native address field'); return values[0] ?? null; };
    return { streetAddress: read('streetAddress'), addressCountry: read('addressCountry'), addressLocality: read('addressLocality'), addressRegion: read('addressRegion'), postalCode: read('postalCode') };
  });
  requireNative(row.expectedLocationCount === 1 && row.locations.length === 1 && addresses.length === 1, 'Unreviewed native multi-location scope');
  const address = addresses[0], location = /^([^,]+), ([A-Z]{2})$/.exec(row.locations[0]);
  requireNative(location && address.streetAddress === row.locations[0] && [address.addressCountry, address.addressLocality, address.addressRegion, address.postalCode].every(value => value === null), 'Native full address and listing scope disagree');
  const city = agreed(doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'city', scope).map(node => doc.text(node)), 'visible city');
  requireNative(city === location[1] && row.countryCode === location[2], 'Visible city/listing country disagreement');
  if (location[2] !== 'IN') return { excluded: true, reason: 'native-explicit-non-India-country', nativeAddresses: addresses, publicId: row.id };
  const requisitionId = agreed(doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'customfield1', scope).map(node => doc.text(node)), 'requisition');
  requireNative(/^[1-9]\d*$/.test(requisitionId), 'Invalid native requisition');
  const description = oneNative(doc.nodes(node => node.attrs.itemprop === 'description', scope), 'native description'), plain = doc.text(description);
  requireNative(plain.length >= 300 && /what will your day look like|what will you bring|responsibilit|key accountabilit/i.test(plain), 'Missing complete native role description');
  const placement = plain.match(/\b(?:this role|this position)\s+(?:is|will be)\s+(?:based|located)\s+in\s+(United States|United Kingdom|Canada|Australia|India)\b/i);
  if (placement && placement[1].toLowerCase() !== 'india') return { excluded: true, reason: 'explicit-role-placement-contradicts-native-India-address', publicId: row.id, placementEvidence: placement[0] };
  const nativeDatePosted = oneNative(meta(doc, scope, 'datePosted'), 'publication timestamp'), postingDate = utcDate(nativeDatePosted, 'publication');
  const closing = meta(doc, scope, 'validThrough'); requireNative(closing.length <= 1, 'Ambiguous native expiry');
  const nativeValidThrough = closing[0] ?? null, closingDate = nativeValidThrough === null ? null : utcDate(nativeValidThrough, 'expiry');
  requireNative(!closingDate || closingDate >= postingDate, 'Native expiry precedes publication');
  const applications = doc.nodes(node => node.tag === 'a' && node.attrs.href?.includes('/talentcommunity/apply/')).map(node => new URL(node.attrs.href, ORIGIN).href);
  const applyUrl = ORIGIN + '/talentcommunity/apply/' + row.id + '/?locale=en_GB';
  requireNative(applications.length > 0 && applications.every(url => url === applyUrl), 'Native application/public identity mismatch');
  const nativeLocation = { ...address, nativeCountryCode: 'IN', countryEvidence: 'native-full-streetAddress-explicit-ISO-country-corroborated-by-listing-and-visible-city' };
  return { id: requisitionId, jobId: requisitionId, requisitionId, nativePublicJobId: row.id,
    source: 'anz', company: 'ANZ', title: row.title, sourceUrl: row.url, applyUrl, link: applyUrl, applicationVisited: false,
    country: 'India', city, location: city + ', India', locations: [city + ', India'], nativeLocations: [nativeLocation], nativeTypedAddressCountryAvailable: false,
    nativeEmployerLabel: employer, legalEmployer: null, originalPublicationDate: null,
    postingDate, postedAt: postingDate, closingDate, sourceClosingDateIsExact: Boolean(closingDate), nativeDatePosted, nativeValidThrough,
    nativeDatePostedMeaning: 'native-public-post-date;original-requisition-publication-unknown',
    nativeDescriptionHTML: doc.inner(description), jobDescription: doc.inner(description), sourceDescription: doc.inner(description),
    nativeJobPostingHTML: doc.outer(scope), nativeListingRecord: row,
    sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceListingComplete: false, sourceScopeComplete: false,
    sourceLocationCorroborationComplete: true, lifecycleCleanupAllowed: false, publicEligibility: null };
}
export function createSourceConfig() {
  return { source: 'anz', companyName: 'ANZ', boardURL: SEARCH, validateURL,
    handoffs: [{ url: CORPORATE, verify: verifyCorporate }, { url: LIST_HOME, verify: verifyListHome }],
    parseListing: (html, url) => {
      const requested = validateURL(url), page = parseRmkListing(html, NATIVE_CONFIG), offset = requested.searchParams.get('startrow') || '0';
      requireNative(page.start === Number(offset) + 1 && page.end - page.start + 1 === Math.min(100, page.total - Number(offset)), 'Native100-row pagination/range changed');
      if (page.nextUrl) validateURL(page.nextUrl);
      return { records: page.jobs.map(row => ({ ...row, id: row.jobId, url: row.sourceUrl })), errors: [], observedRows: page.jobs.length,
        pageNumber: Number(offset) / 100 + 1, lastPage: Math.ceil(page.total / 100), nextURL: page.nextUrl, reportedTotal: page.total, terminationKnown: page.nextUrl === null };
    }, parseDetail, candidateForIndia: row => row.countryCode === 'IN' || row.expectedLocationCount > row.locations.length,
    sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records, errors: page.errors }),
  };
}
