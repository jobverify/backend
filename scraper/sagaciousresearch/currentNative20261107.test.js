import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createSagaciousResearchScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
const directory = new URL('./test-data-20261107/', import.meta.url)
const fixture = JSON.parse(fs.readFileSync(new URL('manifest.json', directory)))
const engineering = 'https://sagaciousresearch.com/careers/job-opening/engineering-searching-team-senior-patent-analyst'
const replay = (change, reads = []) => {
  const counts = new Map()
  const fetchFixture = async (url, init = {}) => {
    const rows = fixture.requests.filter(row => row.requestedURL === url)
    const count = (counts.get(url) || 0) + 1; counts.set(url, count)
    const row = rows[count - 1]
    assert.ok(row, 'Only genuine captured public GET routes allowed: ' + url)
    assert.equal(init.method || 'GET', 'GET'); assert.equal(init.body, undefined)
    reads.push(url)
    if (row.status === 301 && init.redirect !== 'manual') return fetchFixture(row.location, init)
    const original = gunzipSync(fs.readFileSync(new URL(row.bodySHA256 + '.gz', directory)))
    assert.equal(createHash('sha256').update(original).digest('hex'), row.bodySHA256)
    const response = new Response(change?.(original.toString(), row, count) ?? original, { status: row.status,
      headers: { ...(row.contentType ? { 'content-type': row.contentType } : {}), ...(row.location ? { location: row.location } : {}) } })
    Object.defineProperty(response, 'url', { value: row.finalURL }); return response
  }
  return fetchFixture
}
const read = (t, change, reads) => {
  const fetchImpl = replay(change, reads)
  t.mock.method(globalThis, 'fetch', fetchImpl)
  return createCatalogScraper(getScraperCatalog().find(row => row.source === 'sagaciousresearch'))
    .run({ fetchImpl, now: () => '2026-11-06T19:10:00.000Z' })
}
test('Sagacious registered reader retains only three current visible native India roles with full closing criteria', async t => {
  const reads = [], jobs = await read(t, undefined, reads)
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(job => job.nativeSourceRecord.pageId).sort(), [...fixture.expectedActivePageIds].sort())
  for (const job of jobs) {
    assert.equal(job.country, 'India'); assert.equal(job.nativeEmployer, 'Sagacious IP')
    assert.equal(job.company, 'Sagacious Research'); assert.equal(job.requisitionId, null)
    assert.equal(job.postingDate, null); assert.equal(job.closingDate, null)
    assert.equal(job.sourceDescription, job.nativeSourceRecord.criteriaHTML)
    assert.deepEqual(Object.fromEntries(Object.entries(job.nativeClosingSourceRecord).filter(([key]) => key !== 'criteriaHTML')),
      Object.fromEntries(Object.entries(job.nativeSourceRecord).filter(([key]) => key !== 'criteriaHTML')))
    assert.ok(job.nativeSourceRecord.criteriaText.length > 1800)
    assert.match(job.nativeSourceRecord.criteriaText, /Desired Educational Qualifications/)
    assert.equal(job.sourceDetailComplete, true); assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false); assert.equal(job.activeApplyVerified, false)
    assert.equal(job.applicationVisited, false)
  }
  const observation = jobs[Symbol.for('jobverify.verified-recruitment-observations')]
  assert.equal(observation.nativeRecords, 4)
  assert.equal(observation.requestCount, 42)
  assert.equal(observation.receipts.filter(row => row.status === 200).length, 34)
  assert.equal(observation.receipts.filter(row => row.status === 301).length, 8)
  assert.equal(observation.hiddenListingCards, 17)
  assert.equal(observation.exclusions.length, 1)
  assert.equal(observation.exclusions[0].nativePageId, '41554')
  assert.match(observation.exclusions[0].closedNotice, /application window.*closed/i)
  assert.match(observation.exclusions[0].hiddenCriteriaAudit, /Desired Educational Qualifications/)
  assert.ok(reads.every(url => !url.includes('/apply-now')))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs.find(job => job.nativeSourceRecord.pageId === '38537').applyUrl,
    'https://sagaciousresearch.com/careers-/job-opening/drafting-and-prosecution-experts/apply-now/')
})
test('Sagacious active closed notice withholds the role while hidden legacy notices do not erase active roles', async t => {
  const jobs = await read(t, (body, row) => row.requestedURL === engineering
    ? body.replace('Company Overview', 'The application window for this position has now closed. Company Overview') : body)
  assert.equal(jobs.length, 2)
})
test('Sagacious withholds a role with a current visible hiring hold', async t => {
  const jobs = await read(t, (body, row) => row.requestedURL === engineering
    ? body.replace('Company Overview', 'This position is currently on hold. Company Overview') : body)
  assert.equal(jobs.length, 2)
})

for (const sentence of [
  'This position remains unfilled and is accepting applications.',
  'This position has not been filled.',
  'This position has never been filled.',
  'The application window for this position has not closed.',
  'This position is not currently on hold.',
  'Hiring has not paused for this position.',
]) test('Sagacious keeps the current native role for nonclosure wording: ' + sentence, async t => {
  const jobs = await read(t, (body, row) => row.requestedURL === engineering
    ? body.replace('Company Overview', sentence + ' Company Overview') : body)
  assert.equal(jobs.length, 3)
  assert.ok(jobs.some(job => job.nativeSourceRecord.pageId === '38684'))
  assert.ok(!jobs[Symbol.for('jobverify.verified-recruitment-observations')].exclusions.some(row => row.nativePageId === '38684'))
})

for (const sentence of ['This position has been filled.', 'This role is now closed.', 'Hiring is currently paused for this position.']) {
  test('Sagacious keeps affirmative native closure authoritative: ' + sentence, async t => {
    const jobs = await read(t, (body, row) => row.requestedURL === engineering
      ? body.replace('Company Overview', sentence + ' Company Overview') : body)
    assert.equal(jobs.length, 2)
    assert.ok(!jobs.some(job => job.nativeSourceRecord.pageId === '38684'))
  })
}

test('Sagacious rejects two native Company Overview heading sections instead of choosing a name match', async t => {
  await assert.rejects(read(t, (body, row) => {
    if (row.requestedURL !== engineering) return body
    const heading = /<div\b[^>]*data-widget_type="heading\.default"[^>]*>\s*<div\b[^>]*class="elementor-widget-container"[^>]*>\s*<div\b[^>]*class="elementor-heading-title elementor-size-default"[^>]*>Company Overview<\/div>\s*<\/div>\s*<\/div>/
    assert.ok(heading.test(body), 'Must duplicate the genuine native heading widget')
    return body.replace(heading, '$&$&')
  }), /employer|Company Overview|ambiguous/i)
})

test('Sagacious rejects the actual adjacent foreign employer even while Sagacious IP remains elsewhere', async t => {
  await assert.rejects(read(t, (body, row) => {
    if (row.requestedURL !== engineering) return body
    assert.ok(body.includes('Sagacious IP is the world'), 'Actual native Company Overview text must be present')
    const changed = body.replaceAll('Sagacious IP is the world', 'Unrelated Employer is the world')
    assert.ok(changed.includes('Sagacious IP'), 'Unrelated native page carriers must still contain the official publisher name')
    return changed
  }), /employer/i)
})
test('Sagacious rejects a current role whose full native criteria become hidden', async t => {
  await assert.rejects(read(t, (body, row) => row.requestedURL === engineering
    ? body.replace('data-id="71d9acf"', 'data-id="71d9acf" hidden') : body), /criteria|description/i)
})
test('Sagacious rejects role-owned foreign country instead of inferring India from company offices', async t => {
  await assert.rejects(read(t, (body, row) => row.requestedURL === engineering
    ? body.replaceAll('(India)', '(United States)') : body), /country|location|identity/i)
})
test('Sagacious cannot use a hidden old India location beside a current visible foreign role location', async t => {
  await assert.rejects(read(t, (body, row) => row.requestedURL === engineering
    ? body.replaceAll('Gurugram, Nagpur (India)', 'Gurugram, Nagpur (United States)<span hidden>Gurugram, Nagpur (India)</span>') : body), /country|location|identity/i)
})
test('Sagacious rejects a foreign employer on its current native role page', async t => {
  await assert.rejects(read(t, (body, row) => row.requestedURL === engineering
    ? body.replaceAll('Sagacious IP', 'Unrelated Employer') : body), /employer|publisher|identity|surface/i)
})
test('Sagacious rejects unreviewed responsive CSS instead of publishing hidden native criteria', async t => {
  await assert.rejects(read(t, (body, row) => row.contentType === 'text/css' ? body + '\n/* new visibility */' : body), /CSS|visibility/i)
})
test('Sagacious rejects changed closing full criteria', async t => {
  await assert.rejects(read(t, (body, row, count) => row.requestedURL === engineering && count === 2
    ? body.replace('Ensuring the performance', 'Changing the performance') : body), /closing|criteria/i)
})
test('Sagacious preserves actual full HTML while comparing only reviewed numeric background-slider render instances separately', async t => {
  const jobs = await read(t, (body, row, count) => row.requestedURL.includes('/job-opening/') && count === 2
    ? body.replace(/data-eae-slider="\d+"/g, 'data-eae-slider="43210"') : body)
  assert.equal(jobs.length, 3)
  for (const job of jobs) {
    assert.notEqual(job.nativeSourceRecord.criteriaHTML, job.nativeClosingSourceRecord.criteriaHTML)
    assert.equal(job.nativeSourceRecord.criteriaText, job.nativeClosingSourceRecord.criteriaText)
    assert.equal(job.nativeSourceRecord.criteriaComparisonSHA256, job.nativeClosingSourceRecord.criteriaComparisonSHA256)
  }
})
test('Sagacious rejects a closing native role application link change', async t => {
  await assert.rejects(read(t, (body, row, count) => row.requestedURL === engineering && count === 2
    ? body.replaceAll('/engineering-searching-team-senior-patent-analyst/apply-now/', '/unrelated-role/apply-now/') : body), /application|closing/i)
})
test('Sagacious never masks nonnumeric slider metadata when comparing closing full criteria', async t => {
  await assert.rejects(read(t, (body, row, count) => row.requestedURL === engineering && count === 2
    ? body.replace(/data-eae-slider="\d+"/g, 'data-eae-slider="unreviewed-selection"') : body), /closing|criteria/i)
})
test('Sagacious rejects a changed closing native listing identity', async t => {
  await assert.rejects(read(t, (body, row, count) => row.requestedURL === 'https://sagaciousresearch.com/current-openings' && count === 2
    ? body.replaceAll('drafting-and-prosecution-experts/', 'unreviewed-role/') : body), /closing|listing|inventory/i)
})
test('Sagacious preserves first response403 and safe failure receipts with no inventory', async () => {
  let calls = 0
  await assert.rejects(createSagaciousResearchScraper().run({ fetchImpl: async url => {
    calls++; const response = new Response('controlled denial', { status: 403, headers: { 'content-type': 'text/plain' } })
    Object.defineProperty(response, 'url', { value: url }); return response
  } }), error => {
    assert.equal(error.status, 403); assert.match(error.message, /HTTP 403/)
    assert.equal(error.recruitmentObservations.receipts[0].status, 403)
    assert.equal(error.lifecycleCleanupAllowed, false); return true
  })
  assert.equal(calls, 1)
})
test('Sagacious preserves exact caller reason before network activity', async () => {
  const reason = Symbol('cancel Sagacious'), controller = new AbortController(); controller.abort(reason)
  await assert.rejects(createSagaciousResearchScraper().run({ signal: controller.signal,
    fetchImpl: async () => assert.fail('No cancelled request') }), error => error === reason)
})
for (const phase of ['headers', 'body', 'cleanup']) test('Sagacious enforces cancellation during pending ' + phase, async t => {
  const reason = { opaque: phase }, controller = new AbortController()
  let enter, release, timeout
  const entered = new Promise(resolve => { enter = resolve }), pending = new Promise(resolve => { release = resolve })
  const fetchImpl = async url => {
    if (phase === 'headers') { enter(); await pending }
    return { status: 200, url, headers: new Headers(), body: { getReader: () => ({
      read: async () => { if (phase === 'body') { enter(); await pending }; return { done: true } },
      cancel: () => { if (phase === 'cleanup') { enter(); controller.abort(reason); return pending }; return Promise.resolve() }, releaseLock() {},
    }) } }
  }
  t.mock.method(globalThis, 'fetch', fetchImpl)
  const run = createSagaciousResearchScraper().run({ signal: controller.signal, fetchImpl }).then(value => ({ value }), error => ({ error }))
  try {
    await entered; if (phase !== 'cleanup') controller.abort(reason)
    const outcome = await Promise.race([run, new Promise(resolve => { timeout = setTimeout(() => resolve({ pending: true }), 250) })])
    assert.equal(outcome.pending, undefined); assert.equal(outcome.error, reason)
  } finally { clearTimeout(timeout); release(); await run }
})
for (const phase of ['headers', 'body']) test('Sagacious aggregate deadline bounds pending ' + phase, async () => {
  let release, timeout
  const pending = new Promise(resolve => { release = resolve })
  const run = createSagaciousResearchScraper().run({ sourceTimeoutMs: 30, fetchImpl: async url => {
    if (phase === 'headers') return pending
    return { status: 200, url, headers: new Headers(), body: { getReader: () => ({ read: () => pending,
      cancel: () => Promise.resolve(), releaseLock() {} }) } }
  } }).then(value => ({ value }), error => ({ error }))
  try {
    const outcome = await Promise.race([run, new Promise(resolve => { timeout = setTimeout(() => resolve({ pending: true }), 250) })])
    assert.equal(outcome.pending, undefined); assert.equal(outcome.error?.name, 'TimeoutError')
  } finally { clearTimeout(timeout); release({ done: true }); await run }
})
