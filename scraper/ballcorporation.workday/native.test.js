import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-081.json.gz', import.meta.url))));
const liveFailures = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-081-live-failures.json.gz', import.meta.url))));
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const transport = async url => {
  const response = fixture.responseQueues[url]?.[0];
  if (!response) throw Object.assign(Error('Ball grouped candidate detail was not retained in this fixture'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
async function listing() {
  const { createSourceConfig, SEARCH } = await import('./parser.js'); const config = createSourceConfig(), pages = []; let url = SEARCH;
  while (url) { const page = config.parseListing(body(url), url); pages.push(page); url = page.nextURL; }
  return { config, pages, rows: pages.flatMap(page => page.records) };
}
test('selected Ball catalog source extracts two retained India roles instead of placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'ballcorporation')).run({ transport });
  assert.equal(jobs.length, 2); assert.deepEqual(jobs.map(job => job.jobId), ['49765', '51235']);
});
test('all266native rows reconcile across eleven scoped pages and every grouped foreign row gets a detail check', async () => {
  const { rows, pages, config } = await listing(); assert.deepEqual(pages.map(page => page.observedRows), [...Array(10).fill(25), 16]);
  assert.ok(pages.every(page => page.reportedTotal === 266)); assert.equal(rows.length, 266); assert.equal(new Set(rows.map(row => row.id)).size, 266);
  assert.equal(rows.filter(row => row.countryCode === 'IN').length, 2); assert.equal(rows.filter(config.candidateForIndia).length, 22); assert.equal(pages.at(-1).nextURL, null);
  assert.equal(pages[0].nextURL, 'https://jobs.ball.com/corp_packaging/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=25');
});
test('Bangalore is corroborated while an unshown schema city stays raw and never becomes an invented canonical city', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js');
  const cityRow = rows.find(row => row.url === fixture.oracle.companySecretaryURL), city = parseDetail(body(cityRow.url), cityRow);
  assert.equal(city.city, 'Bangalore'); assert.equal(city.nativeCityCorroborationComplete, true); assert.equal(city.nativePublicJobId, '1409029300');
  const row = rows.find(row => row.url === fixture.oracle.frontEndURL), job = parseDetail(body(row.url), row);
  assert.equal(job.country, 'India'); assert.equal(job.city, null); assert.equal(job.location, 'India'); assert.deepEqual(job.locations, ['India']);
  assert.equal(job.nativeLocations[0].addressCountry, 'IN'); assert.equal(job.nativeLocations[0].addressLocality, 'Bhurai In');
  assert.equal(job.nativeLocations[0].addressRegion, 'MH'); assert.equal(job.nativeLocations[0].postalCode, '410208');
  assert.deepEqual(job.nativeVisibleLocations, ['MH, IN, 410208']); assert.equal(job.nativeCityCorroborationComplete, false); assert.equal(job.nativeRemoteWorkKnown, false);
  assert.equal(job.jobId, '51235'); assert.equal(job.nativePublicJobId, '1439035100'); assert.equal(job.requisitionId, '51235');
});
test('native UTC dates, exact expiry, complete descriptions and public application identities survive projection', async () => {
  const { runNative } = await import('./native.js'); const calls = [];
  const jobs = await runNative({ transport: async url => { calls.push(url); return transport(url); } });
  assert.equal(jobs[0].postingDate, fixture.oracle.firstPostingDate); assert.equal(jobs[0].closingDate, null);
  assert.equal(jobs[1].postingDate, fixture.oracle.secondPostingDate); assert.equal(jobs[1].closingDate, fixture.oracle.secondClosingDate); assert.equal(jobs[1].sourceClosingDateIsExact, true);
  assert.ok(jobs[0].sourceDescription.includes('key responsibilities')); assert.ok(jobs[1].sourceDescription.includes('Essential Responsible Areas'));
  assert.ok(jobs[1].sourceDescription.length > 14000);
  assert.equal(jobs[0].applyUrl, 'https://jobs.ball.com/talentcommunity/apply/1409029300/?locale=en_GB');
  assert.equal(jobs[1].applyUrl, 'https://jobs.ball.com/talentcommunity/apply/1439035100/?locale=en_GB');
  assert.ok(calls.every(url => !/talentcommunity|login|subscribe|profile/.test(url)));
  assert.ok(jobs.every(job => job.applicationVisited === false && job.lifecycleCleanupAllowed === false && job.sourceDetailComplete === true && job.sourceListingComplete === false));
});
test('foreign grouped candidates remain outside India only when both typed and visible country evidence agree', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.foreignURL), html = body(row.url);
  const result = parseDetail(html, row); assert.equal(result.excluded, true); assert.equal(result.reason, 'native-typed-and-visible-addresses-all-outside-India');
  assert.equal(result.nativeAddresses.length, 2); assert.ok(result.nativeAddresses.every(address => address.addressCountry === 'US'));
  assert.throws(() => parseDetail(html.replace('itemprop="addressCountry" content="US"', 'itemprop="addressCountry" content="IN"'), row));
});
test('country, region, postal, title and employer contradictions cannot be repaired by URL or city guesses', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.frontEndURL), html = body(row.url);
  for (const [from, to] of [['content="IN"', 'content="US"'], ['content="MH"', 'content="KA"'], ['content="410208"', 'content="999999"'], ['content="Ball"', 'content="Other Employer"'], ["'ballcorpor'", "'WRONG'"]]) {
    assert.ok(html.includes(from), from); assert.throws(() => parseDetail(html.replaceAll(from, to), row), undefined, from);
  }
  const doc = document(html), title = doc.nodes(node => node.attrs.itemprop === 'title')[0];
  assert.throws(() => parseDetail(html.replace(doc.outer(title), doc.outer(title).replace('Front End Operator', 'Different Role')), row));
});
test('missing native descriptions and publication timestamps remain incomplete', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.companySecretaryURL), html = body(row.url), doc = document(html);
  const description = doc.nodes(node => node.attrs.itemprop === 'description')[0], posted = doc.nodes(node => node.attrs.itemprop === 'datePosted')[0];
  assert.throws(() => parseDetail(html.slice(0, description.openEnd) + html.slice(description.closeStart), row), /description/i);
  assert.throws(() => parseDetail(html.replace(doc.outer(posted), ''), row), /publication/i);
});
test('source publication age is preserved and impossible calendar values fail', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.companySecretaryURL), html = body(row.url);
  const old = parseDetail(html.replace('Sat Oct 17 07:00:00 UTC 2026', 'Sun Sep 20 07:00:00 UTC 2026'), row); assert.equal(old.postingDate, '2026-09-20T07:00:00.000Z');
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs([old], { now: new Date(fixture.oracle.observationAt) });
  assert.equal(analysis.eligibleJobs.length, 0); assert.equal(analysis.filterCounts.old, 1);
  assert.throws(() => parseDetail(html.replace('Sat Oct 17 07:00:00 UTC 2026', 'Sat Feb 31 07:00:00 UTC 2026'), row));
});
test('representative fixture keeps two positive rows, one foreign exclusion and19unretained groups separate without authorizing cleanup', async () => {
  const result = await (await import('./native.js')).collect({ transport });
  assert.equal(result.jobs.length, 2); assert.equal(result.exclusions.length, 1); assert.equal(result.candidateDetails, 22); assert.equal(result.observedListingCount, 266);
  assert.equal(result.listingPaginationComplete, true); assert.equal(result.closingInventoryMatches, true); assert.equal(result.failures.filter(failure => failure.code === 'FIXTURE_UNRETAINED').length, 19);
  assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
});
test('upstream503 and forbidden application redirects retain failures and never certify zero inventories', async () => {
  const { collect } = await import('./native.js');
  for (const response of [{ status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Upstream unavailable') }, { status: 302, headers: { location: '/talentcommunity/apply/1409029300/?locale=en_GB' }, body: Buffer.alloc(0) }]) {
    const result = await collect({ transport: async url => url === fixture.oracle.companySecretaryURL ? { ...response, url, bodyComplete: true } : transport(url) });
    assert.equal(result.jobs.length, 1); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
    assert.ok(result.retainedResponses.some(retained => retained.status === response.status));
  }
});
test('native company and scoped search handoffs are verified and country/search/application URL changes cannot be read', async () => {
  const { verifyHome, verifyPackaging, validateURL, HOME, PACKAGING, SEARCH } = await import('./parser.js');
  assert.throws(() => verifyHome(body(HOME).replaceAll("'ballcorpor'", "'WRONG'")));
  assert.throws(() => verifyHome(body(HOME).replaceAll('/corp_packaging/?locale=en_US', 'https://impostor.example/')));
  assert.throws(() => verifyPackaging(body(PACKAGING).replaceAll('https://www.ball.com/careers', 'https://impostor.example/')));
  const { config } = await listing(), html = body(SEARCH), doc = document(html), first = doc.nodes(node => node.tag === 'tr' && node.attrs.class === 'data-row')[0];
  assert.throws(() => config.parseListing(html.replace(doc.outer(first), ''), SEARCH));
  for (const url of ['https://jobs.ball.com/search/', SEARCH + '?country=IN', SEARCH + '?q=&sortColumn=referencedate&sortDirection=desc&startrow=26', fixture.oracle.companySecretaryURL + '?country=IN', 'https://jobs.ball.com/talentcommunity/apply/1409029300/?locale=en_GB']) assert.throws(() => validateURL(url));
});
test('all17retained groups reconcile native countries, including three genuine India placements behind foreign primary locations', async () => {
  const { parseDetail } = await import('./parser.js'); assert.equal(liveFailures.cases.length, 17);
  const expectedIndia = { '1368688300': '47633', '1368683500': '47715', '1368684100': '47714' };
  for (const item of liveFailures.cases) {
    const result = parseDetail(item.html, item.row), addresses = result.nativeAddresses || result.nativeLocations;
    if (expectedIndia[item.row.id]) {
      assert.equal(result.country, 'India'); assert.equal(result.jobId, expectedIndia[item.row.id]); assert.equal(result.city, null); assert.equal(result.location, 'India');
      const india = addresses.filter(address => address.nativeCountryCode === 'IN'); assert.equal(india.length, 1); assert.equal(india[0].addressCountry, 'IN');
      assert.equal(india[0].addressLocality, 'Bhurai In'); assert.equal(india[0].addressRegion, 'MH'); assert.equal(india[0].postalCode, '410208');
      assert.ok(result.nativeVisibleLocations.includes('MH, IN, 410208')); assert.equal(result.sourceDetailComplete, true);
    } else {
      assert.equal(result.excluded, true, item.row.id); assert.equal(result.reason, 'native-typed-and-visible-addresses-all-outside-India');
      assert.ok(addresses.every(address => address.nativeCountryCode !== 'IN'));
    }
    assert.equal(addresses.length, item.row.expectedLocationCount);
    const derived = addresses.filter(address => address.addressCountry === null); assert.ok(derived.length > 0);
    assert.ok(derived.every(address => address.addressLocality === null && address.addressRegion === null && address.postalCode === null && typeof address.streetAddress === 'string'));
    if (item.row.id === '1426263500') { assert.equal(result.nativeVisibleCompany, null); assert.equal(result.nativeCompanyLabelAvailable, false); }
  }
});
test('foreign full-streetAddress fallback cannot accept India or uncorroborated labels and missing company cannot admit India', async () => {
  const { parseDetail } = await import('./parser.js'), item = liveFailures.cases.find(entry => entry.row.id === '1386872800');
  assert.throws(() => parseDetail(item.html.replace('content="Dýšina, CZ, 33002"', 'content="Dýšina, IN, 33002"'), item.row));
  assert.throws(() => parseDetail(item.html.replace('content="Dýšina, CZ, 33002"', 'content="Unknown city, CZ, 33002"'), item.row));
  const { rows } = await listing(), row = rows.find(entry => entry.url === fixture.oracle.companySecretaryURL), html = body(row.url), doc = document(html);
  const company = doc.nodes(node => node.attrs['data-careersite-propertyid'] === 'businessunit')[0];
  assert.throws(() => parseDetail(html.replace(doc.outer(company), ''), row));
});
