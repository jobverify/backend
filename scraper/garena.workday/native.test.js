import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js';
import { decodeNuxt } from './literal.js';
import { HOME, PORTAL, BOARD, detailURL, parseListing, parseDetail, pageModel } from './parser.js';
import { collect, runNative } from './native.js';
import { createNativeTransport, validateURL, redirectURL, MAX_BYTES } from './transport.js';
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js';
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js';
import { extractionFailureDetails } from '../../scripts/catalogExtractionFailureEvidence.js';
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-071.json.gz', import.meta.url))));
const transport = async url => {
  const response = fixture.responses[url];
  if (!response) throw Object.assign(Error('Explicit simulated missing retained Garena detail'), { code: 'FIXTURE_UNRETAINED' });
  return { ...response, body: Buffer.from(response.bodyBase64, 'base64') };
};
test('selected Garena catalog extracts genuine full role beside six unretained details', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'garena')).run({ transport });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, fixture.oracle.id);
  assert.equal(jobs[0].nativeCollectionEvidence.observedListingCount, 85);
  assert.equal(jobs[0].nativeCollectionEvidence.publicLocationCandidates, 7);
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 6);
});
const body = url => Buffer.from(fixture.responses[url].bodyBase64, 'base64').toString('utf8');
const boardHTML = body(BOARD), detailHTML = body(fixture.oracle.sourceURL);
const listing = parseListing(boardHTML), record = listing.records.find(item => item.id === fixture.oracle.id);
const injected = changes => async url => {
  if (Object.hasOwn(changes, url)) {
    const change = changes[url];
    if (change instanceof Error) throw change;
    if (typeof change === 'string') return { ...await transport(url), body: Buffer.from(change) };
    return { ...await transport(url), ...change };
  }
  return transport(url);
};
// These are explicitly DERIVED test responses, never retained native captures.
const literal = model => 'window.__NUXT__=(function(){return ' + JSON.stringify(model).replace(/</g, '\\u003C') + '}());';
function derivedHTML(html, mutate) {
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(value => value.includes('window.__NUXT__='));
  const model = decodeNuxt(source); mutate(model);
  return html.replace(source, literal(model));
}
const plain = html => { const doc = document(html); return doc.text(doc.root); };

test('all serialized pages and existing public location candidates are processed', async () => {
  const calls = [], result = await collect({ transport: async url => { calls.push(url); return transport(url); } });
  assert.equal(listing.records.length, 85);
  assert.equal(new Set(listing.records.map(item => item.id)).size, 85);
  assert.equal(listing.uiFirstPageCards, 10);
  assert.equal(listing.uiPageCount, 9);
  assert.equal(listing.categoryAdvertisedSum, 73);
  assert.equal(listing.categoryCountDifference, 12); // Preserved facet discrepancy, not an authoritative total.
  assert.equal(result.publicLocationCandidates, 7); // Includes Remote under the existing rule.
  assert.equal(result.closingInventoryMatches, true);
  assert.equal(calls.filter(url => url === BOARD).length, 2);
  assert.ok(calls.includes(detailURL('J02151385'))); // A Bangalore role beyond the visible ten.
  assert.ok(calls.includes(detailURL('J02187012'))); // Remote detail must also be checked.
  assert.equal(result.unknownRawFailures.length, 6);
  assert.equal(calls.length, 11);
  assert.ok(calls.every(url => { validateURL(url); return !url.includes('workatsea'); }));
});

test('original fields, complete descriptions, native IDs and response clocks survive catalog decoration', async () => {
  const direct = await runNative({ transport }), job = direct[0], evidence = job.nativeCollectionEvidence;
  assert.equal(job.jobId, 'J02008101');
  assert.equal(job.requisitionId, null);
  assert.equal(job.nativeJobDescriptionHTML, fixture.oracle.nativeJobDescriptionHTML);
  assert.equal(job.nativeJobRequirementsHTML, fixture.oracle.nativeJobRequirementsHTML);
  assert.equal(job.postingDate, null);
  assert.equal(job.nativePublicationDate, null);
  assert.equal(job.firstEverPublication, null);
  assert.equal(job.nativeApplicationURL, null);
  assert.equal(job.applyUrl, null);
  assert.equal(job.link, fixture.oracle.sourceURL);
  assert.equal(job.country, null);
  assert.deepEqual(job.nativeLocations, ['Bangalore']);
  assert.equal(job.applicationVisited, false);
  assert.equal(job.sourceScopeComplete, false);
  assert.equal(job.lifecycleCleanupAllowed, false);
  assert.equal(readInventoryEvidence(direct).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(direct).reportedTotal, 85);
  for (const item of evidence.retainedResponses) {
    assert.equal(item.rawBodyBase64, fixture.responses[item.url].bodyBase64);
    assert.deepEqual(item.provenance, fixture.responses[item.url].provenance);
  }
  const decorated = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'garena')).run({ transport });
  assert.equal(decorated[0].nativeJobRequirementsHTML, fixture.oracle.nativeJobRequirementsHTML);
  assert.equal(decorated[0].nativeFacts.sourcePublicationDate, null);
  assert.equal(decorated[0].nativeCollectionEvidence.failures.length, 6);
});

test('visible native locations and full description must corroborate serialized detail', () => {
  const changedLocation = detailHTML.replace(/(<div class="tags">[\s\S]*?<span>\s*)Bangalore/, '$1Singapore');
  assert.notEqual(changedLocation, detailHTML);
  assert.throws(() => parseDetail(changedLocation, record), /visible|location|tag/i);
  const changedDescription = detailHTML.replace('Developing and implementing revenue strategies', 'Unrelated substituted description');
  assert.notEqual(changedDescription, detailHTML);
  assert.throws(() => parseDetail(changedDescription, record), /visible|description|content/i);
});

test('pagination, duplicate IDs, missing content and country/app identity drift are unknown failures', () => {
  assert.throws(() => parseListing(boardHTML.replace('of 9', 'of 8')), /pagination/);
  assert.throws(() => parseListing(derivedHTML(boardHTML, model => { model.state.Job.jobList[1].id = model.state.Job.jobList[0].id; })), /Duplicate/);
  assert.throws(() => parseListing(derivedHTML(boardHTML, model => { model.state.Job.jobList[0].tags.country = ['United States']; })), /Unreviewed/);
  const closed = detailHTML.replace('<div class="job-detail-page">', '<div class="job-detail-page"><p>This job is no longer available</p>');
  assert.notEqual(closed, detailHTML);
  assert.throws(() => parseDetail(closed, record), /visibly closed/);
  for (const mutate of [
    model => { model.state.Job.jobDetail.jobRequirements = ''; },
    model => { model.state.Job.jobDetail.id = 'J99999999'; },
    model => { model.state.Job.jobDetail.country = 'United States'; },
    model => { model.state.Job.jobDetail.tags.location = ['Singapore']; },
    model => { model.state.Job.jobDetail.applyUrl = 'https://evil.example/apply'; },
    model => { model.config.ATS_HOST = 'https://evil.example'; },
  ]) assert.throws(() => parseDetail(derivedHTML(detailHTML, mutate), record));
});

test('no-output upstream and malformed detail failures retain typed evidence through real catalog', async () => {
  const scraper = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'garena'));
  const timeout = Object.assign(Error('fetch failed'), { cause: Object.assign(Error('connect timeout password=hidden'), { code: 'ETIMEDOUT' }) });
  for (const [options, stage] of [
    [{ transport: async () => { throw timeout; } }, 'corporate-home'],
    [{ transport: injected({ [HOME]: { status: 503 } }) }, 'corporate-home'],
    [{ transport: injected({ [fixture.oracle.sourceURL]: derivedHTML(detailHTML, model => { model.state.Job.jobDetail.jobDescription = ''; }) }) }, 'native-detail'],
  ]) await assert.rejects(() => scraper.run(options), error => {
    assert.equal(error.code, 'GARENA_NATIVE_INCOMPLETE');
    assert.equal(error.nativeEvidence.cleanupAllowed, false);
    assert.equal(error.nativeEvidence.verifiedZeroInventory, false);
    for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs']) assert.equal(error.nativeEvidence[key], null);
    const details = extractionFailureDetails(error);
    assert.ok(details.failureEvidence.reasons.some(item => item.stage === stage));
    if (error.nativeEvidence.failures[0].cause?.code === 'ETIMEDOUT') assert.equal(details.failureKind, 'network_or_timeout');
    assert.doesNotMatch(JSON.stringify(details), /password=hidden/);
    return true;
  });
});

test('closing inventory drift preserves good role and explicit incomplete evidence', async () => {
  let boardReads = 0;
  const changed = derivedHTML(boardHTML, model => { model.state.Job.jobList.pop(); });
  const jobs = await runNative({ transport: async url => {
    if (url === BOARD && ++boardReads === 2) return { ...await transport(url), body: Buffer.from(changed) };
    return transport(url);
  } });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, false);
  assert.ok(jobs[0].nativeCollectionEvidence.failures.some(item => item.stage === 'closing-inventory'));
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);
});

test('fully read non-India-only derived inventory remains coverage-gap, never verified zero', async () => {
  const model = pageModel(boardHTML, '/global/careers').model;
  model.state.Job.jobList = [model.state.Job.jobList[0]]; // Original Singapore role.
  const row = model.state.Job.jobList[0];
  const escaped = row.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const derived = '<a class="job-item" href="/global/careers/' + row.id + '"><div class="title">' + escaped + '</div></a><div class="page-desc"><span>1</span> of 1</div><script>' + literal(model) + '</script>';
  const result = await collect({ transport: injected({ [BOARD]: derived }) });
  assert.equal(result.observedListingCount, 1);
  assert.equal(result.publicLocationCandidates, 0);
  assert.equal(result.failures.length, 0);
  const jobs = await runNative({ transport: injected({ [BOARD]: derived }) });
  assert.equal(jobs.length, 0);
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap');
  assert.equal(readInventoryEvidence(jobs).listingComplete, false);
  assert.equal(result.verifiedZeroInventory, false);
});

test('literal decoder rejects executable or late-changing source without running it', () => {
  const valid = 'window.__NUXT__=(function(a){return {field:a,nested:[true,false,null,5]}}("value"));';
  assert.equal(decodeNuxt(valid).field, 'value');
  for (const bad of [valid + 'window.__NUXT__={};', valid.replace('field:a', 'field:fetch("https://evil.example")'), valid.replace('field:a', 'field:unbound'), valid.replace('function(a)', 'function(a,a)'), valid.replace('function(a)', 'function(true)').replace('field:a', 'field:true'), valid.replace('field:a', '__proto__:a'), valid.replace('field:a', 'field:a,field:a')]) assert.throws(() => decodeNuxt(bad));
});

test('default GET transport bounds streams, omits credentials and rejects application/HTTP paths', async () => {
  const calls = [];
  const response = (url, body) => ({ url, status: 200, headers: new Headers({ 'content-type': 'text/html' }), body });
  const adapter = createNativeTransport({ fetchImpl: async (url, options) => { calls.push([url, options]); return response(url, new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('native')); controller.close(); } })); } });
  assert.equal((await adapter(HOME)).body.toString(), 'native');
  assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(calls[0][1].redirect, 'manual');
  assert.equal(calls[0][1].method, 'GET');
  for (const url of ['http://careers.garena.com/global/', 'https://ats.workatsea.com/apply', 'https://evil.example/', BOARD + '?page=2', BOARD + '#apply']) assert.throws(() => validateURL(url));
  assert.equal(redirectURL(BOARD, BOARD + '/'), BOARD + '/');
  for (const url of [HOME, detailURL('J99999999'), 'http://careers.garena.com/global/careers']) assert.throws(() => redirectURL(BOARD, url));
  const emptyRedirect = await createNativeTransport({ fetchImpl: async url => ({ url, status: 302, headers: new Headers({ location: BOARD + '/', 'content-length': '0' }), body: null }) })(BOARD);
  assert.equal(emptyRedirect.body.length, 0);
  assert.equal(emptyRedirect.bodyComplete, true);
  let canceled = false;
  const over = createNativeTransport({ fetchImpl: async url => response(url, new ReadableStream({ start(controller) { controller.enqueue(Buffer.alloc(MAX_BYTES + 1)); }, cancel() { canceled = true; } })) });
  await assert.rejects(() => over(HOME), /body limit/); assert.equal(canceled, true);
  for (const fetchImpl of [() => new Promise(() => {}), async url => response(url, new ReadableStream())]) await assert.rejects(() => createNativeTransport({ fetchImpl, timeoutMs: 10 })(HOME), error => error.code === 'ETIMEDOUT');
});
