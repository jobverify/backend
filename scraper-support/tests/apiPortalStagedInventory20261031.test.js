import assert from 'node:assert/strict'
import test from 'node:test'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { buildHttpError } from '../utils/fetch.js'
import { withRetry, getRetryPressure } from '../utils/retry.js'
import { capturedStagedInput, capturedStagedRows, stagedProvider, stagedReplay } from './apiPortalStagedInventory20261031.fixture.js'

const run = (replay, provider = stagedProvider(), signal) => runApiPortalScraper({ provider, fetchJson: replay.fetchJson, signal })
const partial = jobs => {
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
}
const retainedOpening = jobs => {
  assert.deepEqual(jobs.map(job => String(job.jobId)), capturedStagedRows.slice(0, 3).map(row => String(row.id)))
  assert.deepEqual(jobs.map(job => job.jobDescription), capturedStagedInput.pairs.slice(0, 3).map(pair => pair.detail.data.jobDescription))
}

test('opted-in traversal completes the opening cohort before hydration and closes the same native cohort afterward', async () => {
  const replay = stagedReplay(), jobs = await run(replay)
  retainedOpening(jobs)
  assert.deepEqual(replay.events.filter(event => event.kind === 'listing').map(event => [event.phase, event.start]), [['opening', 0], ['opening', 2], ['closing', 0], ['closing', 2]])
  assert.equal(replay.events[1].kind, 'listing')
  assert.ok(replay.events.slice(2, 5).every(event => event.kind === 'detail'))
  assert.ok(replay.events.slice(5).every(event => event.kind === 'listing' && event.phase === 'closing'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 4)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
})

test('providers without the opt-in retain their interleaved traversal and single listing cohort', async () => {
  const replay = stagedReplay(), jobs = await run(replay, stagedProvider({ staged: false }))
  retainedOpening(jobs)
  assert.deepEqual(replay.events.slice(0, 4).map(event => event.kind), ['listing', 'detail', 'detail', 'listing'])
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 0)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
})

test('closing cohort order and JSON object-key order do not change the native vacancy records', async () => {
  const closing = capturedStagedRows.slice(0, 3).reverse().map(row => Object.fromEntries(Object.entries(row).reverse()))
  const replay = stagedReplay({ closing }), jobs = await run(replay)
  retainedOpening(jobs)
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [label, change] of [
  ['new native role', rows => rows.push(structuredClone(capturedStagedRows[3]))],
  ['removed native role', rows => rows.pop()],
  ['replaced native role at an unchanged total', rows => { rows[2] = structuredClone(capturedStagedRows[3]) }],
  ['native title', rows => { rows[0].name += ' changed native title' }],
  ['native original publication date', rows => { rows[0].postedTs += 86400 }],
  ['native application/source URL', rows => { rows[0].positionUrl += '?changed-native-link=true' }],
  ['typed native country pair', rows => { rows[0].locations = ['San Diego, California, United States']; rows[0].standardizedLocations = ['San Diego, CA, US'] }],
  ['native workplace mode', rows => { rows[0].workLocationOption = 'remote' }],
  ['undocumented ranking metadata', rows => { rows[0].solrScore = 123.456 }],
  ['undocumented favorite metadata', rows => { rows[0].stars = 5 }],
]) test('closing drift retains original opening jobs as partial: ' + label, async () => {
  const closing = structuredClone(capturedStagedRows.slice(0, 3)); change(closing)
  const jobs = await run(stagedReplay({ closing }))
  retainedOpening(jobs); partial(jobs)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('a newly empty closing cohort cannot erase the positive opening jobs or certify zero', async () => {
  const jobs = await run(stagedReplay({ closing: [] }))
  retainedOpening(jobs); partial(jobs)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
})

test('duplicate closing IDs cannot become a complete snapshot by deduplicating the cohort', async () => {
  const closing = structuredClone(capturedStagedRows.slice(0, 3)); closing[1] = structuredClone(closing[0])
  const jobs = await run(stagedReplay({ closing }))
  retainedOpening(jobs); partial(jobs)
})

test('opening overlaps remain visible and partial even if the closing cohort repeats the same overlap', async () => {
  const opening = structuredClone(capturedStagedRows.slice(0, 3)); opening[2] = structuredClone(opening[0])
  const replay = stagedReplay({ opening }), jobs = await run(replay)
  assert.deepEqual(jobs.map(job => String(job.jobId)), opening.map(row => String(row.id)))
  partial(jobs)
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 2)
})

for (const [name, change] of [
  ['HTTP failure', () => { throw Object.assign(Error('HTTP503'), { status: 503 }) }],
  ['missing listing array', payload => { delete payload.data.positions; return payload }],
  ['malformed total', payload => { payload.data.count = 'not a number'; return payload }],
  ['upstream error envelope', payload => ({ ...payload, success: false })],
]) test('unavailable closing proof preserves opening jobs with incomplete evidence: ' + name, async () => {
  const replay = stagedReplay({ listingAction: ({ phase, payload }) => phase === 'closing' ? change(payload) : payload })
  const jobs = await run(replay); retainedOpening(jobs); partial(jobs)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('the closing traversal has its own page bound and cannot consume an unending continuation', async () => {
  const provider = stagedProvider({ pagination: { maxPages: 2, hasMorePath: 'data.hasMore' } })
  const replay = stagedReplay({ listingAction: ({ phase, payload }) => { if (phase === 'closing') payload.data.hasMore = true; return payload } })
  const jobs = await run(replay, provider)
  retainedOpening(jobs); partial(jobs)
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 2)
})

test('an opening page bound prevents hydration and closing rather than extending traversal', async () => {
  const replay = stagedReplay()
  await assert.rejects(run(replay, stagedProvider({ pagination: { maxPages: 1 } })), /page limit/)
  assert.equal(replay.events.length, 1)
})

for (const phase of ['opening', 'detail', 'closing']) test('caller cancellation during ' + phase + ' propagates exactly and stops subsequent stages', async () => {
  const controller = new AbortController(), reason = Error('stop staged ' + phase)
  const action = ({ phase: current, payload }) => { if (current === phase) controller.abort(reason); return payload }
  const replay = stagedReplay({ listingAction: action, detailAction: ({ payload }) => { if (phase === 'detail') controller.abort(reason); return payload } })
  await assert.rejects(run(replay, stagedProvider(), controller.signal), error => error === reason)
  if (phase !== 'closing') assert.equal(replay.events.some(event => event.phase === 'closing'), false)
})

test('the opted-in complete source budget cancels stalled hydration and skips closing', async () => {
  const replay = stagedReplay({ detailAction: ({ options }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('controlled stalled detail unavailable')), 80)
    options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal.reason) }, { once: true })
  }) })
  await assert.rejects(run(replay, stagedProvider({ timeoutMs: 25 })), /deadline|timeout/i)
  assert.equal(replay.events.some(event => event.phase === 'closing'), false)
})

for (const phase of ['opening', 'closing']) test('portals without the denial-stop policy retain paced retry order and telemetry during ' + phase, async () => {
  let failed = false
  const replay = stagedReplay({ listingAction: ({ phase: current, payload, url }) => {
    if (!failed && current === phase) { failed = true; throw buildHttpError(new Response(null, { status: 429, headers: { 'Retry-After': '0' } }), url) }
    return payload
  } })
  const provider = stagedProvider()
  delete provider.publicAccessPolicy // Exercise the ordinary portal retry contract.
  const jobs = await withRetry(() => run(replay, provider), { attempts: 1, baseDelayMs: 0, label: 'staged-recovered-rate-limit' })
  retainedOpening(jobs)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(getRetryPressure(jobs).nestedRetries, 1)
  assert.equal(getRetryPressure(jobs).nestedFailedAttempts, 1)
  assert.deepEqual(getRetryPressure(jobs).httpStatusCounts, { 429: 1 })
})

test('exhausted closing retries on an ordinary portal preserve opening positives without restarting discovery', async () => {
  const replay = stagedReplay({ listingAction: ({ phase, payload, url }) => {
    if (phase === 'closing') throw buildHttpError(new Response(null, { status: 429 }), url)
    return payload
  } })
  const provider = stagedProvider()
  delete provider.publicAccessPolicy
  const jobs = await run(replay, provider)
  retainedOpening(jobs); partial(jobs)
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 2)
})

test('a denial-stop staged source preserves opening positives and stops after its first closing HTTP429', async () => {
  const replay = stagedReplay({ listingAction: ({ phase, payload, url }) => {
    if (phase === 'closing') throw buildHttpError(new Response(null, { status: 429 }), url)
    return payload
  } })
  const jobs = await withRetry(() => run(replay), { attempts: 1, baseDelayMs: 0, label: 'staged-first-denial' })
  retainedOpening(jobs); partial(jobs)
  assert.equal(replay.events.filter(event => event.phase === 'closing').length, 1)
  assert.equal(getRetryPressure(jobs).nestedRetries, 0)
  assert.deepEqual(getRetryPressure(jobs).httpStatusCounts, {429:1})
})

test('staged hydration retains the required native identity guard', async () => {
  const replay = stagedReplay({ detailAction: ({ payload }) => { payload.data.id = 999; return payload } })
  await assert.rejects(run(replay), /detail identity mismatch/)
  assert.equal(replay.events.some(event => event.phase === 'closing'), false)
})

test('a staged identity failure cancels peer hydration before another queued native detail can start', async () => {
  const peer = Promise.withResolvers()
  const replay = stagedReplay({ detailAction: async ({ id, payload }) => {
    if (id === String(capturedStagedRows[0].id)) { payload.data.id = 999; return payload }
    if (id === String(capturedStagedRows[1].id)) await peer.promise
    return payload
  } })
  await assert.rejects(run(replay), /detail identity mismatch/)
  peer.resolve()
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(replay.events.filter(event => event.kind === 'detail').length, 2)
  assert.equal(replay.events.some(event => event.phase === 'closing'), false)
})
