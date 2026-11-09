import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-077.json.gz', import.meta.url))));
const body = url => Buffer.from(fixture.responseQueues[url][0].bodyBase64, 'base64').toString('utf8');
const fixtureTransport = () => {
  const indices = new Map();
  return async url => {
    const index = indices.get(url) || 0, response = fixture.responseQueues[url]?.[index];
    if (!response) throw Object.assign(Error('Actual AGCO detail response was not retained'), { code: 'FIXTURE_UNRETAINED' });
    indices.set(url, index + 1); return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  };
};
test('selected AGCO source extracts both actual retained India roles instead of a placeholder zero', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(p => p.source === 'agco')).run({ transport: fixtureTransport() });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.some(job => job.jobId === '104917' && job.nativePublicJobId === '1442608300'));
});

async function pagesAndRows() {
  const { createSourceConfig, SEARCH, API } = await import('./parser.js');
  const config = createSourceConfig(), urls = [SEARCH, ...Array.from({ length: 7 }, (_, index) => API + (index + 1) * 25)];
  const pages = urls.map(url => config.parseListing(body(url), url));
  return { config, pages, rows: pages.flatMap(page => page.records) };
}
test('all196 native tiles reconcile across eight pages without losing grouped foreign-primary India roles', async () => {
  const { config, pages, rows } = await pagesAndRows();
  assert.deepEqual(pages.map(page => page.observedRows), [25, 25, 25, 25, 25, 25, 25, 21]);
  assert.ok(pages.every(page => page.reportedTotal === 196 && page.errors.length === 0));
  assert.equal(new Set(rows.map(row => row.id)).size, 196);
  assert.equal(pages.at(-1).nextURL, null);
  const grouped = rows.find(row => row.id === '1394714600');
  assert.equal(grouped.countryCode, 'HU'); assert.equal(grouped.expectedLocationCount, 3);
  assert.equal(grouped.locations[0], 'Budapest, Central Hungary (Közép-Magyarország), HU');
  assert.equal(config.candidateForIndia(grouped), true);
  assert.ok(grouped.nativeListedLocations.includes('Pune, MH, IN'));
  assert.equal(config.candidateForIndia(rows.find(row => row.countryCode === 'US' && row.countries.length === 1)), false);
  const repeated = rows.find(row => row.id === '1421095900');
  assert.equal(repeated.expectedLocationCount, 11);
  assert.equal(repeated.nativeListedLocations.filter(label => label === 'Breganze, IT').length, 2);
});
test('native descriptions, requisitions, explicit source dates and unvisited application URLs survive projection', async () => {
  const { runNative } = await import('./native.js');
  const calls = [], delegate = fixtureTransport();
  const jobs = await runNative({ transport: async url => { calls.push(url); return delegate(url); } });
  assert.equal(jobs.length, 2);
  const job = jobs.find(row => row.jobId === '104917');
  assert.equal(job.postingDate, '2026-10-22T00:00:00.000Z'); assert.equal(job.nativeDatePosted, fixture.oracle.rawDatePosted);
  assert.equal(job.closingDate, null); assert.equal(job.originalPublicationDate, null);
  assert.ok(job.sourceDescription.includes('Your Experience and Qualifications'));
  assert.ok(job.sourceDescription.length > 4000);
  assert.equal(job.applyUrl, 'https://careers.agcocorp.com/talentcommunity/apply/1442608300/?locale=en_US');
  const grouped = jobs.find(row => row.nativePublicJobId === '1394714600');
  assert.equal(grouped.postingDate, '2026-10-20T07:00:00.000Z');
  assert.equal(grouped.nativeLocations.length, 3); assert.equal(grouped.country, 'India');
  assert.equal(grouped.nativeLocations.filter(address => address.nativeCountryCode === 'IN').length, 2);
  assert.ok(grouped.locations.some(location => location.startsWith('Bengaluru,')));
  assert.ok(grouped.locations.some(location => location.startsWith('Pune,')));
  assert.equal(grouped.nativeForeignStateLabels[0].nativeAddress.addressRegion, 'Cent');
  assert.equal(grouped.nativeForeignStateLabels[0].stateLabelEquivalenceKnown, false);
  assert.equal(job.nativeCollectionEvidence.observedListingCount, 196);
  assert.equal(job.nativeCollectionEvidence.listingPaginationComplete, true);
  assert.equal(job.nativeCollectionEvidence.closingInventoryMatches, true);
  assert.ok(calls.every(url => !url.includes('/talentcommunity/') && !url.includes('/login')));
  assert.ok(jobs.every(row => row.sourceDetailComplete === true && row.lifecycleCleanupAllowed === false && row.sourceListingComplete === false));
  const metrics = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs(jobs, { now: new Date(fixture.oracle.originalClosingCaptureAt) });
  assert.equal(metrics.eligibleJobs.length, 2);
});
test('corporate/native identity, requisition and employer disagreements are rejected', async () => {
  const { verifyCorporate, verifyHome, CORPORATE, HOME, parseDetail } = await import('./parser.js');
  assert.throws(() => verifyCorporate(body(CORPORATE).replaceAll('https://careers.agcocorp.com/', 'https://impostor.example/')));
  assert.throws(() => verifyHome(body(HOME).replaceAll("'Agco'", "'OTHER_TENANT'")));
  const { rows } = await pagesAndRows(), row = rows.find(row => row.id === '1442608300');
  assert.throws(() => parseDetail(body(row.url), { ...row, requisitionId: '104918' }));
  assert.throws(() => parseDetail(body(row.url).replace('content="AGCO"', 'content="Other Employer"'), row));
});
test('missing complete descriptions and grouped addresses stay quarantined', async () => {
  const { parseDetail } = await import('./parser.js');
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const { rows } = await pagesAndRows(), row = rows.find(row => row.id === '1442608300'), html = body(row.url), doc = document(html), description = doc.nodes(node => node.attrs.itemprop === 'description')[0];
  assert.throws(() => parseDetail(html.slice(0, description.openEnd) + html.slice(description.closeStart), row), /description/);
  const grouped = rows.find(row => row.id === '1394714600'), groupedHTML = body(grouped.url), gd = document(groupedHTML), address = gd.nodes(node => node.attrs.itemprop === 'address')[0];
  assert.throws(() => parseDetail(groupedHTML.replace(gd.outer(address), ''), grouped), /address|location/i);
  assert.throws(() => parseDetail(groupedHTML.replace('content="KA"', 'content="MH"'), grouped), /location/i);
});
test('upstream failures and partial detail captures never authorize empty inventory or cleanup', async () => {
  const { collect } = await import('./native.js'); const delegate = fixtureTransport();
  const result = await collect({ transport: async url => [fixture.oracle.roleURL, fixture.oracle.groupedRoleURL].includes(url)
    ? { url, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Temporary failure'), bodyComplete: true, provenance: { syntheticUpstreamFailureTest: true } }
    : delegate(url) });
  assert.equal(result.jobs.length, 0); assert.equal(result.verifiedZeroInventory, false); assert.equal(result.cleanupAllowed, false);
  assert.ok(result.failures.some(failure => /503/.test(failure.message)));
});
test('listing/date disagreement never replaces native publication with a later observation', async () => {
  const { parseDetail } = await import('./parser.js'), { rows } = await pagesAndRows(), row = rows.find(row => row.id === '1442608300');
  assert.throws(() => parseDetail(body(row.url).replace('Oct 22, 2026', 'Oct 23, 2026'), row), /date|publication/i);
});
test('native model changes, country conflicts and unapproved read URLs fail explicitly', async () => {
  const { createSourceConfig, SEARCH, API, validateURL } = await import('./parser.js');
  assert.throws(() => createSourceConfig().parseListing(body(SEARCH).replace('jobRecordsFound: parseInt("196")', 'jobRecordsFound: dynamicTotal()'), SEARCH));
  const changed = body(SEARCH).replace('Pune, MH, IN', 'Pune, MH, US');
  assert.ok(createSourceConfig().parseListing(changed, SEARCH).errors.length > 0);
  for (const url of [SEARCH, API + '25', fixture.oracle.roleURL]) validateURL(url);
  for (const url of [API + '26', API + '25&q=India', SEARCH + '?q=India', 'https://evil.example/search/', 'https://careers.agcocorp.com/talentcommunity/apply/1442608300/?locale=en_US']) assert.throws(() => validateURL(url));
});

const foreignFixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-077-foreign-address.json.gz', import.meta.url))));
const foreignBody = Buffer.from(foreignFixture.response.rawBodyBase64, 'base64').toString('utf8');
test('actual streetAddress-only foreign labels do not hide the fully typed Pune role or fabricate typed fields', async () => {
  const { parseDetail } = await import('./parser.js');
  const job = parseDetail(foreignBody, foreignFixture.row);
  assert.equal(job.jobId, '104518'); assert.equal(job.nativePublicJobId, '1421095900');
  assert.equal(job.postingDate, '2026-10-16T07:00:00.000Z');
  assert.equal(job.nativeDatePosted, foreignFixture.oracle.nativeDatePosted);
  assert.equal(job.nativeLocations.length, 11);
  const untyped = job.nativeLocations.filter(address => address.addressCountry === null);
  assert.equal(untyped.length, 6);
  assert.ok(untyped.every(address => address.addressLocality === null && address.addressRegion === null && address.postalCode === null));
  assert.ok(untyped.every(address => ['FR', 'FI', 'IT'].includes(address.nativeCountryCode) && address.countryEvidence === 'native-full-streetAddress-explicit-foreign-country-corroborated'));
  assert.equal(untyped.filter(address => address.streetAddress === 'Breganze, IT').length, 2);
  assert.equal(untyped.filter(address => address.streetAddress === 'Beauvais, FR').length, 2);
  assert.deepEqual(job.locations, ['Pune, MH, India']);
  assert.equal(job.country, 'India'); assert.equal(job.sourceDetailComplete, true);
  assert.equal(job.lifecycleCleanupAllowed, false); assert.equal(job.sourceScopeComplete, false);
});
test('foreign address fallback stays opt-in and existing RMK defaults reject the incomplete typed shape', async () => {
  const { NATIVE_CONFIG } = await import('./parser.js');
  const { parseNativeRole } = await import('../../scraper-support/shared/rmkNativePair.js');
  const { allowForeignStreetAddressCountries, ...strict } = NATIVE_CONFIG;
  assert.throws(() => parseNativeRole(foreignBody, foreignFixture.row, strict), /address|country/i);
});
test('foreign fallback requires every visible location label with matching duplicate multiplicity', async () => {
  const { parseDetail } = await import('./parser.js');
  const { document } = await import('../../scraper-support/shared/rmkNativePairHtml.js');
  const doc = document(foreignBody), label = doc.nodes(node => node.attrs.class?.split(/\s+/).includes('jobGeoLocation') && doc.text(node) === 'Beauvais, FR')[0];
  assert.ok(label);
  assert.throws(() => parseDetail(foreignBody.replace(doc.outer(label), ''), foreignFixture.row), /address|country/i);
  const row = { ...foreignFixture.row, locations: foreignFixture.row.locations.map(label => label === 'Jundiai, SP, BR' ? 'Jundiai, SP, US' : label) };
  assert.throws(() => parseDetail(foreignBody, row), /address|country/i);
});
test('foreign fallback cannot manufacture India or accept partially typed unsupported addresses', async () => {
  const { parseDetail } = await import('./parser.js');
  const replacement = label => label.replaceAll('Beauvais, FR', 'Beauvais, IN');
  const row = { ...foreignFixture.row, locations: foreignFixture.row.locations.map(replacement), nativeListedLocations: foreignFixture.row.nativeListedLocations.map(replacement) };
  assert.throws(() => parseDetail(replacement(foreignBody), row), /address|country/i);
  const partial = foreignBody.replace('<meta itemprop="streetAddress" content="Beauvais, FR">', '<meta itemprop="addressLocality" content="Beauvais"><meta itemprop="streetAddress" content="Beauvais, FR">');
  assert.notEqual(partial, foreignBody);
  assert.throws(() => parseDetail(partial, foreignFixture.row), /address|country/i);
  const countryOnly = value => value.replaceAll('Beauvais, FR', 'FR');
  const countryOnlyRow = { ...foreignFixture.row, locations: foreignFixture.row.locations.map(countryOnly), nativeListedLocations: foreignFixture.row.nativeListedLocations.map(countryOnly) };
  assert.throws(() => parseDetail(countryOnly(foreignBody), countryOnlyRow), /address|country/i);
});
