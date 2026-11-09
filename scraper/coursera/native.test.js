import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { HOME, PORTAL, BOARD, CONFIG, parseListing, parseDetail, validateURL } from './parser.js';
import { collect, runNative } from './native.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { nativeDate, nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js';
import { createHTMLTransport, MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
import { extractionFailureDetails } from '../../scripts/catalogExtractionFailureEvidence.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-072.json.gz', import.meta.url))));
const transport = async url => {
  const response = fixture.responses[url];
  if (!response) throw Object.assign(Error('Explicit simulated unretained Coursera page or role'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
test('Coursera selected catalog retains genuine role when page2 and two details are unavailable', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'coursera')).run({ transport });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.roleID);
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 20);
  assert.equal(jobs[0].nativeCollectionEvidence.nativeReportedTotal, 27);
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 3);
  assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete, false);
});
const body = url => Buffer.from(fixture.responses[url].bodyBase64, 'base64').toString('utf8');
const boardHTML = body(BOARD), detailHTML = body(fixture.oracle.roleURL);
const firstPage = parseListing(boardHTML), record = firstPage.records.find(row => row.id === fixture.oracle.roleID);
const injected = changes => async url => {
  if (!Object.hasOwn(changes, url)) return transport(url);
  const change = changes[url];
  if (change instanceof Error) throw change;
  // Explicitly DERIVED response, not an original native capture.
  if (typeof change === 'string') return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(change), bodyComplete: true, provenance: { derivedTestResponse: true } };
  return change;
};
const replaceOnce = (html, from, to) => { assert.ok(html.includes(from)); return html.replace(from, to); };
const mutatePosting = mutate => {
  const doc = document(detailHTML), node = doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')[0];
  const posting = JSON.parse(node.raw); mutate(posting);
  return detailHTML.slice(0, node.openEnd) + JSON.stringify(posting).replace(/</g, '\\u003c') + detailHTML.slice(node.closeStart);
};
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// All generated pages below are synthetic behavior tests. They do not establish
// that page two or any extra current vacancy was actually fetched.
const card = (id, title, url, location = 'United States') => `<div class="job-search-results-card"><h3 class="job-search-results-card-title"><a href="${esc(url)}">${esc(title)}</a></h3><div class="job-component-details job-component-details-${id}"><li class="job-component-location">${esc(location)}</li></div></div>`;
const syntheticPage = (cards, page, total) => `<div class="job-search-results-content">${cards.join('')}</div><div class="bottom-pagination">Displaying ${(page - 1) * 20 + 1} - ${Math.min(page * 20, total)} of ${total} in total<ul><li aria-current="page">${page}</li></ul>${page < Math.ceil(total / 20) ? `<a rel="next" href="${BOARD}?page=${page + 1}">Next</a>` : ''}</div>`;
const fullSecondPage = syntheticPage(Array.from({ length: 7 }, (_, index) => card((100 + index).toString(16).padStart(32, '0'), 'Synthetic foreign role ' + index, `https://careers.coursera.com/jobs/synthetic-foreign-${index}`)), 2, 27);

test('native fields, whole descriptions and original capture clocks survive catalog decoration', async () => {
  const direct = await runNative({ transport }), job = direct[0];
  assert.equal(job.jobId, '11fe1f5c7a02fd8f06677da6d7a4787b');
  assert.equal(job.requisitionId, null);
  assert.equal(job.nativeVisibleDescriptionHTML, fixture.oracle.visibleDescriptionHTML);
  assert.equal(job.nativeSchemaDescription, fixture.oracle.nativeJobPosting.description);
  assert.equal(job.postingDate, '2026-10-14T11:18:44Z');
  assert.equal(job.closingDate, '2027-01-19T13:16:02Z');
  assert.equal(job.sourceClosingDateIsExact, true);
  assert.equal(job.country, 'India');
  assert.equal(job.city, null);
  assert.equal(job.location, 'India');
  assert.equal(job.firstEverPublication, null);
  assert.equal(job.legalEmployer, null);
  assert.equal(job.nativeApplicationURL, null);
  assert.equal(job.applyUrl, null);
  assert.equal(job.link, fixture.oracle.roleURL);
  assert.equal(job.applicationLinkSource, 'public-role-page-fallback');
  assert.equal(job.nativeDirectApplyFlag, true);
  assert.equal(job.applicationVisited, false);
  assert.ok(job.nativeFacts.internalEmployeeBoardLinks.some(url => url.includes('greenhouse.io')));
  assert.equal(job.sourceScopeComplete, false);
  assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(job.publicEligibility, null);
  for (const item of job.nativeCollectionEvidence.retainedResponses) {
    assert.equal(item.rawBodyBase64, fixture.responses[item.url].bodyBase64);
    assert.equal(item.bodySHA256, crypto.createHash('sha256').update(Buffer.from(item.rawBodyBase64, 'base64')).digest('hex'));
    assert.deepEqual(item.provenance, fixture.responses[item.url].provenance);
  }
  const selected = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'coursera')).run({ transport });
  assert.equal(selected[0].nativeApplicationURL, null);
  assert.equal(selected[0].applyUrl, fixture.oracle.roleURL); // Existing catalog HTTP fallback, separately labeled.
  assert.equal(selected[0].applicationLinkSource, 'public-role-page-fallback');
  assert.equal(selected[0].nativeFacts.nativePostedDate.raw, job.postingDate);
  assert.equal(readInventoryEvidence(selected).status, 'coverage-gap');
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(selected)), false);
  assert.equal(readInventoryEvidence(selected).verifiedAt, null);
});

test('native page-two link is followed and all 27 rows reconcile independently of detail failures', async () => {
  const calls = [], delegate = injected({ [BOARD + '?page=2']: fullSecondPage });
  const result = await collect({ transport: async url => { calls.push(url); return delegate(url); } });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.observedListingCount, 27);
  assert.equal(result.nativeReportedTotal, 27);
  assert.equal(result.listingRecords.length, 27);
  assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.failures.length, 2); // Two uncaptured real India details, not zeros.
  assert.equal(result.jobs.length, 1);
  assert.equal(result.candidateDetails, 3);
  assert.deepEqual(calls.slice(0, 4), [HOME, PORTAL, BOARD, BOARD + '?page=2']);
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  assert.ok(calls.every(url => { validateURL(url); return !/greenhouse|apply|login|members/.test(url); }));
  for (const count of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(result[count], null);
});

test('broken pagination, duplicate identities and changed closing inventory preserve earlier good roles', async () => {
  const duplicate = replaceOnce(fullSecondPage, (100).toString(16).padStart(32, '0'), record.id);
  const changedTotal = replaceOnce(fullSecondPage, 'of 27 in total', 'of 28 in total');
  for (const [page, stage] of [[duplicate, 'native-listing-duplicate'], [changedTotal, 'native-pagination']]) {
    const result = await collect({ transport: injected({ [BOARD + '?page=2']: page }) });
    assert.equal(result.jobs.length, 1);
    assert.equal(result.listingPaginationComplete, false);
    assert.ok(result.failures.some(failure => failure.stage === stage));
    assert.ok(result.unknownRawFailures.some(failure => failure.stage === stage));
    assert.equal(result.cleanupAllowed, false);
  }
  let boardReads = 0;
  const changedClosing = boardHTML.replace(record.title, 'Changed during extraction');
  const result = await collect({ transport: async url => url === BOARD && ++boardReads === 2 ? injected({ [BOARD]: changedClosing })(url) : transport(url) });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.closingInventoryMatches, false);
  assert.ok(result.failures.some(failure => failure.stage === 'closing-inventory'));
  assert.equal(result.verifiedZeroInventory, false);
});

test('listing shape, scope and country evidence fail closed without inventing locations', () => {
  assert.equal(firstPage.records.length, 20);
  assert.equal(firstPage.records.filter(CONFIG.candidateForIndia).length, 3);
  assert.equal(firstPage.nextURL, BOARD + '?page=2');
  assert.equal(nativeLocationCountryName('Toronto, Ontario, Canada'), 'Canada');
  assert.equal(nativeLocationCountryName('Dublin, County Dublin, Ireland'), 'Ireland');
  assert.equal(nativeLocationCountryName('Fremont, CA'), null);
  assert.equal(nativeLocationCountryName('Bengaluru'), null);
  assert.equal(nativeCountryName(' in '), 'India');
  const badRange = replaceOnce(boardHTML, '1&nbsp;-&nbsp;20', '1&nbsp;-&nbsp;19');
  assert.ok(badRange !== boardHTML, 'Native range mutation must apply');
  assert.throws(() => parseListing(badRange), /range|card/);
  assert.throws(() => parseListing(boardHTML.replace(/rel="next"/g, 'rel="alternate"')), /continuation/);
  assert.throws(() => parseListing(replaceOnce(boardHTML, '?page=2', '?page=2&country=India')), /scope|Conflicting/);
  for (const url of ['http://careers.coursera.com/jobs/example', BOARD + '?page=0', BOARD + '?page=2&page=2', BOARD + '?country=India', 'https://careers.coursera.com/jobs/apply', 'https://other.invalid/jobs/example', 'https://careers.coursera.com/jobs/example#form']) assert.throws(() => validateURL(url));
  assert.throws(() => CONFIG.handoffs[0].verify('<template><a href="https://careers.coursera.com/">Careers</a></template>'), /handoff/);
});

test('full detail identity, descriptions, typed country and native dates must agree', () => {
  const original = parseDetail(detailHTML, record);
  assert.equal(original.nativeJobPostingIdentifier.value, record.id);
  assert.equal(original.nativeCountryAddresses[0].nativeCountryRaw, 'IN');
  assert.equal(original.nativePostedDate.raw, fixture.oracle.nativeJobPosting.datePosted);
  const cases = [
    [posting => { posting.identifier.value = '0'.repeat(32); }, /identifier/],
    [posting => { posting.title = 'Different title'; }, /title/],
    [posting => { posting.description = '<p>Short preview</p>'; }, /description/],
    [posting => { posting.description += '<p>Extra unmatched content</p>'; }, /description/],
    [posting => { posting.jobLocation[0].address.addressCountry = 'US'; }, /country conflict/],
    [posting => { delete posting.jobLocation[0].address.addressCountry; }, /country/],
    [posting => { posting.datePosted = '2026-02-30T00:00:00Z'; }, /calendar/],
    [posting => { delete posting.datePosted; }, /publication/],
    [posting => { posting.validThrough = '2025-01-01'; }, /expiry/],
  ];
  for (const [mutate, pattern] of cases) assert.throws(() => parseDetail(mutatePosting(mutate), record), pattern);
  const doc = document(detailHTML), roleBody = doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('page-body'))[0];
  const closed = detailHTML.slice(0, roleBody.openEnd) + '<p>This position is no longer available.</p>' + detailHTML.slice(roleBody.openEnd);
  assert.ok(closed !== detailHTML, 'Closure mutation must apply');
  assert.throws(() => parseDetail(closed, record), /closed/);
  assert.equal(nativeDate('2026-10-19').precision, 'day');
  assert.equal(nativeDate('2026-10-19').exact, false);
  assert.throws(() => nativeDate('2026-10-19T25:00:00Z'), /Invalid|calendar/);
});

test('shared-portal employer labels remain separate and foreign-only results cannot verify zero', async () => {
  const udemyHTML = mutatePosting(posting => { posting.hiringOrganization.name = 'Udemy'; });
  const udemy = parseDetail(udemyHTML, record);
  assert.equal(udemy.excluded, true);
  assert.equal(udemy.exclusionReason, 'native-employer-outside-configured-brand');
  assert.equal(udemy.nativeHiringOrganization.name, 'Udemy');
  const foreign = firstPage.records.find(row => row.locations[0] === 'United States');
  const foreignBoard = syntheticPage([card(foreign.id, foreign.title, foreign.url)], 1, 1);
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'coursera')).run({ transport: injected({ [BOARD]: foreignBoard }) });
  assert.equal(jobs.length, 0);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null);
});

test('empty and failed upstream responses preserve typed diagnostics through the selected catalog', async () => {
  const selected = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'coursera'));
  const failures = [
    Object.assign(Error('fetch failed'), { cause: Object.assign(Error('Connection timed out'), { code: 'ETIMEDOUT' }) }),
    { url: HOME, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('<p>Unavailable</p>'), bodyComplete: true },
    { url: HOME, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.alloc(0), bodyComplete: true },
    { url: HOME, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('<html>Challenge</html>'), bodyComplete: true },
  ];
  for (const failure of failures) {
    await assert.rejects(selected.run({ transport: injected({ [HOME]: failure }) }), error => {
      assert.equal(error.code, 'NATIVE_HTML_INCOMPLETE');
      assert.equal(error.nativeEvidence.verifiedZeroInventory, false);
      assert.equal(error.nativeEvidence.rawJobs, null);
      assert.equal(error.nativeEvidence.cleanupAllowed, false);
      const summary = extractionFailureDetails(error);
      assert.equal(summary.failureEvidence.failureCount, 1);
      assert.equal(summary.failureEvidence.stage, 'native-handoff');
      assert.equal(summary.failureEvidence.inventoryComplete, false);
      return true;
    });
  }
  await assert.rejects(selected.run({ transport: injected({ [fixture.oracle.roleURL]: '<html>No description</html>' }) }), error => {
    assert.equal(error.nativeEvidence.jobs.length, 0);
    assert.equal(error.nativeEvidence.unknownRawFailures.filter(value => value.stage === 'native-detail').length, 3);
    assert.ok(error.nativeEvidence.unknownRawFailures.some(value => value.candidate.rawDetailHTML === '<html>No description</html>'));
    return true;
  });
});

test('GET transport omits credentials, bounds complete streams and rejects missing/truncated bodies', async () => {
  const response = ({ stream, length, encoding, status = 200, url = BOARD } = {}) => ({ url, status, headers: new Headers({ 'content-type': 'text/html', ...(length == null ? {} : { 'content-length': String(length) }), ...(encoding ? { 'content-encoding': encoding } : {}) }), body: stream === undefined ? new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('native')); controller.close(); } }) : stream });
  let options;
  const read = createHTMLTransport(CONFIG, { fetchImpl: async (url, init) => { options = init; return response({ length: 6 }); } });
  assert.equal((await read(BOARD)).body.toString(), 'native');
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'manual');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.body, undefined);
  assert.equal(options.headers.Cookie, undefined);
  await assert.rejects(createHTMLTransport(CONFIG, { fetchImpl: async () => response({ length: MAX_HTML_BYTES + 1 }) })(BOARD), /limit/);
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_HTML_BYTES + 1)); controller.close(); } });
  await assert.rejects(createHTMLTransport(CONFIG, { fetchImpl: async () => response({ stream: oversized }) })(BOARD), /limit/);
  await assert.rejects(createHTMLTransport(CONFIG, { fetchImpl: async () => response({ stream: null, length: 3 }) })(BOARD), /empty body/);
  await assert.rejects(createHTMLTransport(CONFIG, { fetchImpl: async () => response({ length: 9 }) })(BOARD), /length|truncat/i);
  assert.equal((await createHTMLTransport(CONFIG, { fetchImpl: async () => response({ length: 26, encoding: 'gzip' }) })(BOARD)).body.toString(), 'native');
  const stalled = new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('partial')); } });
  await assert.rejects(createHTMLTransport(CONFIG, { timeoutMs: 25, fetchImpl: async () => response({ stream: stalled }) })(BOARD), error => error.name === 'TimeoutError' && error.code === 'ETIMEDOUT');
  await assert.rejects(createHTMLTransport(CONFIG, { fetchImpl: async () => response({ url: PORTAL }) })(BOARD), /identity/);
});

test('external cancellation bounds a stalled HTML body and credential diagnostics are redacted', async () => {
  const parent = new AbortController();
  let cancelled = false, reading;
  const started = new Promise(resolve => { reading = resolve; });
  const stream = new ReadableStream({ pull() { reading(); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const pending = createHTMLTransport(CONFIG, { signal: parent.signal, fetchImpl: async () => ({ url: BOARD, status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: stream }) })(BOARD);
  await started;
  parent.abort(Object.assign(Error('Explicit test cancellation'), { code: 'TEST_ABORTED' }));
  await assert.rejects(pending, error => error.code === 'TEST_ABORTED');
  assert.equal(cancelled, true);
  const sensitive = Object.assign(Error('fetch failed token=secret-value https://example.invalid/private'), { cause: Object.assign(Error('Bearer test-secret'), { code: 'ETIMEDOUT' }) });
  const result = await collect({ transport: injected({ [HOME]: sensitive }) });
  assert.equal(result.failures[0].cause.code, 'ETIMEDOUT');
  assert.ok(!JSON.stringify(result.failures).includes('secret-value'));
  assert.ok(!JSON.stringify(result.failures).includes('test-secret'));
  assert.ok(!JSON.stringify(result.failures).includes('example.invalid'));
});
