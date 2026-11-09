import crypto from 'node:crypto';
import { HOME, PORTAL, BOARD, verifyHandoff, parseListing, parseDetail, detailURL } from './parser.js';
import { createNativeTransport, validateURL, redirectURL, MAX_BYTES } from './transport.js';
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js';
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const data = (value, key) => { for (let n = 0; value && typeof value === 'object' && n < 5; n++) { try { const field = Object.getOwnPropertyDescriptor(value, key); if (field) return field.value; value = Object.getPrototypeOf(value); } catch { return undefined; } } };
const clean = value => typeof value === 'string' ? value.slice(0, 4096).replace(/https?:\/\/[^\s<>]+/gi, '[url]').replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[redacted]').replace(/\b(?:password|secret|authorization|cookie|api[-_]?key|token)\s*[:=]\s*[^\s,;]+/gi, '[redacted]').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 320) : null;
function reason(error, depth = 0, seen = new Set()) {
  if (!error || typeof error !== 'object' || depth > 2 || seen.has(error)) return null;
  seen.add(error); const name = data(error, 'name'), code = data(error, 'code');
  return { name: typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(name) ? name : null, message: clean(data(error, 'message')), code: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null, cause: depth < 2 ? reason(data(error, 'cause'), depth + 1, seen) : null };
}
export async function collect(options = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000);
  const transport = options.transport || createNativeTransport({ ...options, signal });
  const result = { status: 'unknown', facts: [], jobs: [], failures: [], unknownRawFailures: [], retainedResponses: [], observedListingCount: null, publicLocationCandidates: null, rawJobs: null, indiaJobs: null, eligibleJobs: null, savedJobs: null, visibleJobs: null, cleanupAllowed: false, verifiedZeroInventory: false, sourceScopeComplete: false, wholeCompanyScope: false, legalEmployer: null };
  const failure = (stage, error, rawCandidate = null) => { result.failures.push({ stage, ...reason(error) }); if (rawCandidate) result.unknownRawFailures.push({ stage, candidate: rawCandidate }); };
  let requests = 0, totalBytes = 0;
  const read = async url => {
    let current = url; const seen = new Set();
    for (let hop = 0; hop <= 3; hop++) {
      validateURL(current); signal.throwIfAborted();
      if (++requests > 256 || seen.has(current)) throw Error('Garena request/redirect bound'); seen.add(current);
      const response = await transport(current, { method: 'GET', redirect: 'manual', credentials: 'omit', signal });
      if (!response || response.url !== current || response.bodyComplete !== true || !Number.isInteger(response.status) || !response.headers || Array.isArray(response.headers) || !(response.body instanceof Uint8Array)) throw Error('Incomplete Garena transport identity');
      const body = Buffer.from(response.body); totalBytes += body.length;
      if (body.length > MAX_BYTES || totalBytes > 32 * 1024 * 1024) throw Error('Garena aggregate/body bound');
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
      if (Object.keys(headers).length !== Object.keys(response.headers).length) throw Error('Duplicate response header casing');
      result.retainedResponses.push({ url: current, status: response.status, bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: body.toString('base64'), provenance: response.provenance || null });
      if ([301, 302, 303, 307, 308].includes(response.status)) { if (hop === 3) throw Error('Garena redirect depth'); current = redirectURL(current, headers.location); continue; }
      if (response.status !== 200) throw Object.assign(Error('HTTP ' + response.status + ' Garena upstream response'), { code: 'GARENA_HTTP_ERROR' });
      if (typeof headers['content-type'] !== 'string' || headers['content-type'].split(';')[0].trim().toLowerCase() !== 'text/html') throw Error('Unexpected Garena content type');
      const html = new TextDecoder('utf-8', { fatal: true }).decode(body); if (!html.trim()) throw Error('Empty Garena HTML'); return html;
    }
    throw Error('Incomplete Garena redirect');
  };
  let homeHTML, portalHTML, listing;
  try { homeHTML = await read(HOME); } catch (error) { failure('corporate-home', error); return result; }
  try { portalHTML = await read(PORTAL); result.handoff = verifyHandoff(homeHTML, portalHTML); } catch (error) { failure('native-handoff', error); return result; }
  try { listing = parseListing(await read(BOARD)); result.listing = listing; result.observedListingCount = listing.records.length; } catch (error) { failure('native-listing', error); return result; }
  const candidates = listing.records.filter(record => isIndiaJob({ location: record.tags.location.join(' / ') }));
  // The existing public rule also admits Remote. This is a candidate count,
  // never a verified India-country count; every selected detail is still read.
  result.publicLocationCandidates = candidates.length;
  for (const candidate of candidates) {
    let html;
    try { html = await read(detailURL(candidate.id)); const fact = parseDetail(html, candidate); result.facts.push(fact); result.jobs.push(fact); }
    catch (error) { failure('native-detail', error, { ...candidate, rawDetailHTML: html || null }); }
  }
  try { const closing = parseListing(await read(BOARD)); if (JSON.stringify(closing.records) !== JSON.stringify(listing.records)) throw Error('Native inventory changed during check'); result.closingInventoryMatches = true; }
  catch (error) { result.closingInventoryMatches = false; failure('closing-inventory', error); }
  result.status = result.failures.length ? 'partial' : 'native-serialized-board-and-details-read';
  return result;
}
export function toJobs(result) {
  return result.jobs.map(fact => ({
    id: fact.id, jobId: fact.id, requisitionId: null, company: 'Garena', source: 'garena', title: fact.title,
    location: fact.nativeTags.location.join(' / '), nativeLocations: fact.nativeTags.location, country: null, nativeCountryRaw: null,
    locationSelectionPolicy: 'existing-unchanged-public-location-scope', sourceUrl: fact.sourceURL,
    applyUrl: fact.nativeApplicationURL, link: fact.nativeApplicationURL || fact.sourceURL, nativeApplicationURL: fact.nativeApplicationURL,
    applicationLinkSource: fact.nativeApplicationURL ? 'native-explicit-application-url' : 'public-role-page-fallback', applicationVisited: false,
    jobDescription: fact.nativeJobDescriptionHTML + '\n<h2>Job Requirements</h2>\n' + fact.nativeJobRequirementsHTML,
    sourceDescription: fact.nativeJobDescriptionHTML + '\n<h2>Job Requirements</h2>\n' + fact.nativeJobRequirementsHTML,
    nativeJobDescriptionHTML: fact.nativeJobDescriptionHTML, nativeJobRequirementsHTML: fact.nativeJobRequirementsHTML,
    postingDate: null, postedAt: null, closingDate: null, nativePublicationDate: null, firstEverPublication: null, legalEmployer: null,
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, publicEligibility: null,
    nativeFacts: fact, nativeCollectionEvidence: result,
  }));
}
export async function runNative(options = {}) {
  const result = await collect(options);
  if (!result.jobs.length && result.failures.length) throw Object.assign(Error('Garena native collection incomplete; cleanup forbidden'), { name: 'GarenaIncompleteError', code: 'GARENA_NATIVE_INCOMPLETE', nativeEvidence: result });
  const jobs = attachInventoryEvidence(toJobs(result), { status: 'coverage-gap', firstParty: Boolean(result.handoff), surface: BOARD, listingComplete: false, pagesFetched: result.retainedResponses.length, reportedTotal: result.observedListingCount, indiaFacetCount: null, verifiedAt: null, reason: 'native-serialized-client-inventory;existing-public-India-location-rule;legal-employer-and-whole-company-coverage-unknown;cleanup-forbidden;state=' + result.status });
  Object.defineProperty(jobs, Symbol.for('jobverify.garena-native-evidence'), { value: result });
  return jobs;
}
