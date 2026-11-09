import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js';
import { CAREERS, BOARD, ORGANIZATION_ID, readModel, parseListing, parseDetail, verifyCorporateHandoff, roleURL, validateURL } from './parser.js';
import { collect, runNative } from './native.js';
import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js';
import { extractionFailureDetails } from '../../scripts/catalogExtractionFailureEvidence.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-075.json.gz', import.meta.url))));
const transport = async url => {
  const response = fixture.responses[url];
  if (!response) throw Object.assign(Error('Explicit simulated uncaptured Fynd role detail'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
test('Fynd catalog extracts full native Mumbai role while80 other candidate details remain unknown', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'fynd')).run({ transport });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.internalID);
  assert.equal(jobs[0].nativePublicToken, fixture.oracle.publicToken);
  assert.equal(jobs[0].nativeInternalID, fixture.oracle.internalID);
  assert.equal(jobs[0].postingDate, fixture.oracle.nativePublishedAt);
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 84);
  assert.equal(jobs[0].nativeCollectionEvidence.candidateDetails, 81);
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 80);
});
const body = url => Buffer.from(fixture.responses[url].bodyBase64, 'base64').toString('utf8');
const boardHTML = body(BOARD), detailHTML = body(fixture.oracle.roleURL), careersHTML = body(CAREERS);
const first = parseListing(boardHTML), row = first.records.find(row => row.publicToken === fixture.oracle.publicToken);
const replaceOnce = (html, from, to) => { assert.ok(html.includes(from), 'The fixture mutation must apply'); return html.replace(from, to); };
const injected = changes => async url => {
  if (!Object.hasOwn(changes, url)) return transport(url);
  const value = changes[url]; if (value instanceof Error) throw value;
  if (typeof value === 'string') return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(value), bodyComplete: true, provenance: { derivedTestResponse: true } };
  return value;
};
function mutateModel(html, mutate) {
  const doc = document(html), node = doc.nodes(node => node.tag === 'script' && node.raw.startsWith('window.__INITIAL_DATA__='))[0], model = readModel(html);
  mutate(model);
  const source = 'window.__INITIAL_DATA__=' + JSON.stringify(model).replace(/</g, '\\u003c') + ';window.__SSR_PUBLIC_ROUTE__=true;';
  return html.slice(0, node.openEnd) + source + html.slice(node.closeStart);
}
const roleModel = mutate => mutateModel(detailHTML, mutate);

test('all84 primary roles reconcile with the complete model without counting six carousel duplicates', async () => {
  const calls = [], result = await collect({ transport: async url => { calls.push(url); return transport(url); } });
  assert.equal(first.records.length, 84);
  assert.equal(first.nativeSerializedJobs, 84);
  assert.equal(first.reportedTotal, 84);
  assert.equal(first.errors.length, 0);
  assert.equal(first.carouselExcluded, true);
  assert.equal(new Set(first.records.map(row => row.id)).size, 84);
  assert.equal(new Set(first.records.map(row => row.publicToken)).size, 84);
  assert.equal(first.records.filter(row => row.geography.country === 'India').length, 80);
  assert.equal(first.records.filter(row => !row.geography.country).length, 1);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.listingPaginationComplete, true);
  assert.equal(result.closingInventoryMatches, true);
  assert.equal(result.failures.length, 80);
  assert.equal(result.jobs.length, 1);
  const unknown = first.records.find(row => !row.geography.country);
  assert.equal(unknown.geography.rawLocation, 'Tirupati/Mumbai');
  assert.ok(calls.includes(unknown.url)); // No city-only country inference.
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  assert.ok(calls.every(url => { validateURL(url); return !/candidate|login|apply|beacon|brandfetch/.test(url); }));
  for (const field of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(result[field], null);
});

test('public token and internal identity remain separate and a genuine full role passes unchanged eligibility rules', async () => {
  const jobs = await runNative({ transport }), job = jobs[0];
  assert.equal(job.jobId, 'cmvf7dg0m041u12k1c9x8ys8c');
  assert.equal(job.nativePublicToken, 'ZfyxR-meX87ioJnQ59-mMA');
  assert.equal(job.nativeInternalID, 'cmvf7dg0m041u12k1c9x8ys8c');
  assert.equal(job.requisitionId, null);
  assert.equal(job.postingDate, '2026-10-19T11:46:18.300Z');
  assert.equal(job.postedAt, job.postingDate);
  assert.equal(job.firstEverPublication, null);
  assert.equal(job.closingDate, null);
  assert.equal(job.legalEmployer, null);
  assert.equal(job.nativeJobPosting, null);
  assert.equal(job.nativeFacts.nativeJob.status, 'PUBLISHED');
  assert.equal(job.nativeFacts.nativeJob.applyAllowed, true);
  assert.equal(job.country, 'India');
  assert.equal(job.countryCode, null);
  assert.equal(job.city, 'Mumbai');
  assert.equal(job.state, 'MH'); // Native label, not an inferred expansion.
  assert.equal(job.location, 'Mumbai, MH, India');
  assert.equal(job.applicationVisited, false);
  const application = new URL(job.nativeApplicationURL);
  assert.equal(application.pathname, '/candidate/login');
  assert.equal(application.searchParams.get('redirect'), '/candidate/jobs/' + job.nativeInternalID + '/apply');
  assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(job.sourceScopeComplete, false);
  assert.equal(job.publicEligibility, null);
  assert.deepEqual(job.nativeFacts.nativeJob, fixture.oracle.nativeJob);
  assert.deepEqual(job.nativeFacts.nativeCareerPage, fixture.oracle.nativeCareerPage);
  assert.equal(analyzePublishableJobs(jobs, { now: new Date('2026-10-22T00:00:00Z') }).eligibleJobs.length, 1);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 84);
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null);
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
  for (const capture of job.nativeCollectionEvidence.retainedResponses) {
    assert.equal(capture.rawBodyBase64, fixture.responses[capture.url].bodyBase64);
    assert.equal(capture.bodySHA256, crypto.createHash('sha256').update(Buffer.from(capture.rawBodyBase64, 'base64')).digest('hex'));
    assert.deepEqual(capture.provenance, fixture.responses[capture.url].provenance);
  }
});

test('all visible role sections and eleven extra native technical requirements are preserved distinctly', async () => {
  const job = (await runNative({ transport }))[0];
  const visible = document(job.nativeVisibleDescriptionHTML), full = document(job.jobDescription);
  for (const heading of ['About Fynd', 'Role Overview', 'Responsibilities', 'What do we offer?', 'What happens next?']) assert.ok(visible.nodes(node => ['h2', 'h3'].includes(node.tag) && visible.text(node) === heading).length);
  assert.ok(!visible.text(visible.root).includes("Bachelor's degree in Computer Science"));
  assert.equal(job.nativeFacts.nativeSupplementalQualifications.length, 1);
  assert.equal(job.nativeFacts.nativeSupplementalQualifications[0].values.length, 11);
  for (const requirement of fixture.oracle.nativeJob.competencies.technical) assert.ok(full.text(full.root).includes(requirement));
  for (const responsibility of fixture.oracle.nativeJob.responsibilities) assert.ok(full.text(full.root).includes(responsibility));
  assert.ok(!job.nativeVisibleDescriptionHTML.includes('Similar Jobs'));
  assert.ok(!visible.text(visible.root).includes('Sign in to apply'));
  assert.ok(job.descriptionProvenance.includes('not claimed visible'));
});

test('corporate iframe binding excludes hidden frames, inactive ancestors and unrelated tenants', () => {
  assert.equal(verifyCorporateHandoff(careersHTML).target, BOARD);
  for (const html of [
    '<iframe hidden title="Fynd open positions" src="' + BOARD + '"></iframe>',
    '<div hidden><iframe title="Fynd open positions" src="' + BOARD + '"></iframe></div>',
    '<template><iframe title="Fynd open positions" src="' + BOARD + '"></iframe></template>',
    '<iframe style="display:none" title="Fynd open positions" src="' + BOARD + '"></iframe>',
    '<iframe title="Fynd open positions" src="https://other.invalid/careers/gofynd"></iframe>',
  ]) assert.throws(() => verifyCorporateHandoff(html), /iframe|positions/);
  assert.throws(() => parseListing(mutateModel(boardHTML, value => { value.careerPage.organization.id = 'other-organization'; })), /tenant/);
  assert.throws(() => parseListing(mutateModel(boardHTML, value => { value.careerPage.organization.slug = 'other'; })), /tenant/);
});

test('native data is literal JSON only and never executes arbitrary script or private-route payloads', () => {
  assert.equal(readModel(boardHTML).careerPage.organization.id, ORGANIZATION_ID);
  const doc = document(detailHTML), script = doc.nodes(node => node.tag === 'script' && node.raw.startsWith('window.__INITIAL_DATA__='))[0];
  const altered = code => detailHTML.slice(0, script.openEnd) + code + detailHTML.slice(script.closeStart);
  const payload = JSON.stringify(readModel(detailHTML));
  globalThis.__fyndUnexpectedExecution = false;
  for (const code of [
    'window.__INITIAL_DATA__=' + payload + ';globalThis.__fyndUnexpectedExecution=true;window.__SSR_PUBLIC_ROUTE__=true;',
    'window.__INITIAL_DATA__=(function(){globalThis.__fyndUnexpectedExecution=true;return ' + payload + '})();window.__SSR_PUBLIC_ROUTE__=true;',
    'window.__INITIAL_DATA__=' + payload + ';window.__SSR_PUBLIC_ROUTE__=false;',
    'window.__INITIAL_DATA__={job:undefined};window.__SSR_PUBLIC_ROUTE__=true;',
  ]) assert.throws(() => readModel(altered(code)), /program|private|JSON/);
  assert.equal(globalThis.__fyndUnexpectedExecution, false);
  delete globalThis.__fyndUnexpectedExecution;
});

test('identity, dates, visible location and complete content must agree across model and HTML', () => {
  for (const [mutate, pattern] of [
    [value => { value.job.id = 'different-internal-ID'; }, /identity/],
    [value => { value.job.title = 'Unrelated role'; }, /title/],
    [value => { value.job.location = 'London, United Kingdom'; }, /location/],
    [value => { value.job.publishedAt = '2026-10-18T11:46:18.300Z'; }, /publication/],
    [value => { value.job.outcome = 'Short preview'; }, /overview/],
    [value => { value.job.responsibilities.pop(); }, /responsibilities/],
    [value => { value.careerPage.aboutCompany += ' Unmatched company text.'; }, /company/],
  ]) assert.throws(() => parseDetail(roleModel(mutate), row), pattern);
  assert.throws(() => parseDetail(roleModel(value => { value.careerPage.benefits.sections[1].content = value.careerPage.benefits.sections[1].content.replace('team-building', 'teambuilding'); }), row), /benefit/);
  assert.throws(() => parseDetail(roleModel(value => { delete value.job.competencies; }), row), /qualification|competenc/i);
  const changedLocation = replaceOnce(detailHTML, '>Mumbai, MH, India<', '>London, United Kingdom<');
  assert.throws(() => parseDetail(changedLocation, row), /geography/);
});

test('native closures and disabled applications override stale published listings', () => {
  for (const mutate of [value => { value.job.status = 'UNPUBLISHED'; }, value => { value.job.applyAllowed = false; }]) {
    const result = parseDetail(roleModel(mutate), row);
    assert.equal(result.excluded, true);
    assert.equal(result.exclusionReason, 'native-role-not-published-or-application-disabled');
  }
  const doc = document(detailHTML), main = doc.nodes(node => node.tag === 'main')[0];
  const closed = detailHTML.slice(0, main.openEnd) + '<p>This position has been filled.</p>' + detailHTML.slice(main.openEnd);
  assert.equal(parseDetail(closed, row).excluded, true);
});

test('unreconciled totals and missing native models preserve already validated role facts as incomplete', async () => {
  const doc = document(boardHTML), heading = doc.nodes(node => node.attrs.id === 'open-positions-heading')[0];
  const changed = boardHTML.slice(0, heading.openEnd) + 'Open Positions ( 85 )' + boardHTML.slice(heading.closeStart);
  const result = await collect({ transport: injected({ [BOARD]: changed }) });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.nativeReportedTotal, 85);
  assert.equal(result.observedListingCount, 84);
  assert.equal(result.listingPaginationComplete, false);
  assert.ok(result.failures.some(failure => failure.stage === 'native-listing-row'));
  assert.ok(result.unknownRawFailures.some(failure => failure.stage === 'native-listing-row'));
  assert.equal(result.cleanupAllowed, false);
  let boardReads = 0;
  const reordered = mutateModel(boardHTML, value => { value.jobs.reverse(); });
  const closing = await collect({ transport: async url => url === BOARD && ++boardReads === 2 ? injected({ [BOARD]: reordered })(url) : transport(url) });
  assert.equal(closing.jobs.length, 1);
  assert.equal(closing.closingInventoryMatches, false);
});

test('read paths exclude applications and upstream failures retain typed unknown evidence through the catalog', async () => {
  const application = parseDetail(detailHTML, row).nativeApplicationURL;
  for (const url of [application, BOARD + '?page=2', BOARD + '/jobs/../../candidate/login', 'https://hiring.fynd.com/candidate/login', 'https://other.invalid/careers/gofynd', CAREERS.replace('https:', 'http:')]) assert.throws(() => validateURL(url));
  const selected = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'fynd'));
  for (const change of [
    Object.assign(Error('fetch failed'), { cause: Object.assign(Error('Connection timed out'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) }),
    { url: CAREERS, status: 503, headers: { 'content-type': 'text/html' }, body: Buffer.from('Unavailable'), bodyComplete: true },
    '<html>No iframe</html>',
  ]) await assert.rejects(selected.run({ transport: injected({ [CAREERS]: change }) }), error => {
    assert.equal(error.code, 'NATIVE_HTML_INCOMPLETE');
    assert.equal(error.nativeEvidence.rawJobs, null);
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false);
    const summary = extractionFailureDetails(error);
    assert.equal(summary.failureEvidence.stage, 'native-handoff');
    assert.equal(summary.failureEvidence.inventoryComplete, false);
    return true;
  });
  await assert.rejects(selected.run({ transport: injected({ [fixture.oracle.roleURL]: '<html>No full role</html>' }) }), error => {
    assert.equal(error.nativeEvidence.jobs.length, 0);
    assert.equal(error.nativeEvidence.unknownRawFailures.length, 81);
    return true;
  });
});

test('batch evidence retains complete bodies once and compact summaries on later extracted jobs', async () => {
  // A second job is explicitly DERIVED from the captured role. It is not
  // evidence of another real vacancy or publishing result.
  const publicToken = 'synthetic_public_token_075', internalID = 'synthetic_internal_id_075';
  let expanded = mutateModel(boardHTML, model => { model.jobs.push({ ...model.jobs[0], id: internalID, publicToken }); });
  let doc = document(expanded), region = doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'open-positions-heading')[0];
  const originalCard = doc.nodes(node => node.tag === 'a' && node.attrs.href === new URL(fixture.oracle.roleURL).pathname, region)[0];
  const copy = doc.outer(originalCard).replaceAll(fixture.oracle.publicToken, publicToken);
  expanded = expanded.slice(0, region.closeStart) + copy + expanded.slice(region.closeStart);
  doc = document(expanded);
  const heading = doc.nodes(node => node.attrs.id === 'open-positions-heading')[0];
  expanded = expanded.slice(0, heading.openEnd) + 'Open Positions ( 85 )' + expanded.slice(heading.closeStart);
  const secondRole = roleModel(model => { model.job.id = internalID; }).replaceAll(fixture.oracle.internalID, internalID);
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'fynd')).run({ transport: injected({ [BOARD]: expanded, [roleURL(publicToken)]: secondRole }) });
  assert.equal(jobs.length, 2);
  assert.ok(jobs[0].nativeCollectionEvidence.retainedResponses.every(response => typeof response.rawBodyBase64 === 'string'));
  assert.ok(jobs[1].nativeCollectionEvidence.retainedResponses.every(response => !Object.hasOwn(response, 'rawBodyBase64')));
  assert.equal(jobs[1].nativeCollectionEvidence.extractedDetailJobs, 2);
  assert.equal(jobs[1].nativeCollectionEvidence.listingRecordCount, 85);
  assert.equal(jobs[1].nativeInternalID, internalID);
  assert.equal(jobs[1].jobId, internalID);
  assert.equal(jobs[1].nativePublicToken, publicToken);
  assert.ok(JSON.stringify(jobs[1]).length < JSON.stringify(jobs[0]).length / 3);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 85);
});

test('new continuation controls keep known facts incomplete and explicit zero stays a coverage gap', async () => {
  let doc = document(boardHTML), region = doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'open-positions-heading')[0];
  const more = boardHTML.slice(0, region.closeStart) + '<button>Load more roles</button>' + boardHTML.slice(region.closeStart);
  const partial = await collect({ transport: injected({ [BOARD]: more }) });
  assert.equal(partial.jobs.length, 1);
  assert.equal(partial.listingPaginationComplete, false);
  assert.equal(partial.cleanupAllowed, false);
  assert.ok(partial.failures.some(failure => failure.stage === 'native-pagination'));
  let zero = mutateModel(boardHTML, model => { model.jobs = []; });
  doc = document(zero); region = doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby'] === 'open-positions-heading')[0];
  zero = zero.slice(0, region.openEnd) + '<h2 id="open-positions-heading">Open Positions ( 0 )</h2>' + zero.slice(region.closeStart);
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'fynd')).run({ transport: injected({ [BOARD]: zero }) });
  assert.equal(jobs.length, 0);
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null);
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), false);
});

const liveFixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-075-live.json.gz', import.meta.url))));
const liveTransport = () => {
  const indices = new Map();
  return async url => {
    const index = indices.get(url) || 0, response = liveFixture.responseQueues[url]?.[index];
    assert.ok(response, 'No captured response available for this exact request sequence');
    indices.set(url, index + 1);
    return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
  };
};

test('all79 actual current candidate bodies preserve every native qualification and optional-field shape', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'fynd')).run({ transport: liveTransport() });
  assert.equal(jobs.length, 79);
  const evidence = jobs[0].nativeCollectionEvidence;
  assert.equal(evidence.observedListingCount, 82);
  assert.equal(evidence.nativeReportedTotal, 82);
  assert.equal(evidence.candidateDetails, 79);
  assert.equal(evidence.failures.length, 0);
  assert.equal(evidence.closingInventoryMatches, true);
  const expected = new Map(liveFixture.oracle.nativeDetails.map(native => [native.id, native]));
  for (const job of jobs) {
    const native = expected.get(job.nativeInternalID);
    assert.ok(native);
    assert.equal(job.jobId, native.id);
    assert.equal(job.postingDate, native.publishedAt);
    assert.equal(job.title, norm(native.title));
    assert.equal(job.location, native.location);
    const doc = document(job.jobDescription), text = doc.text(doc.root).replace(/\s+/g, '');
    const allRequirements = [...(native.qualifications?.required || []), ...(native.qualifications?.preferred || []), ...(native.competencies?.technical || []), ...(native.competencies?.soft || []), ...native.responsibilities];
    for (const requirement of allRequirements) assert.ok(text.includes(requirement.replace(/\s+/g, '')), 'Every full native requirement must survive');
  }
  const analysis = analyzePublishableJobs(jobs, { now: new Date(liveFixture.oracle.originalSourceCompletedAt) });
  assert.equal(analysis.filterCounts.emptyDescription, 0);
  assert.equal(analysis.filterCounts.invalidUrl, 0);
  assert.ok(analysis.eligibleJobs.length > liveFixture.oracle.originalEligibleSubset);
});

test('a changed public URL token does not change the persistent native job identity', async () => {
  const jobs = await runNative({ transport: liveTransport() });
  for (const mapping of liveFixture.oracle.mutablePublicTokenMappings) {
    assert.notEqual(mapping.oldPublicToken, mapping.currentPublicToken);
    const job = jobs.find(job => job.nativeInternalID === mapping.stableInternalID);
    assert.ok(job);
    assert.equal(job.jobId, mapping.stableInternalID);
    assert.equal(job.nativePublicToken, mapping.currentPublicToken);
    assert.equal(job.sourceUrl, roleURL(mapping.currentPublicToken));
  }
});

test('required and preferred qualification groups are fully corroborated rather than dropped', () => {
  const boardResponse = liveFixture.responseQueues[BOARD][0], board = parseListing(Buffer.from(boardResponse.bodyBase64, 'base64').toString('utf8'));
  const native = liveFixture.oracle.nativeDetails.find(job => job.qualifications?.required?.length && job.qualifications?.preferred?.length);
  const record = board.records.find(record => record.id === native.id);
  const html = Buffer.from(liveFixture.responseQueues[record.url][0].bodyBase64, 'base64').toString('utf8');
  const parsed = parseDetail(html, record);
  assert.deepEqual(parsed.nativeQualificationGroups.required, native.qualifications.required);
  assert.deepEqual(parsed.nativeQualificationGroups.preferred, native.qualifications.preferred);
  for (const mutate of [
    model => { model.job.qualifications.required.pop(); },
    model => { model.job.qualifications.preferred = []; },
    model => { delete model.job.qualifications.required; },
  ]) assert.throws(() => parseDetail(mutateModel(html, mutate), record), /qualification/i);
  const doc = document(html), section = doc.nodes(node => node.tag === 'section' && doc.nodes(child => child.tag === 'h2' && doc.text(child) === 'Qualifications', node).length === 1)[0], firstItem = doc.nodes(node => node.tag === 'li', section)[0];
  const truncated = html.slice(0, firstItem.openEnd) + 'Truncated native requirement' + html.slice(firstItem.closeStart);
  assert.throws(() => parseDetail(truncated, record), /qualification/);
});
