import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { CAREERS, ORIGIN, BOARD, ASSET_BASE, CONFIG, parseListing, parseDetail, verifyCorporateHandoff, compareDescriptions, validateURL, descriptionSections } from './parser.js';
import { collect, runNative } from './native.js';
import { extractionFailureDetails } from '../../scripts/catalogExtractionFailureEvidence.js';
import { buildPublishableJobPostedAtCutoff, resolveJobPostedAt } from '../../src/utils/jobLifecycle.js';
import { readNativeJobPosting } from '../../scraper-support/shared/nativeJobPosting.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-074.json.gz', import.meta.url))));
const transport = async url => {
  const response = fixture.responses[url];
  if (!response) throw Object.assign(Error('Explicit simulated unretained Celanese page/detail'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
test('Celanese catalog retains full Hyderabad role without refreshing its native2024 publication', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'celanese')).run({ transport });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.roleID);
  assert.equal(jobs[0].postingDate, fixture.oracle.postedDate);
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 20);
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 8);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null);
});
const body = url => Buffer.from(fixture.responses[url].bodyBase64, 'base64').toString('utf8');
const boardHTML = body(BOARD), detailHTML = body(fixture.oracle.roleURL), careersHTML = body(CAREERS);
const first = parseListing(boardHTML), row = first.records.find(row => row.id === fixture.oracle.roleID);
const replaceOnce = (html, from, to) => { assert.ok(html.includes(from), 'The fixture mutation must apply'); return html.replace(from, to); };
const injected = changes => async url => {
  if (!Object.hasOwn(changes, url)) return transport(url);
  const change = changes[url]; if (change instanceof Error) throw change;
  if (typeof change === 'string') return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(change), bodyComplete: true, provenance: { derivedTestResponse: true } };
  return change;
};
const mutateJSON = (html, predicate, mutate) => {
  const doc = document(html), node = doc.nodes(predicate)[0], value = JSON.parse(node.raw); mutate(value);
  return html.slice(0, node.openEnd) + JSON.stringify(value).replace(/</g, '\\u003c') + html.slice(node.closeStart);
};
const posting = mutate => mutateJSON(detailHTML, node => node.tag === 'script' && node.attrs.type === 'application/ld+json', mutate);
const jss = mutate => mutateJSON(careersHTML, node => node.attrs.id === '__JSS_STATE__', mutate);
const pageURL = page => ORIGIN + '/jobs/search?pr=' + (page - 1) + '&';
// These response pages are DERIVED synthetic fixtures; no later inventory is
// represented as captured native evidence or a current opening count.
const field = (name, value) => `<div class="iCIMS_JobHeaderTag"><dt class="iCIMS_JobHeaderField">${name}</dt><dd class="iCIMS_JobHeaderData">${value}</dd></div>`;
const card = (id, country = 'China', city = 'Shanghai') => `<div class="row"><a class="iCIMS_Anchor" href="${ORIGIN}/jobs/${id}/synthetic-role/job"><h3>Synthetic foreign role</h3></a><dl class="iCIMS_JobHeaderGroup">${field('Job ID', '2026-' + id)}${field('Country', country)}${field('City', city)}</dl></div>`;
const syntheticPage = (page, last = 3, count = page === last ? 7 : 20, rows) => `<base href="${ASSET_BASE}"><div class="iCIMS_MainWrapper iCIMS_ListingsPage"><h2>Search Results: Page ${page} of ${last}</h2>${rows || Array.from({ length: count }, (_, index) => card(50000 + page * 100 + index)).join('')}<div class="iCIMS_Paging"><a class="selected" href="${pageURL(page)}">Page ${page} of ${last} , Current Page</a>${page < last ? `<a href="${pageURL(page + 1)}">Next page of results</a><a href="${pageURL(last)}">Last page of results Last</a>` : ''}</div></div>`;
const allPages = { [pageURL(2)]: syntheticPage(2), [pageURL(3)]: syntheticPage(3) };

const liveFrame = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-074-live-frame.json.gz', import.meta.url))));
const shellHTML = Buffer.from(liveFrame.responses[BOARD].bodyBase64, 'base64').toString('utf8');
const framedBoard = BOARD + '&in_iframe=1';
const actualDetails = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-074-live-details.json.gz', import.meta.url))));
const nativeListingRows = Object.entries(actualDetails.responseQueues).filter(([url]) => new URL(url).pathname === '/jobs/search' && new URL(url).searchParams.get('in_iframe') === '1').flatMap(([url, responses]) => parseListing(Buffer.from(responses[0].bodyBase64, 'base64').toString('utf8'), url).records);
const actualRole = id => {
  const row = nativeListingRows.find(row => row.id === id); assert.ok(row);
  const response = actualDetails.responseQueues[row.url]?.[0]; assert.ok(response);
  return { row, html: Buffer.from(response.bodyBase64, 'base64').toString('utf8') };
};
test('native application links accept the exact iframe parameter while retaining the same role', () => {
  const { row, html } = actualRole('23774');
  const fact = parseDetail(html, row);
  assert.equal(new URL(fact.nativeApplicationURL).searchParams.get('in_iframe'), '1');
  assert.equal(new URL(fact.nativeApplicationURL).pathname, new URL(row.url).pathname);
  assert.equal(fact.nativeJobPosting.datePosted, '2024-10-22T17:32:09.052Z');
  assert.throws(() => parseDetail(html.replaceAll('in_iframe=1', 'in_iframe=0'), row));
});

test('nested native requirement headings remain inside all three complete description sections', () => {
  const { row, html } = actualRole('23761');
  const fact = parseDetail(html, row);
  assert.equal(fact.nativeDescriptionSections.length, 3);
  const qualifications = fact.nativeDescriptionSections[2].bodyHTML;
  for (const heading of ['Required Qualifications', 'Preferred Qualifications', 'Core Competencies']) assert.ok(qualifications.includes(heading));
  assert.ok(fact.nativeDescriptionSections[1].bodyHTML.includes('Data Migration'));
  assert.equal(compareDescriptions(fact.nativeVisibleDescriptionHTML, fact.nativeSchemaDescription), true);
});

test('native encoded punctuation compares as the same text without dropping any requirement', () => {
  const { row, html } = actualRole('24007');
  const fact = parseDetail(html, row);
  assert.ok(fact.nativeVisibleDescriptionHTML.includes('&bull;'));
  assert.ok(fact.nativeSchemaDescription.includes('•'));
  assert.equal(compareDescriptions(fact.nativeVisibleDescriptionHTML, fact.nativeSchemaDescription), true);
  assert.equal(compareDescriptions(fact.nativeVisibleDescriptionHTML.replace('Salesforce', 'FORGED'), fact.nativeSchemaDescription), false);
});

test('all ten captured native India details parse while six malformed country records stay unknown', async () => {
  const indices = new Map();
  const jobs = await runNative({ transport: async url => {
    const index = indices.get(url) || 0, response = actualDetails.responseQueues[url]?.[index]; assert.ok(response, 'Actual response sequence required'); indices.set(url, index + 1);
    return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  } });
  assert.equal(jobs.length, 10);
  const evidence = jobs[0].nativeCollectionEvidence;
  assert.equal(evidence.observedListingCount, 46); assert.equal(evidence.pagesFetched, 3);
  assert.equal(evidence.failures.length, 6); assert.equal(evidence.candidateDetails, 16);
  assert.ok(jobs.every(job => job.country === 'India' && job.postingDate.startsWith('2024-')));
  const analysis = (await import('../../scraper-support/utils/publishableJobMetrics.js')).analyzePublishableJobs(jobs, { now: new Date(actualDetails.originalCompletedAt) });
  assert.equal(analysis.eligibleJobs.length, 0); assert.equal(analysis.filterCounts.old, 10);
  for (const id of ['23920', '23907', '23766', '23708', '23707', '23235']) {
    const { row, html } = actualRole(id); assert.throws(() => parseDetail(html, row));
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
});
test('actual public noscript portal shell resolves only the identical native search with in_iframe=1', () => {
  assert.equal(typeof CONFIG.resolveReadFrame, 'function');
  assert.equal(CONFIG.resolveReadFrame(shellHTML, BOARD), framedBoard);
  validateURL(framedBoard);
  assert.equal(CONFIG.sameReadIdentity(BOARD, framedBoard), true);
  assert.equal(CONFIG.resolveReadFrame(boardHTML, BOARD), null);
  for (const target of [framedBoard.replace('asiacareers-', 'careers-'), framedBoard + '&in_iframe=1', framedBoard + '&pr=1', framedBoard.replace('mobile=false', 'mobile=true'), ORIGIN + '/jobs/23787/role/job?in_iframe=1']) {
    assert.throws(() => CONFIG.resolveReadFrame(replaceOnce(shellHTML, framedBoard.replaceAll('&', '&amp;'), target.replaceAll('&', '&amp;')), BOARD));
  }
});

test('same public native role allows its own frame while hidden/template frames stay excluded', () => {
  const role = fixture.oracle.roleURL, framedRole = role + '?in_iframe=1';
  const shell = '<span id="icims_iframe_span" role="main" aria-label="Career Portal"></span><noscript><iframe src="' + framedRole + '" id="noscript_icims_content_iframe" name="noscript_icims_content_iframe" title="Noscript iCIMS Content iFrame"></iframe></noscript>';
  assert.equal(CONFIG.resolveReadFrame(shell, role), framedRole);
  assert.equal(CONFIG.sameReadIdentity(role, framedRole), true);
  assert.equal(CONFIG.resolveReadFrame('<div hidden>' + shell + '</div>', role), null);
  assert.equal(CONFIG.resolveReadFrame('<template>' + shell + '</template>', role), null);
  assert.throws(() => CONFIG.resolveReadFrame(shell, fixture.oracle.roleURL.replace('/23787/', '/23788/')));
});

test('bounded non-executing frame GET retains real shell and historical inner bodies distinctly', async () => {
  // Mixed-time behavior fixture: current real outer shell plus historical inner
  // listing. It does not establish a complete or current inventory.
  const calls = [];
  const jobs = await runNative({ transport: async url => {
    calls.push(url);
    if (url === BOARD) return { ...liveFrame.responses[BOARD], body: Buffer.from(liveFrame.responses[BOARD].bodyBase64, 'base64') };
    if (url === framedBoard) return { ...fixture.responses[BOARD], url, body: Buffer.from(fixture.responses[BOARD].bodyBase64, 'base64'), provenance: { derivedMixedClockBehaviorTest: true } };
    return transport(url);
  } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].postingDate, '2024-10-21T01:48:11.318Z');
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  assert.equal(calls.filter(url => url === framedBoard).length, 2);
  assert.ok(jobs[0].nativeCollectionEvidence.retainedResponses.some(response => response.url === BOARD && response.bodySHA256 === liveFrame.responses[BOARD].provenance.bodySHA256));
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);
  assert.ok(calls.every(url => { validateURL(url); return !/\/login|\/apply|candidate|form\//.test(url); }));
});

test('active corporate Sitecore careers components establish the precise unfiltered regional handoff', () => {
  assert.equal(verifyCorporateHandoff(careersHTML).boardURL, BOARD);
  assert.equal(verifyCorporateHandoff(careersHTML).source, 'native-application/json-__JSS_STATE__');
  assert.throws(() => verifyCorporateHandoff(jss(value => { value.sitecore.context.itemPath = '/other'; })), /identity/);
  assert.throws(() => verifyCorporateHandoff(jss(value => { value.sitecore.context.pageEditing = true; })), /identity/);
  const removeActive = jss(value => { value.sitecore.route.placeholders['jss-ceweb-main'] = []; });
  assert.throws(() => verifyCorporateHandoff(removeActive), /CareersCelanese/);
  const earlyOnly = jss(value => {
    const section = value.sitecore.route.placeholders['jss-ceweb-main'].find(node => node.fields?.sectionId?.value === 'CareersCelanese');
    section.placeholders['jss-ceweb-section'][0].fields.featureList = section.placeholders['jss-ceweb-section'][0].fields.featureList.filter(node => node.name === 'Early Career');
  });
  assert.throws(() => verifyCorporateHandoff(earlyOnly), /By Region/);
});

test('all native description sections and source clocks survive while native2024 remains outside the date window', async () => {
  const jobs = await runNative({ transport }), job = jobs[0];
  assert.equal(job.nativeVisibleDescriptionHTML, fixture.oracle.descriptionHTML);
  assert.equal(job.nativeSchemaDescription, fixture.oracle.nativeJobPosting.description);
  assert.deepEqual(job.nativeFacts.nativeDescriptionSections.map(section => section.bodyHTML), fixture.oracle.sections.map(section => section.bodyHTML));
  assert.equal(job.nativeFacts.nativeDescriptionSections.length, 3);
  assert.equal(job.jobId, '23787');
  assert.equal(job.nativeListingJobLabel, '2026-23787');
  assert.equal(job.requisitionId, null);
  assert.equal(job.postingDate, '2024-10-21T01:48:11.318Z');
  assert.equal(job.closingDate, '2027-10-21T01:48:11.318Z');
  assert.equal(job.firstEverPublication, null);
  assert.equal(job.legalEmployer, null);
  assert.equal(job.nativeHiringOrganization.name, 'Celanese International Corporation');
  const posted = resolveJobPostedAt({ ...job, scrapedAt: '2026-10-22T00:00:00Z' });
  assert.equal(posted.toISOString(), job.postingDate);
  assert.ok(posted < buildPublishableJobPostedAtCutoff(new Date('2026-10-22T00:00:00Z')));
  assert.equal(job.sourceScopeComplete, false);
  assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(job.publicEligibility, null);
  for (const capture of job.nativeCollectionEvidence.retainedResponses) {
    assert.equal(capture.rawBodyBase64, fixture.responses[capture.url].bodyBase64);
    assert.deepEqual(capture.provenance, fixture.responses[capture.url].provenance);
    assert.equal(capture.bodySHA256, crypto.createHash('sha256').update(Buffer.from(capture.rawBodyBase64, 'base64')).digest('hex'));
  }
});

test('all three pages are followed; missing-country Tokyo labels are checked rather than guessed as Japan', async () => {
  const calls = [], delegate = injected(allPages);
  const result = await collect({ transport: async url => { calls.push(url); return delegate(url); } });
  assert.equal(result.pagesFetched, 3);
  assert.equal(result.observedListingCount, 47);
  assert.equal(result.listingRecords.length, 47);
  assert.equal(result.nativeReportedTotal, null);
  assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.candidateDetails, 8);
  assert.equal(result.failures.length, 7);
  assert.equal(result.closingInventoryMatches, true);
  const tokyo = first.records.filter(row => row.nativeCountryLabel === null && row.nativeCityLabel === 'Tokyo');
  assert.equal(tokyo.length, 4);
  for (const record of tokyo) assert.ok(calls.includes(record.url));
  assert.ok(calls.includes(pageURL(3)));
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  assert.ok(calls.every(url => { validateURL(url); return !/mode=apply|login|consent|referral/.test(url); }));
  for (const count of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(result[count], null);
});

test('typed and visible country/city evidence must agree, and state sentinels stay unknown', async () => {
  const original = parseDetail(detailHTML, row);
  assert.equal(original.nativeCountryAddresses[0].nativeCountryRaw, 'IN');
  assert.equal(original.nativeCountryAddresses[0].raw.addressRegion, 'UNAVAILABLE');
  for (const mutate of [
    value => { value.jobLocation[0].address.addressCountry = 'US'; },
    value => { value.jobLocation[0].address.addressLocality = 'New Delhi'; },
    value => { delete value.jobLocation[0].address.addressCountry; },
    value => { delete value.jobLocation[0].address.addressLocality; },
  ]) assert.throws(() => parseDetail(posting(mutate), row), /country|city/i);
  assert.throws(() => parseDetail(posting(value => { value.jobLocation[0].address.addressRegion = {}; }), row), /state|region/);
  for (const raw of ['UNAVAILABLE', ' unavailable ']) {
    const jobs = await runNative({ transport: injected({ [fixture.oracle.roleURL]: posting(value => { value.jobLocation[0].address.addressRegion = raw; }) }) });
    assert.equal(jobs[0].location, 'Hyderabad, India');
    assert.equal(jobs[0].city, 'Hyderabad');
    assert.equal(jobs[0].state, null);
    assert.equal(jobs[0].nativeCountryAddresses[0].raw.addressRegion, raw);
  }
});

test('only terminal-colon heading formatting is tolerated; full content and all section headings remain required', () => {
  assert.equal(compareDescriptions(fixture.oracle.descriptionHTML, fixture.oracle.nativeJobPosting.description), true);
  assert.throws(() => parseDetail(posting(value => { value.description += '<p>Unmatched extra job content</p>'; }), row), /description/);
  assert.throws(() => parseDetail(posting(value => { value.description = '<p>Short preview only</p>'; }), row), /description/);
  const missingHeading = replaceOnce(detailHTML, 'Responsibilities 职责:', 'Different section:');
  assert.throws(() => parseDetail(missingHeading, row), /heading|description/);
  const doc = document(detailHTML), empty = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'iCIMS_InfoMsg_Job'))[2];
  const incomplete = detailHTML.slice(0, empty.openEnd) + detailHTML.slice(empty.closeStart);
  assert.throws(() => parseDetail(incomplete, row), /section/);
  assert.throws(() => parseDetail(posting(value => { value.datePosted = '2024-02-30T00:00:00Z'; }), row), /calendar/);
  assert.throws(() => parseDetail(posting(value => { delete value.datePosted; }), row), /publication/);
  const other = parseDetail(posting(value => { value.hiringOrganization.name = 'Different employer'; }), row);
  assert.equal(other.excluded, true);
  assert.equal(other.nativeHiringOrganization.name, 'Different employer');
});

test('the known static asset base is never a read destination and job/page/application links must be absolute', () => {
  assert.throws(() => validateURL(ASSET_BASE + '/'), /origin/);
  assert.throws(() => readNativeJobPosting(detailHTML, row, {}), /Unreviewed.*base/); // Existing callers have no implicit base allowance.
  assert.throws(() => parseListing(replaceOnce(boardHTML, ASSET_BASE, 'https://other.invalid')), /base/);
  assert.throws(() => parseDetail(replaceOnce(detailHTML, ASSET_BASE, 'https://other.invalid'), row), /base/);
  const relative = boardHTML.replace('href="' + first.records[0].url + '"', 'href="' + new URL(first.records[0].url).pathname + '"');
  assert.ok(relative !== boardHTML);
  const listing = parseListing(relative);
  assert.equal(listing.errors.length, 1);
  assert.equal(listing.records.length, 19);
  const wrongApp = detailHTML.replaceAll('/jobs/23787/', '/jobs/99999/');
  assert.ok(wrongApp !== detailHTML);
  assert.throws(() => parseDetail(wrongApp, row), /application/);
  assert.equal(parseDetail(detailHTML, row).nativeApplicationURL, fixture.oracle.nativeApplicationURL);
  for (const url of [fixture.oracle.nativeApplicationURL, ORIGIN + '/jobs/login', ORIGIN + '/jobs/search?pr=1&searchPositionType=17638', ORIGIN + '/jobs/search?pr=1&pr=2', ORIGIN.replace('asia', 'global') + '/jobs/search?pr=1&', pageURL(2).replace('https:', 'http:')]) assert.throws(() => validateURL(url));
});

test('missing pages, duplicate identities and changed closing listings preserve known good role facts', async () => {
  const duplicate = syntheticPage(2, 3, 20, Array.from({ length: 20 }, (_, index) => card(index === 0 ? '23787' : 58000 + index)).join(''));
  const result = await collect({ transport: injected({ [pageURL(2)]: duplicate }) });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.listingPaginationComplete, false);
  assert.ok(result.failures.some(failure => failure.stage === 'native-listing-duplicate'));
  const skipped = replaceOnce(boardHTML, 'Next page of results</span>', 'Missing continuation</span>');
  assert.throws(() => parseListing(skipped), /continuation/);
  let reads = 0;
  const changed = replaceOnce(boardHTML, '2026-23787', '2025-23787');
  const closing = await collect({ transport: async url => url === BOARD && ++reads === 2 ? injected({ [BOARD]: changed })(url) : transport(url) });
  assert.equal(closing.jobs.length, 1);
  assert.equal(closing.closingInventoryMatches, false);
  assert.ok(closing.failures.some(failure => failure.stage === 'closing-inventory'));
  assert.equal(closing.cleanupAllowed, false);
});

test('empty, incomplete and failed upstream responses retain typed unknown diagnostics through the catalog', async () => {
  const selected = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'celanese'));
  for (const changes of [
    { [BOARD]: syntheticPage(1, 1, 0) },
    { [fixture.oracle.roleURL]: '<html>No role description</html>' },
    { [CAREERS]: { url: CAREERS, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Unavailable'), bodyComplete: true } },
    { [BOARD]: { url: BOARD, status: 302, headers: { location: fixture.oracle.nativeApplicationURL }, body: Buffer.alloc(0), bodyComplete: true } },
  ]) await assert.rejects(selected.run({ transport: injected(changes) }), error => {
    assert.equal(error.code, 'NATIVE_HTML_INCOMPLETE');
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false);
    assert.equal(error.nativeEvidence.rawJobs, null);
    assert.equal(error.nativeEvidence.cleanupAllowed, false);
    const details = extractionFailureDetails(error);
    assert.ok(details.failureEvidence.failureCount >= 1);
    assert.equal(details.failureEvidence.inventoryComplete, false);
    return true;
  });
});

test('a successful foreign-only regional page is still a coverage gap rather than a verified zero India inventory', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'celanese')).run({ transport: injected({ [BOARD]: syntheticPage(1, 1, 1) }) });
  assert.equal(jobs.length, 0);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null);
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null);
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
});
