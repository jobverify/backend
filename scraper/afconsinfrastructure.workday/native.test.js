import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-078.json.gz', import.meta.url))));
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const fixtureTransport = () => {
  const indices = new Map();
  return async url => {
    const index = indices.get(url) || 0, response = fixture.responseQueues[url]?.[index];
    if (!response) throw Object.assign(Error('Actual Afcons detail response was not retained'), { code: 'FIXTURE_UNRETAINED' });
    indices.set(url, index + 1); return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  };
};
test('selected Afcons catalog source extracts the complete retained India-wide role instead of a placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(p => p.source === 'afconsinfrastructure')).run({ transport: fixtureTransport() });
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, '2254'); assert.equal(jobs[0].nativePublicJobId, '33708144');
});

async function pagesAndRows() {
  const { createSourceConfig, SEARCH, API } = await import('./parser.js');
  const config = createSourceConfig(), pages = [SEARCH, API + '25', API + '50'].map(url => config.parseListing(body(url), url));
  return { config, pages, rows: pages.flatMap(page => page.records) };
}
test('all66 native tiles reconcile while Bangladesh/IN conflict stays separate from India, abroad and Rwanda', async () => {
  const { config, pages, rows } = await pagesAndRows();
  assert.deepEqual(pages.map(page => page.observedRows), [25, 25, 16]);
  assert.ok(pages.every(page => page.reportedTotal === 66));
  assert.equal(rows.length, 65); assert.equal(new Set(rows.map(row => row.id)).size, 65);
  assert.equal(pages.flatMap(page => page.errors).length, 1);
  assert.match(pages.flatMap(page => page.errors)[0].message, /country.*conflict/i);
  assert.equal(rows.filter(row => row.locationScope === 'india-wide').length, 52);
  assert.equal(rows.filter(row => row.locationScope === 'india-or-abroad').length, 12);
  assert.equal(rows.filter(config.candidateForIndia).length, 64);
  assert.equal(config.candidateForIndia(rows.find(row => row.countryCode === 'RW')), false);
  assert.equal(pages.at(-1).nextURL, null);
});
test('country-wide India preserves raw geography and never becomes a city or a guessed state', async () => {
  const { parseDetail } = await import('./parser.js'), { rows } = await pagesAndRows(), row = rows.find(row => row.id === '33708144');
  const job = parseDetail(body(row.url), row);
  assert.equal(job.country, 'India'); assert.equal(job.city, null); assert.equal(job.location, 'India'); assert.deepEqual(job.locations, ['India']);
  assert.equal(job.nativeLocations[0].addressLocality, 'India'); assert.equal(job.nativeLocations[0].addressRegion, 'Any ');
  assert.equal(job.nativeListingRecord.locations[0], 'India, Any Where In India, IN');
  assert.equal(job.nativeIndiaLocationGranularity, 'country-only'); assert.equal(job.nativeRegionLabelMeaningKnown, false);
  assert.equal(job.requisitionId, '2254'); assert.equal(job.nativeDetailRequisitionID, null);
  assert.equal(job.nativeRequisitionEvidence, 'explicit-native-listing-Job-Req-ID;detail-field-unavailable');
});
test('complete source description, native timestamps and public application identity survive projection', async () => {
  const { runNative } = await import('./native.js'); const calls = [], delegate = fixtureTransport();
  const jobs = await runNative({ transport: async url => { calls.push(url); return delegate(url); } }), job = jobs[0];
  assert.equal(job.postingDate, fixture.oracle.postingDate); assert.equal(job.nativeDatePosted, fixture.oracle.rawDatePosted);
  assert.equal(job.closingDate, null); assert.equal(job.originalPublicationDate, null);
  assert.ok(job.sourceDescription.includes('Roles and Responsibilities')); assert.ok(job.sourceDescription.length > 11000);
  assert.equal(job.sourceDetailComplete, true); assert.equal(job.sourceListingComplete, false); assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(job.applyUrl, 'https://careers.afcons.com/talentcommunity/apply/33708144/?locale=en_US');
  assert.ok(calls.every(url => url.startsWith('https://careers.afcons.com/') && !url.includes('/talentcommunity/') && !url.includes('/login')));
  assert.equal(job.nativeCollectionEvidence.observedListingCount, 66); assert.equal(job.nativeCollectionEvidence.closingInventoryMatches, true);
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs(jobs, { now: new Date(fixture.oracle.originalClosingCaptureAt) });
  assert.equal(analysis.eligibleJobs.length, 1);
});
test('generic listing and visible Date labels never refresh an earlier native datePosted', async () => {
  const { parseDetail } = await import('./parser.js'), { rows } = await pagesAndRows(), row = rows.find(row => row.id === '33708144');
  const job = parseDetail(body(row.url).replace(fixture.oracle.rawDatePosted, 'Sun Sep 20 02:00:00 UTC 2026'), row);
  assert.equal(job.postingDate, '2026-09-20T02:00:00.000Z'); assert.equal(job.nativeListingDateDay, '2026-10-22');
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs([job], { now: new Date(fixture.oracle.originalClosingCaptureAt) });
  assert.equal(analysis.eligibleJobs.length, 0); assert.equal(analysis.filterCounts.old, 1);
});
test('India-or-abroad placement remains unqualified rather than assigned to an invented India city', async () => {
  const { parseDetail } = await import('./parser.js'), { rows } = await pagesAndRows(), row = rows.find(row => row.id === '58239544');
  assert.throws(() => parseDetail(body(fixture.oracle.abroadRoleURL), row), error => error.code === 'NATIVE_SCOPE_UNKNOWN');
});
test('native portal identity, country label/code and employer mismatches fail explicitly', async () => {
  const { verifyHome, HOME, parseLocation, parseDetail } = await import('./parser.js');
  assert.throws(() => verifyHome(body(HOME).replaceAll("'afconsinfr'", "'OTHER_TENANT'")));
  assert.throws(() => verifyHome(body(HOME).replaceAll('https://www.afcons.com/', 'https://impostor.example/')));
  assert.throws(() => parseLocation('Bangladesh, Bangladesh, IN'), /country.*conflict/i);
  const { rows } = await pagesAndRows(), row = rows.find(row => row.id === '33708144');
  assert.throws(() => parseDetail(body(row.url).replace('content="Afcons Infrastructure Limited"', 'content="Other Employer"'), row));
});
test('missing descriptions and missing native publication dates stay incomplete', async () => {
  const { parseDetail } = await import('./parser.js'), { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const { rows } = await pagesAndRows(), row = rows.find(row => row.id === '33708144'), html = body(row.url), doc = document(html), description = doc.nodes(node => node.attrs.itemprop === 'description')[0], posted = doc.nodes(node => node.attrs.itemprop === 'datePosted')[0];
  assert.throws(() => parseDetail(html.slice(0, description.openEnd) + html.slice(description.closeStart), row), /description/i);
  assert.throws(() => parseDetail(html.replace(doc.outer(posted), ''), row), /publication/i);
});
test('partial runs retain positive jobs and distinct native geography failures without authorizing cleanup', async () => {
  const { collect } = await import('./native.js'); const result = await collect({ transport: fixtureTransport() });
  assert.equal(result.jobs.length, 1); assert.equal(result.observedListingCount, 66); assert.equal(result.pagesFetched, 3);
  assert.equal(result.listingPaginationComplete, false); assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
  assert.ok(result.failures.some(failure => failure.stage === 'native-listing-row' && /country.*conflict/i.test(failure.message)));
  assert.ok(result.failures.some(failure => failure.code === 'NATIVE_SCOPE_UNKNOWN'));
});
test('upstream503 never becomes a verified empty result', async () => {
  const { collect } = await import('./native.js'); const delegate = fixtureTransport();
  const result = await collect({ transport: async url => url === fixture.oracle.roleURL
    ? { url, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Temporary native upstream failure'), bodyComplete: true, provenance: { syntheticUpstreamFailureTest: true } }
    : delegate(url) });
  assert.equal(result.jobs.length, 0); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
  assert.ok(result.failures.some(failure => /503/.test(failure.message)));
});
test('literal model, native Job Req ID labels and public read URLs cannot silently change scope', async () => {
  const { createSourceConfig, SEARCH, API, validateURL } = await import('./parser.js');
  assert.throws(() => createSourceConfig().parseListing(body(SEARCH).replace('jobRecordsFound: parseInt("66")', 'jobRecordsFound: dynamicTotal()'), SEARCH));
  assert.equal(createSourceConfig().parseListing(body(SEARCH).replaceAll('Job Req ID', 'Facility'), SEARCH).errors.length, 25);
  for (const url of [SEARCH, API + '25', fixture.oracle.roleURL]) validateURL(url);
  for (const url of [API + '26', API + '25&country=IN', SEARCH + '?q=India', 'https://www.afcons.com/', 'https://careers.afcons.com/talentcommunity/apply/33708144/?locale=en_US']) assert.throws(() => validateURL(url));
});
test('derived explicit empty tile inventory is retained as a coverage gap rather than company-wide verified zero', async () => {
  const { collect } = await import('./native.js'), { SEARCH } = await import('./parser.js');
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const html = body(SEARCH), doc = document(html), list = doc.nodes(node => node.attrs.id === 'job-tile-list')[0];
  const zero = (html.slice(0, list.openEnd) + html.slice(list.closeStart)).replace('jobRecordsFound: parseInt("66")', 'jobRecordsFound: parseInt("0")').replace('data-record-returned="25"', 'data-record-returned="0"').replace('aria-rowcount="41"', 'aria-rowcount="0"');
  const delegate = fixtureTransport(), result = await collect({ transport: async url => url === SEARCH
    ? { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(zero), bodyComplete: true, provenance: { derivedSyntheticZeroTest: true } }
    : delegate(url) });
  assert.equal(result.jobs.length, 0); assert.equal(result.nativeReportedTotal, 0); assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.closingInventoryMatches, true); assert.equal(result.retainedResponses.length, 3);
  assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
});
