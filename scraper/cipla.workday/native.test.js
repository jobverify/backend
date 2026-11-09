import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { parseNativeRole } from '../../scraper-support/shared/rmkNativePair.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-076.json.gz', import.meta.url))));
const nativeConfig = { source: 'cipla', companyName: 'Cipla', origin: 'https://careers.cipla.com', companyToken: 'C0001172882P', nativeEmployer: 'Cipla Limited', requisitionProperty: 'customfield5', caseInsensitiveNativeCountryCodes: true };
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const fixtureTransport = () => {
  const indices = new Map();
  return async url => {
    const index = indices.get(url) || 0, response = fixture.responseQueues[url]?.[index];
    if (!response) throw Object.assign(Error('Actual Cipla detail body was not retained'), { code: 'FIXTURE_UNRETAINED' });
    indices.set(url, index + 1); return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  };
};
test('selected Cipla catalog source extracts the complete captured India role instead of returning a placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'cipla')).run({ transport: fixtureTransport() });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.nativeRequisitionID);
  assert.equal(jobs[0].nativePublicJobId, fixture.oracle.publicJobID);
});
test('opt-in RMK country normalization preserves native In while corroborating explicit India', () => {
  let job;
  assert.doesNotThrow(() => { job = parseNativeRole(body(fixture.oracle.roleURL), fixture.oracle.listingRow, nativeConfig, fixture.oracle.originalClosingCaptureAt); });
  assert.equal(job.nativeLocations[0].addressCountry, 'In');
  assert.equal(job.nativeLocations[0].nativeCountryCode, 'IN');
  assert.equal(job.country, 'India');
});

test('all67 actual tile rows reconcile across three pages with responsive duplicates removed', async () => {
  const { createSourceConfig, SEARCH, API, validateURL } = await import('./parser.js');
  const config = createSourceConfig(), pages = [SEARCH, API + '25', API + '50'].map(url => config.parseListing(body(url), url));
  assert.deepEqual(pages.map(page => page.observedRows), [25, 25, 17]);
  assert.deepEqual(pages.map(page => page.pageNumber), [1, 2, 3]);
  assert.ok(pages.every(page => page.reportedTotal === 67 && page.errors.length === 0));
  const rows = pages.flatMap(page => page.records); assert.equal(new Set(rows.map(row => row.id)).size, 67);
  assert.equal(rows.find(row => row.id === fixture.oracle.publicJobID).requisitionId, '107455');
  assert.equal(rows.find(row => row.id === '1368146666').nativeFields.dateLabel, '30 Sept 2026');
  assert.equal(rows.find(row => row.id === '1368146666').nativePostedDay, '2026-09-30');
  const foreign = rows.find(row => row.countryCode === 'US'); assert.ok(foreign); assert.equal(config.candidateForIndia(foreign), false);
  assert.equal(pages[2].nextURL, null); assert.equal(pages[2].terminationKnown, true);
  for (const url of [SEARCH, API + '25', fixture.oracle.roleURL]) validateURL(url);
  for (const url of ['https://evil.example/search/', 'https://careers.cipla.com/talentcommunity/apply/1368751266/?locale=en_GB', SEARCH + '?q=India', API + '26', API + '25&country=US']) assert.throws(() => validateURL(url));
});

test('native four-letter September labels retain calendar validation', async () => {
  const { createSourceConfig, SEARCH, API } = await import('./parser.js');
  const config = createSourceConfig(); config.parseListing(body(SEARCH), SEARCH);
  const page = config.parseListing(body(API + '50').replaceAll('30 Sept 2026', '31 Sept 2026'), API + '50');
  assert.ok(page.errors.some(error => /Invalid native posting day/.test(error.message)));
});

test('native identity, source dates, complete description and application handoff survive projection', async () => {
  const { runNative } = await import('./native.js');
  const calls = [], delegate = fixtureTransport();
  const jobs = await runNative({ transport: async url => { calls.push(url); return delegate(url); } });
  const job = jobs[0];
  assert.equal(job.requisitionId, '107455'); assert.equal(job.nativePublicJobId, '1368751266');
  assert.equal(job.postingDate, '2026-10-13T00:00:00.000Z');
  assert.equal(job.closingDate, '2026-10-30T23:59:00.000Z');
  assert.equal(job.nativeDatePosted, fixture.oracle.nativeDatePosted);
  assert.equal(job.nativeValidThrough, fixture.oracle.nativeValidThrough);
  assert.ok(job.nativeDescriptionHTML.includes('Job Purpose')); assert.ok(job.nativeDescriptionHTML.includes('Accountabilit'));
  assert.ok(job.nativeDescriptionHTML.length > 1000);
  assert.equal(job.applyUrl, 'https://careers.cipla.com/talentcommunity/apply/1368751266/?locale=en_GB');
  assert.equal(job.sourceDetailComplete, true); assert.equal(job.sourceListingComplete, false);
  assert.equal(job.lifecycleCleanupAllowed, false); assert.equal(job.originalPublicationDate, null);
  assert.ok(calls.every(url => !url.includes('/talentcommunity/') && !url.includes('/login')));
  assert.equal(job.nativeCollectionEvidence.observedListingCount, 67);
  assert.equal(job.nativeCollectionEvidence.listingPaginationComplete, true);
  assert.equal(job.nativeCollectionEvidence.closingInventoryMatches, true);
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs(jobs, { now: new Date(fixture.oracle.originalClosingCaptureAt) });
  assert.equal(analysis.eligibleJobs.length, 1);
});

test('native tenant, requisition and employer disagreements are rejected', async () => {
  const { parseDetail, verifyHome, HOME } = await import('./parser.js');
  assert.throws(() => verifyHome(body(HOME).replaceAll('C0001172882P', 'OTHER_TENANT')));
  assert.throws(() => parseDetail(body(fixture.oracle.roleURL), { ...fixture.oracle.listingRow, requisitionId: '107456', nativePostedDay: '2026-10-13' }));
  assert.throws(() => parseDetail(body(fixture.oracle.roleURL).replaceAll('Cipla Limited', 'Other Employer'), { ...fixture.oracle.listingRow, nativePostedDay: '2026-10-13' }));
  assert.throws(() => parseNativeRole(body(fixture.oracle.roleURL), fixture.oracle.listingRow, { ...nativeConfig, caseInsensitiveNativeCountryCodes: false }));
});

test('a source date disagreement is never refreshed from the listing or observation clock', async () => {
  const { parseDetail } = await import('./parser.js');
  const html = body(fixture.oracle.roleURL).replace(fixture.oracle.nativeDatePosted, 'Mon Oct 12 00:00:00 UTC 2026');
  assert.throws(() => parseDetail(html, { ...fixture.oracle.listingRow, nativePostedDay: '2026-10-13' }), /publication/);
});

test('missing descriptions and an upstream failure remain incomplete rather than verified zero', async () => {
  const { parseDetail } = await import('./parser.js');
  const { collect } = await import('./native.js');
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const html = body(fixture.oracle.roleURL), doc = document(html), description = doc.nodes(node => node.attrs.itemprop === 'description')[0];
  const empty = html.slice(0, description.openEnd) + html.slice(description.closeStart);
  assert.throws(() => parseDetail(empty, { ...fixture.oracle.listingRow, nativePostedDay: '2026-10-13' }), /description/);
  const delegate = fixtureTransport(), result = await collect({ transport: async url => url === fixture.oracle.roleURL
    ? { url, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Temporary upstream failure'), bodyComplete: true, provenance: { derivedSyntheticFailureTest: true } }
    : delegate(url) });
  assert.equal(result.jobs.length, 0); assert.equal(result.cleanupAllowed, false); assert.equal(result.verifiedZeroInventory, false);
  assert.ok(result.failures.some(failure => /503/.test(failure.message)));
});

test('unknown or conflicting native model totals do not establish an empty inventory', async () => {
  const { createSourceConfig, SEARCH } = await import('./parser.js');
  const html = body(SEARCH);
  assert.throws(() => createSourceConfig().parseListing(html.replace('jobRecordsFound: parseInt("67")', 'jobRecordsFound: parseInt("0")'), SEARCH));
  assert.throws(() => createSourceConfig().parseListing(html.replace('jobRecordsFound: parseInt("67")', 'jobRecordsFound: dynamicTotal()'), SEARCH));
});

test('an explicit empty native tile inventory stays a coverage gap with retained evidence', async () => {
  const { collect } = await import('./native.js');
  const { SEARCH } = await import('./parser.js');
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const html = body(SEARCH), doc = document(html), list = doc.nodes(node => node.attrs.id === 'job-tile-list')[0];
  const zero = (html.slice(0, list.openEnd) + html.slice(list.closeStart)).replace('jobRecordsFound: parseInt("67")', 'jobRecordsFound: parseInt("0")').replace('data-record-returned="25"', 'data-record-returned="0"').replace('aria-rowcount="42"', 'aria-rowcount="0"');
  const delegate = fixtureTransport(), result = await collect({ transport: async url => url === SEARCH
    ? { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(zero), bodyComplete: true, provenance: { derivedSyntheticZeroTest: true } }
    : delegate(url) });
  assert.equal(result.jobs.length, 0); assert.equal(result.nativeReportedTotal, 0);
  assert.equal(result.listingPaginationComplete, true); assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.retainedResponses.length, 3); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
});
