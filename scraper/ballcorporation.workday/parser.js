import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { requireNative, oneNative, hasClass, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { verifyRmkCompanyToken } from '../../scraper-support/shared/successFactorsRmk.js';
export const ORIGIN = 'https://jobs.ball.com';
export const HOME = ORIGIN + '/';
export const PACKAGING = ORIGIN + '/corp_packaging/?locale=en_US';
export const SEARCH = ORIGIN + '/corp_packaging/search/';
const SCOPE = '/corp_packaging';
const NATIVE_CONFIG = Object.freeze({ source: 'ballcorporation', companyName: 'Ball Corporation', origin: ORIGIN, companyToken: 'ballcorpor' });
const rolePath = /^\/corp_packaging\/job\/[^/]+\/([1-9]\d{5,15})\/$/;
export function validateURL(value) {
  requireNative(typeof value === 'string', 'Invalid Ball URL'); const url = new URL(value);
  requireNative(url.href === value && url.origin === ORIGIN && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Unapproved Ball origin/credentials');
  if ([HOME, PACKAGING, SEARCH].includes(value)) return url;
  if ([SCOPE + '/search', SCOPE + '/search/'].includes(url.pathname)) {
    const offset = url.searchParams.get('startrow');
    requireNative(/^\d{1,5}$/.test(offset || '') && Number(offset) >= 25 && Number(offset) <= 10000 && Number(offset) % 25 === 0
      && value === ORIGIN + url.pathname + '?q=&sortColumn=referencedate&sortDirection=desc&startrow=' + Number(offset), 'Native Ball search scope/offset changed');
  } else requireNative(rolePath.test(url.pathname) && !url.search, 'Unapproved Ball role/application read');
  return url;
}
const docOf = html => { const doc = document(html); requireNative(!doc.nodes(node => node.tag === 'base').length, 'Unexpected native base URL'); return doc; };
export function verifyHome(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native Ball heading')) === 'Ball Corporation', 'Native Ball brand changed');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href === '/corp_packaging/?locale=en_US').some(node => doc.text(node) === 'Corporate and Packaging Careers'), 'Native Ball scoped careers handoff missing');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href === 'https://www.ball.com/careers').length > 0, 'Native Ball corporate careers backlink missing');
}
export function verifyPackaging(html) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  requireNative(doc.text(oneNative(doc.nodes(node => node.tag === 'h1'), 'native packaging heading')) === 'Ball Corporate and Packaging', 'Native scoped Ball identity changed');
  requireNative(doc.nodes(node => node.tag === 'form' && node.attrs.method?.toLowerCase() === 'get' && node.attrs.action === SCOPE + '/search/').length > 0, 'Native Ball scoped GET search missing');
  requireNative(doc.nodes(node => node.tag === 'a' && node.attrs.href === 'https://www.ball.com/careers').length > 0, 'Native scoped Ball corporate backlink missing');
}
function locationParts(value) {
  const parts = value.split(',').map(norm), last = parts.at(-1), postal = /\d/.test(last) && /^[\da-z -]+$/i.test(last), code = postal ? parts.at(-2) : last;
  requireNative(parts.length >= 2 && parts.every(Boolean) && /^[A-Z]{2}$/.test(code || '') && nativeCountryName(code), 'Unknown native Ball location country');
  return { code, parts, postal };
}
export function parseListing(html, value) {
  const requested = validateURL(value), doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  const labels = doc.nodes(node => hasClass(node, 'paginationLabel')).map(node => doc.text(node));
  requireNative(labels.length > 0 && new Set(labels).size === 1, 'Missing/conflicting native pagination');
  const match = /^Results (\d+) [\u2013\u2014-] (\d+) of (\d+)$/.exec(labels[0]); requireNative(match, 'Unknown native pagination range');
  const [start, end, total] = match.slice(1).map(Number), offset = Number(requested.searchParams.get('startrow') || 0);
  requireNative(total > 0 && total <= 10000 && start === offset + 1 && end === Math.min(offset + 25, total), 'Native25-row pagination range changed');
  const rows = doc.nodes(node => node.tag === 'tr' && hasClass(node, 'data-row')); requireNative(rows.length === end - start + 1, 'Incomplete native listing page');
  const records = rows.map(row => {
    const titles = doc.nodes(node => node.tag === 'a' && hasClass(node, 'jobTitle-link'), row); requireNative(titles.length > 0, 'Missing native role title');
    const url = new URL(titles[0].attrs.href, ORIGIN).href, identity = rolePath.exec(validateURL(url).pathname), title = doc.text(titles[0]);
    requireNative(identity && title && titles.every(node => doc.text(node) === title && new URL(node.attrs.href, ORIGIN).href === url), 'Responsive native title/URL mismatch');
    const rawLocations = [...new Set(doc.nodes(node => hasClass(node, 'jobLocation'), row).map(node => doc.text(node)))]; requireNative(rawLocations.length === 1, 'Conflicting native listing location');
    const grouped = Number(rawLocations[0].match(/\+(\d+) more\u2026?$/)?.[1] || 0), location = rawLocations[0].replace(/\s*\+\d+ more\u2026?$/, '');
    const { code } = locationParts(location);
    return { id: identity[1], jobId: identity[1], publicJobID: identity[1], title, url, sourceUrl: url, location, locations: [location], expectedLocationCount: grouped + 1,
      countryCode: code, country: nativeCountryName(code), rawListingLocation: rawLocations[0], rawListingHTML: doc.outer(row) };
  });
  requireNative(new Set(records.map(row => row.id)).size === records.length, 'Duplicate native page identity');
  let nextURL = null;
  if (end < total) {
    const continuations = doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => new URL(node.attrs.href, value))
      .filter(url => url.origin === ORIGIN && [SCOPE + '/search', SCOPE + '/search/'].includes(url.pathname) && url.searchParams.get('startrow') === String(end));
    const values = [...new Set(continuations.map(url => url.href))]; nextURL = oneNative(values, 'native scoped continuation'); validateURL(nextURL);
  }
  return { records, errors: [], observedRows: rows.length, pageNumber: offset / 25 + 1, lastPage: Math.ceil(total / 25), nextURL, reportedTotal: total, terminationKnown: nextURL === null };
}
const meta = (doc, scope, name) => doc.nodes(node => node.attrs.itemprop === name, scope).map(node => node.attrs.content ?? doc.text(node));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function utcDate(value, label) {
  requireNative(typeof value === 'string' && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} \d{2} \d{2}:\d{2}:\d{2} UTC \d{4}$/.test(value), 'Missing/invalid native ' + label);
  const date = new Date(value); requireNative(Number.isFinite(+date), 'Invalid native ' + label); const pad = n => String(n).padStart(2, '0');
  requireNative(value === `${weekdays[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC ${date.getUTCFullYear()}`, 'Invalid native calendar/weekday/time: ' + label);
  return date.toISOString();
}
export function parseDetail(html, row) {
  const doc = docOf(html); verifyRmkCompanyToken(html, NATIVE_CONFIG);
  const scope = oneNative(doc.nodes(node => Object.hasOwn(node.attrs, 'itemscope') && /^https?:\/\/schema\.org\/JobPosting\/?$/.test(node.attrs.itemtype || '')), 'Ball JobPosting');
  if (/\b(?:this (?:job|position|requisition) is no longer (?:active|available)|position has been filled)\b/i.test(doc.text(scope))) return { excluded: true, reason: 'native-visible-source-closed', publicId: row.id };
  const titleNode = oneNative(doc.nodes(node => node.attrs.itemprop === 'title', scope), 'native title');
  const heading = oneNative(doc.nodes(node => node.tag === 'h1' && doc.nodes(child => child === titleNode, node).length > 0, scope), 'visible role title');
  requireNative(titleNode.tag === 'span' && doc.text(titleNode) === row.title && doc.text(heading) === row.title, 'Listing/native/visible title mismatch');
  requireNative(oneNative(meta(doc, scope, 'hiringOrganization'), 'native employer') === 'Ball', 'Native Ball employer mismatch');
  const companies = doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'businessunit', scope);
  requireNative(companies.length <= 1, 'Ambiguous native Ball company');
  const nativeVisibleCompany = companies.length ? doc.text(companies[0]) : null;
  requireNative(nativeVisibleCompany === null || nativeVisibleCompany === 'Ball Corporation', 'Native Ball business unit mismatch');
  const rawAddresses = doc.nodes(node => node.attrs.itemprop === 'address', scope).map(node => {
    requireNative(Object.hasOwn(node.attrs, 'itemscope') && node.attrs.itemtype === 'http://schema.org/PostalAddress', 'Unknown native address type');
    const read = name => { const values = meta(doc, node, name); requireNative(values.length <= 1, 'Ambiguous native address field'); return values[0] ?? null; };
    const address = Object.fromEntries(['addressLocality', 'addressRegion', 'addressCountry', 'postalCode', 'streetAddress'].map(name => [name, read(name)]));
    return address;
  });
  const visible = doc.nodes(node => hasClass(node, 'jobGeoLocation'), scope).map(node => doc.text(node));
  requireNative(rawAddresses.length === row.expectedLocationCount && visible.length === row.expectedLocationCount, 'Native address/grouped-location count mismatch');
  const unmatchedStreetLabels = [...visible];
  const addresses = rawAddresses.map(address => {
    if (address.addressCountry !== null) {
      requireNative(/^[A-Z]{2}$/.test(address.addressCountry) && nativeCountryName(address.addressCountry), 'Invalid explicit typed native country');
      return { ...address, nativeCountryCode: address.addressCountry, countryEvidence: 'native-typed-addressCountry' };
    }
    requireNative([address.addressLocality, address.addressRegion, address.postalCode].every(value => value === null) && typeof address.streetAddress === 'string', 'Unreviewed missing/mixed native country fields');
    const index = unmatchedStreetLabels.indexOf(address.streetAddress), code = locationParts(address.streetAddress).code;
    requireNative(index >= 0 && code !== 'IN', 'Native foreign full streetAddress lacks exact visible corroboration or supplies India');
    unmatchedStreetLabels.splice(index, 1);
    return { ...address, nativeCountryCode: code, countryEvidence: 'native-full-streetAddress-explicit-foreign-ISO-country-corrob-by-exact-visible-label' };
  });
  const visibleCodes = visible.map(label => locationParts(label).code);
  requireNative(JSON.stringify(addresses.map(address => address.nativeCountryCode).sort()) === JSON.stringify([...visibleCodes].sort()) && row.locations.every(label => visible.includes(label)), 'Native/visible/listing country scope mismatch');
  if (addresses.every(address => address.nativeCountryCode !== 'IN')) return { excluded: true, reason: 'native-typed-and-visible-addresses-all-outside-India', publicId: row.id, nativeAddresses: addresses, nativeVisibleLocations: visible,
    nativeVisibleCompany, nativeCompanyLabelAvailable: nativeVisibleCompany !== null, fullForeignAddressEquivalenceKnown: false };
  requireNative(nativeVisibleCompany === 'Ball Corporation', 'Missing native Ball company for India role');
  const india = addresses.filter(address => address.addressCountry === 'IN'), unmatched = visible.filter((_, index) => visibleCodes[index] === 'IN'), qualified = [];
  for (const address of india) {
    const full = [address.addressLocality, address.addressRegion, address.addressCountry, address.postalCode].filter(Boolean).join(', '), withoutCity = [address.addressRegion, address.addressCountry, address.postalCode].filter(Boolean).join(', ');
    let index = unmatched.indexOf(full), cityKnown = index >= 0 && Boolean(address.addressLocality);
    if (index < 0 && address.addressRegion && address.postalCode) index = unmatched.indexOf(withoutCity);
    requireNative(index >= 0, 'Native India city/state/postal label disagreement');
    qualified.push({ address, visibleLabel: unmatched[index], cityCorroborated: cityKnown }); unmatched.splice(index, 1);
  }
  requireNative(!unmatched.length, 'Unmatched visible India location');
  const description = oneNative(doc.nodes(node => node.attrs.itemprop === 'description', scope), 'native description'), plain = doc.text(description);
  requireNative(plain.length >= 300 && /responsibilit|responsible area|purpose of (?:the )?role|position overview/i.test(plain), 'Missing complete native role description');
  const placement = plain.match(/\b(?:this role|this position)\s+(?:is|will be)\s+(?:based|located)\s+in\s+(United States|United Kingdom|Canada|Australia|India)\b/i);
  if (placement && placement[1].toLowerCase() !== 'india') return { excluded: true, reason: 'explicit-role-placement-contradicts-native-India-address', publicId: row.id, placementEvidence: placement[0] };
  const requisition = oneNative(doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'customfield3', scope), 'native requisition'), requisitionId = doc.text(requisition);
  requireNative(/^[1-9]\d*$/.test(requisitionId), 'Invalid native requisition');
  const nativeDatePosted = oneNative(meta(doc, scope, 'datePosted'), 'publication timestamp'), postingDate = utcDate(nativeDatePosted, 'publication'), closing = meta(doc, scope, 'validThrough');
  requireNative(closing.length <= 1, 'Ambiguous native expiry'); const nativeValidThrough = closing[0] ?? null, closingDate = nativeValidThrough === null ? null : utcDate(nativeValidThrough, 'expiry');
  requireNative(!closingDate || closingDate >= postingDate, 'Native expiry precedes publication');
  const applyUrl = ORIGIN + '/talentcommunity/apply/' + row.id + '/?locale=en_GB', apps = doc.nodes(node => node.tag === 'a' && node.attrs.href?.includes('/talentcommunity/apply/')).map(node => new URL(node.attrs.href, ORIGIN).href);
  requireNative(apps.length > 0 && apps.every(url => url === applyUrl), 'Native application/public ID mismatch');
  const locations = qualified.map(item => item.cityCorroborated ? [item.address.addressLocality, item.address.addressRegion, 'India', item.address.postalCode].filter(Boolean).join(', ') : 'India');
  return { id: requisitionId, jobId: requisitionId, requisitionId, nativePublicJobId: row.id, source: 'ballcorporation', company: 'Ball Corporation', title: row.title,
    sourceUrl: row.url, applyUrl, link: applyUrl, applicationVisited: false, country: 'India', city: qualified.length === 1 && qualified[0].cityCorroborated ? qualified[0].address.addressLocality : null,
    location: locations.join(' / '), locations, nativeLocations: addresses, nativeVisibleLocations: visible, nativeIndiaLocationEvidence: qualified,
    nativeCityCorroborationComplete: qualified.every(item => item.cityCorroborated), nativeRemoteWorkKnown: false, nativeEmployerLabel: 'Ball', nativeVisibleCompany: 'Ball Corporation', legalEmployer: null, originalPublicationDate: null,
    postingDate, postedAt: postingDate, closingDate, sourceClosingDateIsExact: Boolean(closingDate), nativeDatePosted, nativeValidThrough,
    nativeDescriptionHTML: doc.inner(description), jobDescription: doc.inner(description), sourceDescription: doc.inner(description), nativeJobPostingHTML: doc.outer(scope), nativeListingRecord: row,
    sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceListingComplete: false, sourceScopeComplete: false, sourceLocationCorroborationComplete: true, lifecycleCleanupAllowed: false, publicEligibility: null };
}
export function createSourceConfig() {
  return { source: 'ballcorporation', companyName: 'Ball Corporation', boardURL: SEARCH, validateURL, handoffs: [{ url: HOME, verify: verifyHome }, { url: PACKAGING, verify: verifyPackaging }],
    parseListing, parseDetail, candidateForIndia: row => row.countryCode === 'IN' || row.expectedLocationCount > row.locations.length,
    sameReadIdentity: (left, right) => validateURL(left).href === validateURL(right).href,
    pageFingerprint: page => JSON.stringify({ total: page.reportedTotal, records: page.records.map(({ rawListingHTML, ...row }) => row), errors: page.errors }) };
}
