import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-080.json.gz', import.meta.url))));
const liveFailures = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-080-live-failures.json.gz', import.meta.url))));
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const transport = async url => {
  const response = fixture.responseQueues[url]?.[0];
  if (!response) throw Object.assign(Error('Bekaert candidate detail was not retained in this fixture'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
async function listing() {
  const { createSourceConfig, SEARCH } = await import('./parser.js'); const config = createSourceConfig(), pages = []; let url = SEARCH;
  while (url) { const page = config.parseListing(body(url), url); pages.push(page); url = page.nextURL; }
  return { config, pages, rows: pages.flatMap(page => page.records) };
}
test('selected Bekaert catalog source extracts a complete retained India role instead of placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'bekaert')).run({ transport });
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, '1419019733');
});
test('all109native rows reconcile on five pages and every grouped foreign candidate remains eligible for detail inspection', async () => {
  const { rows, pages, config } = await listing(); assert.deepEqual(pages.map(page => page.observedRows), [25, 25, 25, 25, 9]);
  assert.ok(pages.every(page => page.reportedTotal === 109)); assert.equal(rows.length, 109); assert.equal(new Set(rows.map(row => row.id)).size, 109);
  assert.equal(rows.filter(row => row.countryCode === 'IN').length, 12); assert.equal(rows.filter(config.candidateForIndia).length, 26);
  assert.ok(config.candidateForIndia(rows.find(row => row.url === fixture.oracle.foreignGroupURL))); assert.equal(pages.at(-1).nextURL, null);
});
test('full streetAddress and exact visible location corroborate Pune India while raw typed fields remain null', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), job = parseDetail(body(row.url), row);
  assert.equal(job.city, 'Pune'); assert.equal(job.country, 'India'); assert.equal(job.location, 'Pune, India');
  assert.equal(job.nativeLocations[0].streetAddress, 'Pune, IN'); assert.equal(job.nativeLocations[0].addressCountry, null); assert.equal(job.nativeLocations[0].addressLocality, null);
  assert.match(job.nativeLocations[0].countryEvidence, /streetAddress/); assert.equal(job.requisitionId, null); assert.equal(job.nativePublicJobId, '1419019733');
});
test('nine grouped European addresses reconcile without confusing Romanian PH region for a country or inventing India', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.foreignGroupURL), result = parseDetail(body(row.url), row);
  assert.equal(result.excluded, true); assert.equal(result.reason, 'native-addresses-all-outside-India'); assert.equal(result.nativeAddresses.length, 9);
  const typed = result.nativeAddresses.find(address => address.addressLocality === 'Negoiești');
  assert.equal(typed.addressCountry, 'RO'); assert.equal(typed.addressRegion, 'PH'); assert.equal(typed.nativeCountryCode, 'RO');
  assert.equal(result.nativeAddresses.filter(address => address.addressCountry === null).length, 8);
});
test('native UTC publication, complete source content and public application identity survive projection', async () => {
  const { runNative } = await import('./native.js'); const calls = [];
  const jobs = await runNative({ transport: async url => { calls.push(url); return transport(url); } }), job = jobs[0];
  assert.equal(job.postingDate, fixture.oracle.postingDate); assert.equal(job.nativeDatePosted, fixture.oracle.rawDatePosted);
  assert.equal(job.closingDate, null); assert.equal(job.originalPublicationDate, null); assert.equal(job.requisitionId, null);
  assert.ok(job.sourceDescription.includes('Roles and Responsibilities')); assert.ok(job.sourceDescription.length > 5000);
  assert.equal(job.applyUrl, 'https://jobs.bekaert.com/talentcommunity/apply/1419019733/?locale=en_US');
  assert.ok(calls.every(url => !/talentcommunity|login|subscribe|profile/.test(url))); assert.equal(job.applicationVisited, false);
  assert.equal(job.sourceDetailComplete, true); assert.equal(job.sourceListingComplete, false); assert.equal(job.lifecycleCleanupAllowed, false);
});
test('listing/detail identity, tenant, raw country and visible location disagreements fail rather than being repaired by guesses', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url);
  for (const [from, to] of [['content="Pune, IN"', 'content="Pune, AU"'], ['content="Bekaert NV"', 'content="Other Employer"'], ["'C0000030876P'", "'WRONG'"]]) {
    assert.ok(html.includes(from)); assert.throws(() => parseDetail(html.replace(from, to), row), undefined, from);
  }
  const doc = document(html), geo = doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('jobGeoLocation'))[0];
  const title = doc.nodes(node => node.attrs.itemprop === 'title')[0];
  assert.throws(() => parseDetail(html.replace(doc.outer(title), doc.outer(title).replace('Process Expert R2R', 'Different Role')), row));
  assert.throws(() => parseDetail(html.replace(doc.outer(geo), doc.outer(geo).replace('Pune, IN', 'Mumbai, IN')), row));
});
test('a lost grouped address or duplicated visible location cannot establish complete scope', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.foreignGroupURL), html = body(row.url), doc = document(html);
  const address = doc.nodes(node => node.attrs.itemprop === 'address')[0]; assert.throws(() => parseDetail(html.replace(doc.outer(address), ''), row));
  const geo = doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('jobGeoLocation'))[0];
  assert.throws(() => parseDetail(html.replace(doc.outer(geo), doc.outer(geo) + doc.outer(geo)), row));
});
test('missing descriptions and missing publication metadata stay incomplete', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url), doc = document(html);
  const description = doc.nodes(node => node.attrs.itemprop === 'description')[0], posted = doc.nodes(node => node.attrs.itemprop === 'datePosted')[0];
  assert.throws(() => parseDetail(html.slice(0, description.openEnd) + html.slice(description.closeStart), row), /description/i);
  assert.throws(() => parseDetail(html.replace(doc.outer(posted), ''), row), /publication/i);
});
test('earlier source dates retain their original age and impossible calendar or weekday values fail', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url);
  const old = parseDetail(html.replace(fixture.oracle.rawDatePosted, 'Sun Sep 20 02:00:00 UTC 2026'), row);
  assert.equal(old.postingDate, '2026-09-20T02:00:00.000Z');
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs([old], { now: new Date(fixture.oracle.observedAt) });
  assert.equal(analysis.eligibleJobs.length, 0); assert.equal(analysis.filterCounts.old, 1);
  for (const invalid of ['Thu Feb 31 02:00:00 UTC 2026', 'Fri Oct 22 02:00:00 UTC 2026']) assert.throws(() => parseDetail(html.replace(fixture.oracle.rawDatePosted, invalid), row));
});
test('representative fixture keeps positive and excluded rows distinct from24unretained detail failures', async () => {
  const result = await (await import('./native.js')).collect({ transport });
  assert.equal(result.jobs.length, 1); assert.equal(result.exclusions.length, 1); assert.equal(result.candidateDetails, 26);
  assert.equal(result.observedListingCount, 109); assert.equal(result.listingPaginationComplete, true); assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.failures.filter(failure => failure.code === 'FIXTURE_UNRETAINED').length, 24);
  assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
});
test('upstream503 cannot return a verified empty inventory and responses remain inspectable', async () => {
  const { collect, runNative } = await import('./native.js');
  const failing = async url => url === fixture.oracle.roleURL ? { url, status: 503, body: Buffer.from('Upstream failure'), headers: { 'content-type': 'text/html' }, bodyComplete: true } : transport(url);
  const result = await collect({ transport: failing }); assert.equal(result.jobs.length, 0); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
  assert.ok(result.retainedResponses.some(response => response.status === 503)); await assert.rejects(runNative({ transport: failing }), error => error.code === 'NATIVE_HTML_INCOMPLETE');
});
test('official handoff, native tenant and contiguous pagination are mandatory and application/search scope changes cannot be read', async () => {
  const { verifyCorporate, verifyHome, validateURL, CORPORATE, HOME, SEARCH } = await import('./parser.js');
  assert.throws(() => verifyCorporate(body(CORPORATE).replaceAll('https://jobs.bekaert.com', 'https://impostor.example')));
  assert.throws(() => verifyHome(body(HOME).replaceAll("'C0000030876P'", "'WRONG'")));
  const { config } = await listing(), html = body(SEARCH), doc = document(html), first = doc.nodes(node => node.tag === 'tr' && node.attrs.class === 'data-row')[0];
  assert.throws(() => config.parseListing(html.replace(doc.outer(first), ''), SEARCH));
  for (const url of [SEARCH + '?country=IN', 'https://jobs.bekaert.com/search?startrow=26', fixture.oracle.roleURL + '?country=IN', 'https://jobs.bekaert.com/talentcommunity/apply/1419019733/?locale=en_US']) assert.throws(() => validateURL(url));
});
test('three genuine India roles with Key Activities and Responsibilities retain their full descriptions instead of disappearing', async () => {
  const { parseDetail } = await import('./parser.js');
  for (const id of ['1377498133', '1377482133', '1441876033']) {
    const fixtureCase = liveFailures.cases.find(item => item.row.id === id), job = parseDetail(fixtureCase.html, fixtureCase.row);
    assert.equal(job.jobId, id); assert.equal(job.country, 'India'); assert.equal(job.sourceDetailComplete, true);
    assert.ok(job.sourceDescription.includes('Key Activities and Responsibilities')); assert.ok(job.sourceDescription.length > 6500);
    assert.equal(job.requisitionId, null); assert.equal(job.sourceListingComplete, false);
  }
});
test('typed and visible foreign countries can exclude seven U.S. roles while state/postal conflicts stay unresolved and no India contradiction is bypassed', async () => {
  const { parseDetail } = await import('./parser.js'), cases = liveFailures.cases.filter(item => item.row.countryCode === 'US');
  assert.equal(cases.length, 7);
  for (const item of cases) {
    const result = parseDetail(item.html, item.row);
    assert.equal(result.excluded, true); assert.equal(result.reason, 'native-typed-and-visible-countries-all-outside-India;foreign-address-labels-unreconciled');
    assert.equal(result.foreignAddressLabelsReconciled, false); assert.equal(result.foreignRegionAndPostalEquivalenceKnown, false);
    assert.ok(result.nativeAddresses.every(address => address.addressCountry === 'US')); assert.equal(result.nativeAddresses.length, 2);
    assert.throws(() => parseDetail(item.html.replace('itemprop="addressCountry" content="US"', 'itemprop="addressCountry" content="IN"'), item.row));
    const doc = document(item.html), geo = doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('jobGeoLocation'))[0];
    assert.throws(() => parseDetail(item.html.replace(doc.outer(geo), doc.outer(geo).replace(/US/g, 'IN')), item.row));
  }
});
