import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { parseRmkListing, verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';
export const ORIGIN = 'https://jobs.bekaert.com';
export const CORPORATE = 'https://www.bekaert.com/en/careers';
export const HOME = ORIGIN + '/';
export const SEARCH = ORIGIN + '/search/';
export const NATIVE_CONFIG = Object.freeze({ source: 'bekaert', companyName: 'Bekaert', origin: ORIGIN, companyToken: 'C0000030876P' });
const rolePath = /^\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
const continuation = ORIGIN + '/search?q=&sortColumn=referencedate&sortDirection=desc&startrow=';
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Bekaert URL'); const url = new URL(value);
  requireNative(url.href === value && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Bekaert URL/credentials');
  if ([CORPORATE, HOME, SEARCH].includes(value)) return url;
  requireNative(url.origin === ORIGIN, 'Unapproved Bekaert origin');
  if (url.pathname === '/search') {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 25 && Number(offset) <= 10000 && Number(offset) % 25 === 0 && value === continuation + Number(offset), 'Native search scope/offset changed');
  } else requireNative(rolePath.test(url.pathname) && !url.search, 'Unapproved Bekaert job/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyCorporate(html) {
  const doc = docOf(html);
  requireNative(doc.text(doc.root).includes('Bekaert') && doc.nodes(node => node.tag === 'a' && [HOME, ORIGIN].includes(node.attrs.href)).some(node => /find a job|open vacancies|go to the jobs database/i.test(doc.text(node))), 'Official Bekaert careers handoff missing');
}
export function verifyHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native Bekaert heading')) === 'Bekaert Jobs', 'Native Bekaert identity changed');
  requireNative(doc.nodes(node => node.tag === 'form' && node.attrs.method?.toLowerCase() === 'get' && node.attrs.action === '/search/').length > 0, 'Native Bekaert GET search missing');
}
const meta = (doc, scope, name) => doc.nodes(node => node.attrs.itemprop === name, scope).map(node => node.attrs.content ?? doc.text(node));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function utcDate(value, label) {
  requireNative(typeof value === 'string' && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} \d{2} \d{2}:\d{2}:\d{2} UTC \d{4}$/.test(value), 'Missing/invalid native ' + label);
  const date = new Date(value); requireNative(Number.isFinite(+date), 'Invalid native ' + label); const pad = value => String(value).padStart(2, '0');
  requireNative(value === `${weekdays[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC ${date.getUTCFullYear()}`, 'Invalid native calendar/weekday/time: ' + label);
  return date.toISOString();
}
function addressRecord(doc, node) {
  requireNative(Object.hasOwn(node.attrs, 'itemscope') && node.attrs.itemtype === 'http://schema.org/PostalAddress', 'Unreviewed native address type');
  const read = name => { const values = meta(doc, node, name); requireNative(values.length <= 1, 'Conflicting native address field'); return values[0] ?? null; };
  const raw = Object.fromEntries(['streetAddress', 'addressCountry', 'addressLocality', 'addressRegion', 'postalCode'].map(name => [name, read(name)]));
  if (raw.streetAddress !== null) {
    requireNative([raw.addressCountry, raw.addressLocality, raw.addressRegion, raw.postalCode].every(value => value === null), 'Unreviewed mixed native full/typed address');
    const parts = raw.streetAddress.split(',').map(norm), last = parts.at(-1), countryIndex = /\d/.test(last) && /^[\da-z -]+$/i.test(last) ? parts.length - 2 : parts.length - 1, code = parts[countryIndex];
    requireNative(parts.length >= 2 && parts.every(Boolean) && countryIndex >= 1 && /^[A-Z]{2}$/.test(code || '') && nativeCountryName(code), 'Native full streetAddress has no explicit ISO country');
    return { ...raw, nativeCountryCode: code, countryEvidence: 'native-full-streetAddress-explicit-ISO-country-corroborated-by-visible-location', canonicalCity: parts[0], canonicalRegion: null, fullNativeLabel: raw.streetAddress };
  }
  requireNative(typeof raw.addressLocality === 'string' && raw.addressLocality.trim() && /^[A-Z]{2}$/.test(raw.addressCountry || '') && nativeCountryName(raw.addressCountry), 'Native typed address lacks locality/country');
  return { ...raw, nativeCountryCode: raw.addressCountry, countryEvidence: 'native-typed-addressCountry-corroborated-by-visible-location', canonicalCity: raw.addressLocality,
    canonicalRegion: raw.addressRegion, fullNativeLabel: [raw.addressLocality, raw.addressRegion, raw.addressCountry, raw.postalCode].filter(Boolean).join(', ') };
}
export function parseDetail(html, row) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  const scope = oneNative(doc.nodes(node => Object.hasOwn(node.attrs, 'itemscope') && /^https?:\/\/schema\.org\/JobPosting\/?$/.test(node.attrs.itemtype || '')), 'Bekaert JobPosting');
  if (/\b(?:this (?:job|position|requisition) is no longer (?:active|available)|position has been filled)\b/i.test(doc.text(scope))) return { excluded: true, reason: 'native-visible-source-closed', publicId: row.id };
  requireNative(oneNative(meta(doc, scope, 'title'), 'native title') === row.title, 'Listing/detail title disagreement');
  const employer = oneNative(meta(doc, scope, 'hiringOrganization'), 'native employer'); requireNative(employer === 'Bekaert NV', 'Native Bekaert employer mismatch');
  const addresses = doc.nodes(node => node.attrs.itemprop === 'address', scope).map(node => addressRecord(doc, node));
  const visible = doc.nodes(node => hasClass(node, 'jobGeoLocation'), scope).map(node => doc.text(node));
  requireNative(addresses.length === row.expectedLocationCount && visible.length === row.expectedLocationCount && visible.every(Boolean), 'Native grouped address/location counts disagree');
  const labelsMatch = JSON.stringify(addresses.map(address => address.fullNativeLabel).sort()) === JSON.stringify([...visible].sort());
  // A native typed foreign country plus every visible location's same explicit
  // foreign suffix can exclude India without asserting state/postal equivalence.
  // This branch cannot admit a job or bypass any native/visible India address.
  if (!labelsMatch && row.countryCode !== 'IN' && row.locations.every(label => visible.includes(label))
    && addresses.every(address => address.addressCountry === row.countryCode)
    && visible.every(label => label.endsWith(', ' + row.countryCode))) {
    return { excluded: true, reason: 'native-typed-and-visible-countries-all-outside-India;foreign-address-labels-unreconciled',
      publicId: row.id, nativeAddresses: addresses, nativeVisibleLocations: visible, foreignAddressLabelsReconciled: false, foreignRegionAndPostalEquivalenceKnown: false };
  }
  requireNative(labelsMatch, 'Native grouped address labels disagree');
  requireNative(row.locations.every(label => visible.includes(label)) && addresses.some(address => address.fullNativeLabel === row.locations[0] && address.nativeCountryCode === row.countryCode), 'Native primary listing/detail country or location mismatch');
  const india = addresses.filter(address => address.nativeCountryCode === 'IN');
  if (!india.length) return { excluded: true, reason: 'native-addresses-all-outside-India', publicId: row.id, nativeAddresses: addresses, nativeVisibleLocations: visible };
  const description = oneNative(doc.nodes(node => node.attrs.itemprop === 'description', scope), 'native description'), plain = doc.text(description);
  requireNative(plain.length >= 300 && /roles and responsibilities|your impact|about you|your profile|what you(?: will)? bring|qualifications|key (?:activities and )?(?:responsibilit|accountabilit)|your role|job description/i.test(plain), 'Missing complete native role description');
  const placement = plain.match(/\b(?:this role|this position)\s+(?:is|will be)\s+(?:based|located)\s+in\s+(United States|United Kingdom|Canada|Australia|India)\b/i);
  if (placement && placement[1].toLowerCase() !== 'india') return { excluded: true, reason: 'explicit-role-placement-contradicts-native-India-address', publicId: row.id, placementEvidence: placement[0] };
  const nativeDatePosted = oneNative(meta(doc, scope, 'datePosted'), 'publication timestamp'), postingDate = utcDate(nativeDatePosted, 'publication');
  const closing = meta(doc, scope, 'validThrough'); requireNative(closing.length <= 1, 'Ambiguous native expiry');
  const nativeValidThrough = closing[0] ?? null, closingDate = nativeValidThrough === null ? null : utcDate(nativeValidThrough, 'expiry');
  requireNative(!closingDate || closingDate >= postingDate, 'Native expiry precedes publication');
  const applications = doc.nodes(node => node.tag === 'a' && node.attrs.href?.includes('/talentcommunity/apply/')).map(node => new URL(node.attrs.href, ORIGIN).href);
  const applyUrl = ORIGIN + '/talentcommunity/apply/' + row.id + '/?locale=en_US'; requireNative(applications.length > 0 && applications.every(url => url === applyUrl), 'Native application/public identity mismatch');
  const locations = india.map(address => [address.canonicalCity, address.canonicalRegion, 'India'].filter(Boolean).join(', '));
  return { id: row.id, jobId: row.id, requisitionId: null, nativePublicJobId: row.id, nativeRequisitionEvidence: 'No explicit native requisition field observed; public URL/application ID retained separately.',
    source: 'bekaert', company: 'Bekaert', title: row.title, sourceUrl: row.url, applyUrl, link: applyUrl, applicationVisited: false,
    country: 'India', city: india.length === 1 ? india[0].canonicalCity : null, location: locations.join(' / '), locations,
    nativeLocations: addresses, nativeVisibleLocations: visible, nativeIndiaLocations: india, nativeEmployerLabel: employer, legalEmployer: null, originalPublicationDate: null,
    postingDate, postedAt: postingDate, closingDate, sourceClosingDateIsExact: Boolean(closingDate), nativeDatePosted, nativeValidThrough,
    nativeDatePostedMeaning: 'native-public-post-date;original-requisition-publication-unknown', nativeDescriptionHTML: doc.inner(description), jobDescription: doc.inner(description), sourceDescription: doc.inner(description),
    nativeJobPostingHTML: doc.outer(scope), nativeListingRecord: row, sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceListingComplete: false, sourceScopeComplete: false,
    sourceLocationCorroborationComplete: true, lifecycleCleanupAllowed: false, publicEligibility: null };
}
export function createSourceConfig() {
  return { source: 'bekaert', companyName: 'Bekaert', boardURL: SEARCH, validateURL, handoffs: [{ url: CORPORATE, verify: verifyCorporate }, { url: HOME, verify: verifyHome }],
    parseListing: (html, url) => {
      const requested = validateURL(url), page = parseRmkListing(html, NATIVE_CONFIG), offset = Number(requested.searchParams.get('startrow') || 0);
      requireNative(page.start === offset + 1 && page.end - page.start + 1 === Math.min(25, page.total - offset), 'Native25-row pagination/range changed');
      if (page.nextUrl) validateURL(page.nextUrl);
      return { records: page.jobs.map(row => ({ ...row, id: row.jobId, url: row.sourceUrl })), errors: [], observedRows: page.jobs.length,
        pageNumber: offset / 25 + 1, lastPage: Math.ceil(page.total / 25), nextURL: page.nextUrl, reportedTotal: page.total, terminationKnown: page.nextUrl === null };
    }, parseDetail, candidateForIndia: row => row.countryCode === 'IN' || row.expectedLocationCount > row.locations.length,
    sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records, errors: page.errors }) };
}
