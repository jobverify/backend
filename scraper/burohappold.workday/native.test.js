import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { HOME, BOARD, CONFIG, parseListing, parseDetail, validateURL } from './parser.js';
import { collect, runNative } from './native.js';
import { extractionFailureDetails } from '../../scripts/catalogExtractionFailureEvidence.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-073.json.gz', import.meta.url))));
const transport = async url => {
  const response = fixture.responses[url];
  if (!response) throw Object.assign(Error('Explicit simulated unretained Buro Happold continuation'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
test('Buro Happold selected catalog extracts genuine Bengaluru role beside unavailable page2', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'burohappold')).run({ transport });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.roleID);
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 10);
  assert.equal(jobs[0].nativeCollectionEvidence.nativeReportedTotal, null);
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null);
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 1);
});
const body = url => Buffer.from(fixture.responses[url].bodyBase64, 'base64').toString('utf8');
const boardHTML = body(BOARD), detailHTML = body(fixture.oracle.roleURL);
const page = parseListing(boardHTML), record = page.records.find(row => row.id === fixture.oracle.roleID);
const replaceOnce = (html, from, to) => { assert.ok(html.includes(from), 'The fixture mutation must apply'); return html.replace(from, to); };
const injected = changes => async url => {
  if (!Object.hasOwn(changes, url)) return transport(url);
  const change = changes[url];
  if (change instanceof Error) throw change;
  if (typeof change === 'string') return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(change), bodyComplete: true, provenance: { derivedTestResponse: true } };
  return change;
};
const mutatePosting = mutate => {
  const doc = document(detailHTML), node = doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')[0], posting = JSON.parse(node.raw); mutate(posting);
  return detailHTML.slice(0, node.openEnd) + JSON.stringify(posting).replace(/</g, '\\u003c') + detailHTML.slice(node.closeStart);
};
// All generated pages are DERIVED synthetic behavior tests, not native captures.
const card = (id, title = 'Synthetic foreign role', location = 'London, United Kingdom') => `<a class="in-app" itemprop="url" href="https://vacancies.burohappold.com/jobs/job/Synthetic-role/${id}"><div class="job-list-details"><h3><span class="job-list-title">${title}</span></h3><p itemprop="jobLocation"><span itemprop="address">${location}</span></p><p itemprop="employmentType">Permanent</p></div></a>`;
const syntheticPage = (number, last = 24, count = number === last ? 3 : 10, cards) => `<h1>Jobs and careers with Buro Happold</h1>${cards || Array.from({ length: count }, (_, index) => card(10000 + number * 10 + index)).join('')}<div class="pagination" role="navigation"><strong>${number}</strong>${number > 1 ? '<a href="https://vacancies.burohappold.com/jobs/search/-1/1">First</a>' : ''}${number < last ? `<a href="https://vacancies.burohappold.com/jobs/search/-1/${number + 1}"><span class="sr-only">Next results page</span>&gt;</a><a href="https://vacancies.burohappold.com/jobs/search/-1/${last}">Last &rsaquo;</a>` : ''}</div>`;
const fullPagination = Object.fromEntries(Array.from({ length: 23 }, (_, index) => [BOARD + 'jobs/search/-1/' + (index + 2), syntheticPage(index + 2)]));

const livePagination = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-073-live-pagination.json.gz', import.meta.url))));
const fullLive = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-073-live-full.json.gz', import.meta.url))));
const capturedListings = Object.entries(fullLive.responseQueues).filter(([url]) => url === BOARD || new URL(url).pathname.startsWith('/jobs/search/')).flatMap(([url, responses]) => parseListing(Buffer.from(responses[0].bodyBase64, 'base64').toString('utf8'), url).records);
const capturedRole = id => {
  const row = capturedListings.find(row => row.id === id); assert.ok(row, 'Captured listing row required');
  const response = fullLive.responseQueues[row.url]?.[0]; assert.ok(response, 'Captured detail body required');
  return { row, html: Buffer.from(response.bodyBase64, 'base64').toString('utf8') };
};
test('actual double-hyphen role slug retains a source row instead of losing role2551', () => {
  const parsed = Object.entries(fullLive.responseQueues).filter(([url]) => url === BOARD || new URL(url).pathname.startsWith('/jobs/search/')).map(([url, responses]) => parseListing(Buffer.from(responses[0].bodyBase64, 'base64').toString('utf8'), url));
  const row = parsed.flatMap(page => page.records).find(row => row.id === '2551');
  assert.ok(row);
  assert.equal(row.url, BOARD + 'jobs/job/Construction-AdminSite-Engineer--Mechanical/2551');
  assert.equal(parsed.reduce((sum, page) => sum + page.errors.length, 0), 0);
  assert.throws(() => validateURL(row.url + '?mode=apply'));
});

test('actual foreign location punctuation compares completely without accepting changed location words', () => {
  const { row, html } = capturedRole('2610'), fact = parseDetail(html, row);
  assert.equal(fact.excluded, true);
  assert.equal(fact.nativeCountryAddresses[0].country, 'Poland');
  assert.equal(fact.nativeVisibleSummary.Location, 'Warszawa; Lublin,Lublin');
  assert.deepEqual(fact.nativeListingRecord.locations, ['Warszawa; Lublin, Lublin']);
  assert.equal(CONFIG.locationLabelsAgree(['Warszawa; Lublin,Lublin'], ['Warszawa; Lublin, Lublin']), true);
  assert.equal(CONFIG.locationLabelsAgree(['Berlin; Lublin,Lublin'], ['Warszawa; Lublin, Lublin']), false);
});

test('all explicit grouped India localities keep every source city without fabricating postal addresses', () => {
  for (const id of ['2550', '2508', '2432', '2403', '2302', '1533']) {
    const { row, html } = capturedRole(id), fact = parseDetail(html, row);
    assert.equal(fact.nativeCountryAddresses[0].country, 'India');
    assert.match(fact.nativeCountryAddresses[0].raw.addressLocality, /[,;]/);
    assert.equal(fact.nativeVisibleSummary.Location, row.locations[0]);
  }
});

test('real native reference mismatches remain rejected after location and slug corrections', () => {
  for (const id of ['2607', '2606']) {
    const { row, html } = capturedRole(id);
    assert.throws(() => parseDetail(html, row), /reference\/URL identity mismatch/);
  }
});

test('explicit foreign-country exclusions preserve expiry disagreement without becoming India jobs', () => {
  const { row, html } = capturedRole('2600'), fact = parseDetail(html, row);
  assert.equal(fact.excluded, true);
  assert.equal(fact.nativeCountryAddresses[0].country, 'United States');
  assert.equal(fact.nativeVisibleClosingDateLabel, 'No expiry date');
  assert.ok(fact.nativeValidThrough.raw);
  assert.equal(fact.nativeExpiryUIValidation, 'not-applied-to-excluded-role');
  assert.equal(fact.applicationsVisited, false);
});

test('retained full live batch recovers grouped India roles and keeps unretained detail2551 unknown', async () => {
  const indices = new Map();
  const jobs = await runNative({ transport: async url => {
    const index = indices.get(url) || 0, response = fullLive.responseQueues[url]?.[index];
    if (!response) throw Object.assign(Error('Actual role2551 detail was not fetched in the original trial'), { code: 'FIXTURE_UNRETAINED' });
    indices.set(url, index + 1); return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  } });
  assert.equal(jobs.length, 80);
  const evidence = jobs[0].nativeCollectionEvidence;
  assert.equal(evidence.observedListingCount, 239); assert.equal(evidence.pagesFetched, 24);
  assert.equal(evidence.listingPaginationComplete, true); assert.equal(evidence.failures.length, 6);
  const grouped = jobs.find(job => job.jobId === '2432'); assert.ok(grouped);
  assert.equal(grouped.city, null);
  assert.deepEqual(grouped.locations, ['Mumbai, India', 'Bengaluru, India']);
  assert.equal(grouped.nativeCountryAddresses.length, 1);
  assert.equal(grouped.nativeCountryAddresses[0].raw.addressLocality, 'Mumbai, Bengaluru');
  assert.equal(grouped.nativeCountryAddresses[0].raw.postalCode, '400710, 560038');
  assert.equal(grouped.sourceScopeComplete, false); assert.equal(grouped.lifecycleCleanupAllowed, false);
  assert.ok(evidence.failures.some(failure => failure.code === 'FIXTURE_UNRETAINED'));
});
test('actual native page2 accepts its unnumbered first-page navigation alias and keeps page3 continuation', () => {
  const response = livePagination.responseQueues[livePagination.oracle.page2][0];
  assert.equal(crypto.createHash('sha256').update(Buffer.from(response.bodyBase64, 'base64')).digest('hex'), response.provenance.bodySHA256);
  const parsed = parseListing(Buffer.from(response.bodyBase64, 'base64').toString('utf8'), response.url);
  assert.equal(parsed.pageNumber, 2);
  assert.equal(parsed.observedRows, 10);
  assert.equal(parsed.records.length, 10);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.lastPage, 24);
  assert.equal(parsed.nextURL, livePagination.oracle.nextPage);
  assert.equal(parsed.reportedTotal, null);
  assert.equal(parsed.terminationKnown, false);
  assert.equal(CONFIG.sameReadIdentity(BOARD, livePagination.oracle.nativePage1Alias), true);
  assert.equal(CONFIG.sameReadIdentity(livePagination.oracle.nativePage1Alias, BOARD + 'jobs/search/-1/1'), true);
  assert.equal(CONFIG.sameReadIdentity(livePagination.oracle.nativePage1Alias, livePagination.oracle.page2), false);
});

test('first-page alias support keeps filtered searches and candidate/member/application reads excluded', () => {
  validateURL(livePagination.oracle.nativePage1Alias);
  for (const url of [BOARD + 'jobs/search/-2/', BOARD + 'jobs/search/-1/?country=India', BOARD + 'jobs/search/-1/0', BOARD + 'jobs/search/-1/1001', BOARD + 'members/', BOARD + 'jobs/search/-1/../apply', 'https://careershub.burohappold.com/members/?j=2633&lang=en']) assert.throws(() => validateURL(url));
});

test('all 24 advertised pages are followed while an unadvertised total stays unknown', async () => {
  const calls = [], delegate = injected(fullPagination);
  const jobs = await runNative({ transport: async url => { calls.push(url); return delegate(url); } }), result = jobs[0].nativeCollectionEvidence;
  assert.equal(result.pagesFetched, 24);
  assert.equal(result.observedListingCount, 233);
  assert.equal(result.listingRecords.length, 233);
  assert.equal(result.nativeReportedTotal, null);
  assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.failures.length, 0);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.candidateDetails, 1);
  assert.equal(result.verifiedZeroInventory, false);
  assert.equal(result.sourceScopeComplete, false);
  assert.equal(result.cleanupAllowed, false);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null);
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 24);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
  assert.ok(calls.includes(BOARD + 'jobs/search/-1/24'));
  assert.ok(calls.every(url => { validateURL(url); return !/members|send|apply/.test(url); }));
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(result[key], null);
});

test('complete native fields and day precision are preserved without invented region or legal employer', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'burohappold')).run({ transport }), job = jobs[0];
  assert.equal(job.jobId, '2633');
  assert.equal(job.requisitionId, null);
  assert.equal(job.nativeFacts.nativeJobReference, 'burohappold/TP/138050/2633');
  assert.equal(job.nativeVisibleDescriptionHTML, fixture.oracle.visibleDescriptionHTML);
  assert.equal(job.nativeSchemaDescription, fixture.oracle.nativeJobPosting.description);
  assert.equal(job.country, 'India');
  assert.equal(job.city, 'Bengaluru');
  assert.equal(job.location, 'Bengaluru, India');
  assert.equal(job.nativeCountryAddresses[0].raw.addressRegion, undefined);
  assert.equal(job.nativeCountryAddresses[0].raw.postalCode, '560038');
  assert.equal(job.postingDate, '2026-10-19');
  assert.equal(job.nativePublicationPrecision, 'day');
  assert.equal(job.closingDate, '2026-12-31');
  assert.equal(job.sourceClosingDateIsExact, false);
  assert.equal(job.nativeApplicationURL, fixture.oracle.nativeApplicationURL);
  assert.equal(job.applyUrl, fixture.oracle.nativeApplicationURL);
  assert.equal(job.applicationLinkSource, 'native-public-application-link');
  assert.equal(job.applicationVisited, false);
  assert.equal(job.firstEverPublication, null);
  assert.equal(job.legalEmployer, null);
  assert.equal(job.nativeHiringOrganization.name, 'Buro Happold Limited');
  assert.equal(job.sourceScopeComplete, false);
  assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(job.publicEligibility, null);
  for (const item of job.nativeCollectionEvidence.retainedResponses) {
    assert.equal(item.rawBodyBase64, fixture.responses[item.url].bodyBase64);
    assert.equal(item.bodySHA256, crypto.createHash('sha256').update(Buffer.from(item.rawBodyBase64, 'base64')).digest('hex'));
    assert.deepEqual(item.provenance, fixture.responses[item.url].provenance);
  }
});

test('native role ID, reference, country and city must agree with the visible listing', () => {
  assert.equal(record.locations[0], 'Bengaluru, India');
  assert.equal(page.records.filter(CONFIG.candidateForIndia).length, 1);
  const wrongReference = replaceOnce(detailHTML, 'burohappold/TP/138050/2633', 'burohappold/TP/138050/9999');
  assert.throws(() => parseDetail(wrongReference, record), /identity/);
  const otherCountry = mutatePosting(posting => { posting.jobLocation.address.addressCountry = 'US'; });
  assert.throws(() => parseDetail(otherCountry, record), /country conflict/);
  const otherCity = mutatePosting(posting => { posting.jobLocation.address.addressLocality = 'New Delhi'; });
  assert.throws(() => parseDetail(otherCity, record), /locality|city|location/i);
  const missingCountry = mutatePosting(posting => { delete posting.jobLocation.address.addressCountry; });
  assert.throws(() => parseDetail(missingCountry, record), /country/);
  const missingCity = mutatePosting(posting => { delete posting.jobLocation.address.addressLocality; });
  assert.throws(() => parseDetail(missingCity, record), /locality|city|location/i);
});

test('short or contradictory descriptions and invalid or inconsistent native dates fail closed', () => {
  for (const [mutate, expected] of [
    [posting => { posting.description = 'Short preview'; }, /description/],
    [posting => { posting.description += 'Extra unmatched content'; }, /description/],
    [posting => { posting.title = 'Unrelated role'; }, /title/],
    [posting => { posting.datePosted = '2026-02-30'; }, /calendar/],
    [posting => { delete posting.datePosted; }, /publication/],
    [posting => { posting.validThrough = '2026-12-30'; }, /expiry/],
  ]) assert.throws(() => parseDetail(mutatePosting(mutate), record), expected);
  const employer = parseDetail(mutatePosting(posting => { posting.hiringOrganization.name = 'Different employer'; }), record);
  assert.equal(employer.excluded, true);
  assert.equal(employer.exclusionReason, 'native-employer-outside-configured-brand');
  assert.equal(employer.nativeHiringOrganization.name, 'Different employer');
});

test('the native public application is preserved but not visited, and mismatched job links are rejected', () => {
  assert.equal(parseDetail(detailHTML, record).nativeApplicationURL, fixture.oracle.nativeApplicationURL);
  const wrong = detailHTML.replaceAll('members/?j=2633', 'members/?j=9999');
  assert.ok(wrong !== detailHTML);
  assert.throws(() => parseDetail(wrong, record), /application/);
  for (const url of [fixture.oracle.nativeApplicationURL, 'https://vacancies.burohappold.com/jobs/send', 'https://vacancies.burohappold.com/jobs/search', BOARD + 'jobs/search/-2/2', BOARD + 'jobs/search/-1/2?country=India', BOARD + 'jobs/search/-1/0', BOARD.replace('https:', 'http:'), 'https://other.invalid/']) assert.throws(() => validateURL(url));
  assert.throws(() => CONFIG.handoffs[0].verify('<template><a href="https://vacancies.burohappold.com/">Jobs</a></template>'), /handoff/);
});

test('bad continuation and duplicate identities do not delete a retained complete role', async () => {
  const duplicate = syntheticPage(2, 24, 10, Array.from({ length: 10 }, (_, index) => card(index === 0 ? '2633' : 11000 + index)).join(''));
  const result = await collect({ transport: injected({ [BOARD + 'jobs/search/-1/2']: duplicate }) });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.listingPaginationComplete, false);
  assert.ok(result.failures.some(value => value.stage === 'native-listing-duplicate'));
  assert.ok(result.unknownRawFailures.some(value => value.stage === 'native-listing-duplicate'));
  const skipped = replaceOnce(boardHTML, '<span class="sr-only">Next results page</span>', '<span class="sr-only">Unrecognized continuation</span>');
  assert.throws(() => parseListing(skipped), /continuation/);
  const changedScope = boardHTML.replaceAll('/jobs/search/-1/', '/jobs/search/-2/');
  assert.ok(changedScope !== boardHTML);
  assert.throws(() => parseListing(changedScope), /read|scope|path/);
  let reads = 0;
  const changedBoard = replaceOnce(boardHTML, 'Civil 3D Modeller - Infrastructure', 'Changed role title');
  const closing = await collect({ transport: async url => url === BOARD && ++reads === 2 ? injected({ [BOARD]: changedBoard })(url) : transport(url) });
  assert.equal(closing.jobs.length, 1);
  assert.equal(closing.closingInventoryMatches, false);
  assert.ok(closing.failures.some(value => value.stage === 'closing-inventory'));
  assert.equal(closing.cleanupAllowed, false);
});

test('unrecognized empty pages and failed details remain unknown through the selected catalog', async () => {
  const selected = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'burohappold'));
  for (const changes of [
    { [BOARD]: syntheticPage(1, 1, 0) },
    { [fixture.oracle.roleURL]: '<html>No full role description</html>' },
    { [HOME]: { url: HOME, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Unavailable'), bodyComplete: true } },
    { [BOARD]: { url: BOARD, status: 302, headers: { location: fixture.oracle.nativeApplicationURL }, body: Buffer.alloc(0), bodyComplete: true } },
  ]) await assert.rejects(selected.run({ transport: injected(changes) }), error => {
    assert.equal(error.code, 'NATIVE_HTML_INCOMPLETE');
    const native = error.nativeEvidence, summary = extractionFailureDetails(error);
    assert.equal(native.verifiedZeroInventory, false);
    assert.equal(native.cleanupAllowed, false);
    assert.equal(native.rawJobs, null);
    assert.equal(native.indiaJobs, null);
    assert.equal(summary.failureEvidence.inventoryComplete, false);
    assert.ok(summary.failureEvidence.failureCount >= 1);
    return true;
  });
});

test('successful foreign-only inventory stays a coverage gap rather than verified zero India', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'burohappold')).run({ transport: injected({ [BOARD]: syntheticPage(1, 1, 1) }) });
  assert.equal(jobs.length, 0);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null);
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 1);
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null);
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
});
