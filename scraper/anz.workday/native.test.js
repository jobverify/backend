import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-079.json.gz', import.meta.url))));
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const transport = async url => {
  const response = fixture.responseQueues[url]?.[0];
  if (!response) throw Object.assign(Error('ANZ detail body was not retained in this representative fixture'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
const source = async () => (await import('./parser.js')).createSourceConfig();
const listing = async () => {
  const config = await source(); let url = 'https://careers.anz.com/search/'; const pages = [];
  while (url) { const page = config.parseListing(body(url), url); pages.push(page); url = page.nextURL; }
  return { config, pages, rows: pages.flatMap(page => page.records) };
};

test('selected ANZ catalog source extracts retained complete India descriptions instead of a placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'anz')).run({ transport });
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map(job => job.jobId), ['126564', '126129']);
});

test('all213 native listing rows reconcile across100/100/13 pages and23India rows', async () => {
  const { rows, pages, config } = await listing();
  assert.deepEqual(pages.map(page => page.observedRows), [100, 100, 13]);
  assert.ok(pages.every(page => page.reportedTotal === 213)); assert.equal(rows.length, 213);
  assert.equal(new Set(rows.map(row => row.id)).size, 213);
  assert.equal(rows.filter(config.candidateForIndia).length, 23); assert.equal(rows.filter(row => row.countryCode !== 'IN').length, 190);
  assert.equal(pages.at(-1).nextURL, null);
});

test('native City, IN streetAddress and visible city corroborate India without inventing raw typed address fields', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js');
  for (const [url, city] of [[fixture.oracle.roleURL, 'Bengaluru'], [fixture.oracle.mumbaiURL, 'Mumbai']]) {
    const job = parseDetail(body(url), rows.find(row => row.url === url));
    assert.equal(job.country, 'India'); assert.equal(job.city, city); assert.equal(job.location, city + ', India');
    assert.equal(job.nativeLocations[0].streetAddress, city + ', IN');
    for (const field of ['addressCountry', 'addressLocality', 'addressRegion', 'postalCode']) assert.equal(job.nativeLocations[0][field], null);
    assert.match(job.nativeLocations[0].countryEvidence, /streetAddress/); assert.equal(job.nativeTypedAddressCountryAvailable, false);
  }
});

test('native publication and exact closing timestamps, full descriptions and requisition/public-ID distinction survive projection', async () => {
  const { runNative } = await import('./native.js'); const calls = [];
  const jobs = await runNative({ transport: async url => { calls.push(url); return transport(url); } }), job = jobs[0];
  assert.equal(job.requisitionId, '126564'); assert.equal(job.nativePublicJobId, '1369188766');
  assert.equal(job.nativeDatePosted, fixture.oracle.sourceDatePosted); assert.equal(job.postingDate, fixture.oracle.postingDate);
  assert.equal(job.closingDate, fixture.oracle.closingDate); assert.equal(job.sourceClosingDateIsExact, true);
  assert.equal(job.originalPublicationDate, null); assert.ok(job.sourceDescription.includes('What will you bring'));
  assert.ok(job.sourceDescription.length > 5000); assert.equal(job.sourceDetailComplete, true);
  assert.equal(job.applyUrl, 'https://careers.anz.com/talentcommunity/apply/1369188766/?locale=en_GB');
  assert.equal(job.applicationVisited, false); assert.equal(job.lifecycleCleanupAllowed, false);
  assert.ok(calls.every(url => !/talentcommunity|login|subscribe|profile/.test(url)));
  assert.equal(job.nativeCollectionEvidence.observedListingCount, 213); assert.equal(job.nativeCollectionEvidence.closingInventoryMatches, true);
});

test('source country, visible city, responsive title and employer disagreements fail explicitly', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url);
  for (const [from, to] of [['content="Bengaluru, IN"', 'content="Bengaluru, AU"'], ['>Bengaluru\n', '>Mumbai\n'], ['>Business Analyst\n', '>Wrong Title\n'], ['content="ANZ Banking Group Limited"', 'content="Another Employer"'], ["'anzbanking'", "'WRONG'"], ['>126564', '>not-a-requisition']]) {
    assert.ok(html.includes(from), from); assert.throws(() => parseDetail(html.replace(from, to), row), undefined, from);
  }
});

test('missing complete descriptions or native publication dates cannot become publishable rows', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url), doc = document(html);
  const description = doc.nodes(node => node.attrs.itemprop === 'description')[0], posted = doc.nodes(node => node.attrs.itemprop === 'datePosted')[0];
  assert.throws(() => parseDetail(html.slice(0, description.openEnd) + html.slice(description.closeStart), row), /description/i);
  assert.throws(() => parseDetail(html.replace(doc.outer(posted), ''), row), /publication/i);
});

test('earlier native publication dates are retained instead of refreshed from listing or scrape time', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL);
  const job = parseDetail(body(row.url).replace(fixture.oracle.sourceDatePosted, 'Sun Sep 20 00:00:00 UTC 2026'), row);
  assert.equal(job.postingDate, '2026-09-20T00:00:00.000Z');
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs([job], { now: new Date(fixture.oracle.observationAt) });
  assert.equal(analysis.eligibleJobs.length, 0); assert.equal(analysis.filterCounts.old, 1);
});

test('impossible dates, wrong weekdays and expiry before publication cannot certify complete role details', async () => {
  const { rows } = await listing(), { parseDetail } = await import('./parser.js'), row = rows.find(row => row.url === fixture.oracle.roleURL), html = body(row.url);
  for (const value of ['Wed Feb 31 00:00:00 UTC 2026', 'Thu Oct 21 00:00:00 UTC 2026', 'Wed Oct 21 25:00:00 UTC 2026']) assert.throws(() => parseDetail(html.replace(fixture.oracle.sourceDatePosted, value), row));
  assert.throws(() => parseDetail(html.replace('Wed Oct 28 18:30:00 UTC 2026', 'Tue Oct 20 18:30:00 UTC 2026'), row), /expiry/i);
});

test('retained partial detail fixture keeps two valid jobs, whole listing evidence and21unretained failures without authorizing cleanup', async () => {
  const result = await (await import('./native.js')).collect({ transport });
  assert.equal(result.jobs.length, 2); assert.equal(result.candidateDetails, 23);
  assert.equal(result.observedListingCount, 213); assert.equal(result.pagesFetched, 3); assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.failures.filter(failure => failure.code === 'FIXTURE_UNRETAINED').length, 21);
  assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
});

test('upstream503 and forbidden application redirects remain failures with their response bodies retained', async () => {
  const { collect } = await import('./native.js');
  for (const response of [ { status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Temporary upstream failure') },
    { status: 302, headers: { location: '/talentcommunity/apply/1369188766/?locale=en_GB' }, body: Buffer.alloc(0) } ]) {
    const result = await collect({ transport: async url => url === fixture.oracle.roleURL ? { ...response, url, bodyComplete: true } : transport(url) });
    assert.equal(result.jobs.length, 1); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
    assert.ok(result.retainedResponses.some(retained => retained.status === response.status));
  }
});

test('official handoff, native tenant and complete pagination are mandatory; reads cannot change country/search scope', async () => {
  const { verifyCorporate, verifyListHome, validateURL, SEARCH, LIST_HOME, CORPORATE } = await import('./parser.js');
  assert.throws(() => verifyCorporate(body(CORPORATE).replaceAll(LIST_HOME, 'https://impostor.example/')));
  assert.throws(() => verifyListHome(body(LIST_HOME).replaceAll("'anzbanking'", "'WRONG'")));
  const config = await source(), html = body(SEARCH), doc = document(html), first = doc.nodes(node => node.tag === 'tr' && node.attrs.class === 'data-row')[0];
  assert.throws(() => config.parseListing(html.replace(doc.outer(first), ''), SEARCH));
  for (const url of [SEARCH + '?country=IN', 'https://careers.anz.com/search?startrow=50', fixture.oracle.roleURL + '?country=IN', 'https://careers.anz.com/talentcommunity/apply/1369188766/?locale=en_GB']) assert.throws(() => validateURL(url));
});
