import { document, norm } from './rmkNativePairHtml.js';

export const requireNative = (condition, message) => {
  if (!condition) throw Object.assign(Error(message), { code: 'NATIVE_HTML_SHAPE' });
};
export const oneNative = (values, label) => { requireNative(values.length === 1, 'Missing/ambiguous ' + label); return values[0]; };
export const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value);
const key = value => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const names = new Map(), codes = new Map(), display = new Intl.DisplayNames(['en'], { type: 'region' });
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = display.of(code);
  if (name !== code && !['ZZ', 'EU', 'EZ', 'UN', 'QO', 'XA', 'XB'].includes(code)) { names.set(key(name), name); codes.set(code, name); }
}
// Only explicit country labels/ISO country values are recognized; never cities.
export const nativeCountryName = value => typeof value === 'string' ? codes.get(value.trim().toUpperCase()) || names.get(key(value)) || null : null;
// A native location label may end in a written country ("Toronto, Ontario,
// Canada"). Do not interpret a trailing two-letter state abbreviation as ISO.
export const nativeLocationCountryName = value => typeof value === 'string' ? nativeCountryName(value) || (value.includes(',') ? names.get(key(value.split(',').at(-1))) || null : null) : null;
export const plainNativeHTML = html => { const doc = document(html); return doc.text(doc.root); };
const contentKey = html => plainNativeHTML(html).replace(/\s+/g, '');

export function nativeDate(value, { required = false } = {}) {
  if (value == null || value === '') { requireNative(!required, 'Missing native publication date'); return { raw: value ?? null, iso: null, precision: null, exact: false }; }
  requireNative(typeof value === 'string', 'Invalid native date type');
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z)?$/.exec(value);
  requireNative(match, 'Unsupported native date format');
  const parsed = new Date(value);
  requireNative(Number.isFinite(parsed.getTime()), 'Invalid native date');
  const expected = match[2] ? match[1] + 'T' + match[2] + '.' + (match[3] || '').padEnd(3, '0') + 'Z' : match[1] + 'T00:00:00.000Z';
  requireNative(parsed.toISOString() === expected, 'Impossible native calendar/time');
  return { raw: value, iso: parsed.toISOString(), precision: match[2] ? match[3] ? 'millisecond' : 'second' : 'day', exact: Boolean(match[2]) };
}

export function readNativeJobPosting(html, row, config) {
  const doc = document(html);
  const bases = doc.nodes(node => node.tag === 'base');
  requireNative(!bases.length || config.allowedAssetBaseHref && bases.length === 1 && Object.keys(bases[0].attrs).length === 1 && bases[0].attrs.href === config.allowedAssetBaseHref, 'Unreviewed job page base URL');
  const postings = [];
  const walk = value => {
    requireNative(value && typeof value === 'object', 'Malformed structured data');
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('JobPosting')) postings.push(value);
    if (value['@graph']) walk(value['@graph']);
  };
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) walk(JSON.parse(script.raw));
  const posting = oneNative(postings, 'native JobPosting');
  requireNative(typeof posting.title === 'string' && norm(posting.title) === norm(row.title), 'Listing/JobPosting title mismatch');
  const visibleTitle = config.visibleTitle(doc);
  requireNative(norm(visibleTitle) === norm(posting.title), 'Visible/JobPosting title mismatch');
  if (config.requireSchemaIdentifier) requireNative(posting.identifier && posting.identifier.value === row.id && posting.identifier.name === config.identifierName, 'Listing/JobPosting identifier mismatch');
  const pageText = config.rolePageText(doc);
  requireNative(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(pageText), 'Native role visibly closed');
  const visibleDescriptionHTML = config.visibleDescriptionHTML(doc);
  requireNative(typeof posting.description === 'string' && plainNativeHTML(posting.description).length >= 100 && plainNativeHTML(visibleDescriptionHTML).length >= 100, 'Missing full native description');
  // Native plain text can omit spaces at paragraph joins. Preserve visible HTML
  // and the exact schema description while comparing all non-space characters.
  const descriptionsMatch = config.compareDescriptions
    ? config.compareDescriptions(visibleDescriptionHTML, posting.description) === true
    : contentKey(visibleDescriptionHTML) === contentKey(posting.description);
  requireNative(descriptionsMatch, 'Visible/JobPosting description mismatch');
  const visibleLocations = config.visibleLocations(doc);
  const locationsMatch = config.compareLocationLabels
    ? config.compareLocationLabels(visibleLocations, row.locations) === true
    : JSON.stringify(visibleLocations.map(key)) === JSON.stringify(row.locations.map(key));
  requireNative(locationsMatch, 'Visible/listing location mismatch');
  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation];
  requireNative(locations.length > 0 && locations.length <= 32, 'Missing native job locations');
  const addresses = locations.map(location => {
    const address = location?.address;
    requireNative(address && typeof address === 'object' && !Array.isArray(address) && typeof address.addressCountry === 'string', 'Missing explicit native country');
    const country = nativeCountryName(address.addressCountry);
    requireNative(country, 'Unrecognized explicit native country');
    return { raw: address, country, nativeCountryRaw: address.addressCountry };
  });
  const hints = row.countries.map(nativeCountryName).filter(Boolean);
  if (hints.length) requireNative(hints.every(country => addresses.some(address => address.country === country)) && addresses.every(address => hints.includes(address.country)), 'Listing/JobPosting country conflict');
  const readDate = config.readNativeDate || nativeDate;
  const posted = readDate(posting.datePosted, { required: true }), closing = readDate(posting.validThrough);
  requireNative(!closing.iso || closing.iso >= posted.iso, 'Native expiry precedes publication');
  const organization = posting.hiringOrganization;
  requireNative(organization && typeof organization.name === 'string' && organization.name.trim(), 'Missing native employer label');
  const applications = config.applicationEvidence(doc, posting, row);
  const fact = {
    id: row.id, title: norm(visibleTitle), sourceURL: row.url, nativeListingRecord: row,
    nativeJobPosting: posting, nativeJobPostingIdentifier: posting.identifier ?? null,
    nativeHiringOrganization: organization, nativeCountryAddresses: addresses,
    nativeVisibleLocationTexts: visibleLocations, nativeSchemaDescription: posting.description,
    nativeVisibleDescriptionHTML: visibleDescriptionHTML, nativePostedDate: posted,
    nativeValidThrough: closing, nativeDirectApplyFlag: posting.directApply ?? null,
    nativeApplicationURL: applications.nativeApplicationURL, internalEmployeeBoardLinks: applications.internalEmployeeBoardLinks || [],
    applicationsVisited: false, firstEverPublication: null, legalEmployer: null,
    sourceRequisitionID: null, sourceScopeComplete: false,
  };
  if (!config.acceptedHiringOrganizations.some(name => key(name) === key(organization.name))) return { ...fact, excluded: true, exclusionReason: 'native-employer-outside-configured-brand' };
  if (!addresses.some(address => address.country === 'India')) return { ...fact, excluded: true, exclusionReason: 'native-explicit-non-India-country' };
  return fact;
}

export function nativePostingJobs(result, config) {
  // Retain the complete batch once. Repeating raw responses and every detail
  // on every projected job makes serialization grow with jobs times inventory.
  const { jobs, listingRecords, retainedResponses, unknownRawFailures, exclusions, ...summary } = result;
  const compact = {
    ...summary, extractedDetailJobs: jobs.length, listingRecordCount: listingRecords.length,
    unknownRawFailureCount: unknownRawFailures.length, excludedDetailJobs: exclusions.length,
    fullBatchEvidenceOnFirstExtractedJob: true, firstExtractedJobID: jobs[0]?.id ?? null,
    ...(config.compactResponseReferences === true
      ? { retainedResponseCount: retainedResponses.length, retainedResponsesOnFirstExtractedJob: true }
      : { retainedResponses: retainedResponses.map(({ url, status, bodyBytes, bodySHA256, requestedAt, completedAt }) => ({ url, status, bodyBytes, bodySHA256, requestedAt, completedAt })) }),
  };
  return result.jobs.map((fact, index) => {
    const india = fact.nativeCountryAddresses.filter(address => address.country === 'India');
    const labels = india.map(({ raw }) => [...new Set([raw.addressLocality, raw.addressRegion, 'India'].filter(value => typeof value === 'string' && value.trim()))].join(', '));
    return {
      id: fact.id, jobId: fact.id, requisitionId: null, source: config.source, company: config.companyName,
      title: fact.title, sourceUrl: fact.sourceURL, applyUrl: fact.nativeApplicationURL,
      link: fact.nativeApplicationURL || fact.sourceURL, nativeApplicationURL: fact.nativeApplicationURL,
      applicationLinkSource: fact.nativeApplicationURL ? 'native-public-application-link' : 'public-role-page-fallback',
      applicationVisited: false, nativeDirectApplyFlag: fact.nativeDirectApplyFlag,
      country: 'India', city: india.length === 1 ? india[0].raw.addressLocality ?? null : null,
      location: [...new Set(labels)].join(' / '), nativeCountryAddresses: fact.nativeCountryAddresses,
      postingDate: fact.nativePostedDate.raw, postedAt: fact.nativePostedDate.raw,
      closingDate: fact.nativeValidThrough.raw, sourceClosingDateIsExact: fact.nativeValidThrough.exact,
      nativePublicationDate: fact.nativePostedDate.raw, nativePublicationPrecision: fact.nativePostedDate.precision,
      firstEverPublication: null, legalEmployer: null, nativeHiringOrganization: fact.nativeHiringOrganization,
      jobDescription: fact.nativeVisibleDescriptionHTML, sourceDescription: fact.nativeVisibleDescriptionHTML,
      nativeSchemaDescription: fact.nativeSchemaDescription, nativeVisibleDescriptionHTML: fact.nativeVisibleDescriptionHTML,
      sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceListingComplete: false,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, publicEligibility: null,
      nativeFacts: fact, nativeCollectionEvidence: index === 0 ? result : compact,
    };
  });
}
