import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {extractPreloadState, run as runFedEx} from '../../scraper/fedex/script.js'
import {extractIndiaJobs, run as runGeVernova} from '../../scraper/gevernova/script.js'
import {readParadoxPreload, paradoxIndiaRows} from '../shared/paradoxPublicInventory.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const capture = source => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/paradox-current-20261107/${source}.json.gz`, import.meta.url))))

test('FedEx reads the current native JSON assignment followed by its build assignment', () => {
  const state = extractPreloadState(capture('fedex')[0].body)
  assert.equal(state?.jobSearch.totalJob, 121)
  assert.equal(state.jobSearch.jobs.length, 25)
  assert.equal(state.jobSearch.jobs[0].reference, 'P25-358604-1')
})

test('GE Vernova discovers typed India roles in the current native search state', () => {
  const jobs = extractIndiaJobs(capture('gevernova').find(packet => packet.body.includes('"reference":"R5058064"')).body)
  assert.ok(jobs.some(job => job.jobId === 'R5058064'))
  assert.ok(jobs.every(job => job.country === 'India'))
})

const replay = packets => async url => {
  const packet = packets.find(packet => packet.requestUrl === url)
  assert.ok(packet, `Unexpected public request: ${url}`)
  return packet.body
}

for (const [source, run, expectedID] of [
  ['fedex', runFedEx, 'P25-358604-1'],
  ['gevernova', runGeVernova, 'R5058064'],
]) {
  test(`${source} registered runtime retains full native criteria and explicit partial scope`, async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Runtime ignored the injected native reader') })
    const packets = capture(source)
    const jobs = await run({fetchText: replay(packets), maxPages: 10, maxJobs: 1, now: new Date('2026-11-07T13:00:00Z')})
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, expectedID)
    assert.equal(jobs[0].country, 'India')
    assert.ok(jobs[0].jobDescription.length > 1000)
    assert.ok(jobs[0].nativeJobPosting.description.length > 1000)
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0].sourceListingComplete, false)
    assert.equal(jobs[0].sourceScopeComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(jobs[0].sourceNativeClosingContext.fullRoleRechecked, true)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(readSourceObservationEvidence(jobs, source).observedVacancyCount >= 10)
  })
}

test('current Paradox reader rejects changed full criteria at the closing role read', async () => {
  const packets = capture('fedex')
  let details = 0
  await assert.rejects(runFedEx({maxPages: 1, maxJobs: 1, fetchText: async url => {
    const body = await replay(packets)(url)
    if (url === packets.at(-1).requestUrl && ++details === 2) {
      return body.replaceAll('Responsible for documenting business strategies', 'Responsible for documenting revised business strategies')
    }
    return body
  }}), /closing native role changed/i)
  assert.equal(details, 2)
})

test('current Paradox runtime preserves an opaque cancellation before requesting a page', async () => {
  const controller = new AbortController()
  const reason = Symbol('caller cancellation')
  controller.abort(reason)
  let requests = 0
  await assert.rejects(runFedEx({signal: controller.signal, fetchText: async () => { requests++; return '' }}), error => error === reason)
  assert.equal(requests, 0)
})

test('native search countries must agree across all worksite alternatives', () => {
  const row = readParadoxPreload(capture('fedex')[0].body).jobSearch.jobs[0]
  const mixed = {...row, locations: [...row.locations, {...row.locations[0], country: 'United States', countryAbbr: 'US'}]}
  const contradictory = {...row, locations: [{...row.locations[0], countryAbbr: 'US'}]}
  const unknown = {...row, locations: [{...row.locations[0], country: null, countryAbbr: null}]}
  assert.deepEqual(paradoxIndiaRows({jobSearch: {jobs: [mixed, contradictory, unknown]}}), [])
})

test('native state parsing ignores inert copies and never evaluates expressions', () => {
  const page = capture('fedex')[0].body
  assert.equal(readParadoxPreload(`<template><script>window.__PRELOAD_STATE__ = {"jobSearch":false};</script></template>${page}`).jobSearch.jobs.length, 25)
  assert.throws(() => readParadoxPreload('<script>window.__PRELOAD_STATE__ = globalThis.doNotExecute();</script>'), /nonliteral state value/)
  assert.throws(() => readParadoxPreload('<script>window.__PRELOAD_STATE__ = {"jobs":[],"jobs":[1]};</script>'), /duplicate state property/)
  assert.throws(() => readParadoxPreload(`${page}<script>window.__PRELOAD_STATE__ = {};</script>`), /ambiguous active state/)
})

test('unqualified native publication state is retained while independent public roles survive', async () => {
  const packets = capture('fedex-publication-state')
  const state = readParadoxPreload(packets[0].body)
  // Isolate the first three unchanged native records in a smaller search model.
  // The captured source responses remain unchanged on disk.
  state.jobSearch = {...state.jobSearch, jobs: state.jobSearch.jobs.slice(0, 3), totalJob: 3, facets: []}
  assert.equal(state.jobSearch.jobs[2].isInternal, 'true')
  const page = packets[0].body.replace(/window\.__PRELOAD_STATE__\s*=\s*[\s\S]*?;\s*window\.__BUILD__/, `window.__PRELOAD_STATE__ = ${JSON.stringify(state)}; window.__BUILD__`)
  const get = replay(packets)
  const jobs = await runFedEx({maxPages: 1, maxJobs: 3, fetchText: url => url === packets[0].requestUrl ? page : get(url)})
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].nativeInventoryContext.heldNativeRecords[0].record.reference, 'P25-354827-1')
  assert.equal(jobs[0].nativeInventoryContext.heldNativeRecords[0].reason, 'native-publication-state-unqualified')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('duplicate native JobPosting identity fields cannot qualify a role', async () => {
  const packets = capture('fedex'), get = replay(packets)
  await assert.rejects(runFedEx({maxPages: 1, maxJobs: 1, fetchText: async url => {
    const html = await get(url)
    return url === packets.at(-1).requestUrl ? html.replace('"title":"Business Architect"', '"title":"Other Role","title":"Business Architect"') : html
  }}), /duplicate.*property/)
})

test('native datePosted remains distinct from the position effective date', async () => {
  const jobs = await runFedEx({maxPages: 1, maxJobs: 1, fetchText: replay(capture('fedex'))})
  assert.equal(jobs[0].postingDate, jobs[0].nativeJobPosting.datePosted)
  assert.equal(jobs[0].nativeListingRecord.customFields.find(field => field.cfKey === 'cf_effective_date').value, '2026-07-24')
  assert.equal(jobs[0].firstEverPostedAt, null)
})

const withExpiry = (expiry, packets) => async url => {
  const body = await replay(packets)(url)
  if (url === packets[0].requestUrl) {
    const state = readParadoxPreload(body)
    state.jobSearch = {...state.jobSearch, jobs: state.jobSearch.jobs.slice(0, 1), totalJob: 1, facets: []}
    return body.replace(/window\.__PRELOAD_STATE__\s*=\s*[\s\S]*?;\s*window\.__BUILD__/, `window.__PRELOAD_STATE__ = ${JSON.stringify(state)}; window.__BUILD__`)
  }
  return body.replace('"directApply":true,', `"directApply":true,"validThrough":${JSON.stringify(expiry)},`)
}

test('an exact native expiry earlier today is held without asserting a verified zero', async () => {
  const jobs = await runFedEx({maxPages: 1, maxJobs: 1, now: new Date('2026-11-07T13:00:00Z'),
    fetchText: withExpiry('2026-11-07T01:00:00Z', capture('fedex'))})
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a native timestamp without a timezone cannot establish expiry', async () => {
  await assert.rejects(runFedEx({maxPages: 1, maxJobs: 1,
    fetchText: withExpiry('2026-11-07T23:00:00', capture('fedex'))}), /invalid native date/)
})


test('FedEx binds current Workday mirrors by native posting ID and separate requisition ID', async () => {
  const packets = capture('fedex-mixed-employers')
  const state = readParadoxPreload(packets[0].body)
  const mirror = readParadoxPreload(packets.at(-2).body).jobSearch.jobs.find(row => row.reference === 'RC773106')
  state.jobSearch = {...state.jobSearch, jobs: [...state.jobSearch.jobs.slice(0,2), mirror], totalJob: 3, facets: []}
  const page = packets[0].body.replace(/window\.__PRELOAD_STATE__\s*=\s*[\s\S]*?;\s*window\.__BUILD__/, `window.__PRELOAD_STATE__ = ${JSON.stringify(state)}; window.__BUILD__`)
  const get = replay(packets)
  const jobs = await runFedEx({maxPages: 1, maxJobs: 3, fetchText: url => url === packets[0].requestUrl ? page : get(url)})
  assert.equal(jobs.length, 3)
  assert.equal(jobs[2].jobId, 'RC773106')
  assert.equal(jobs[2].nativeListingRecord.uniqueID, '775A101F66E173B373540FDBDE83FA68')
  assert.equal(jobs[2].nativeJobPosting.identifier.value, 'RC773106')
  assert.ok(jobs[2].jobDescription.includes('Clearance'))
  assert.equal(jobs[2].lifecycleCleanupAllowed, false)
})

test('bounded Paradox role reads make independent progress with at most four active roles', async () => {
  const packets = capture('fedex-publication-state'), get = replay(packets)
  let active = 0, peak = 0
  const jobs = await runFedEx({maxPages: 1, maxJobs: 2, fetchText: async (url, {signal}) => {
    if (!url.includes('/job/')) return get(url)
    active++; peak = Math.max(peak, active)
    try { await delay(20, undefined, {signal}); return await get(url) }
    finally { active-- }
  }})
  assert.equal(jobs.length, 2)
  assert.ok(peak >= 2 && peak <= 4, `Active role reads: ${peak}`)
})

test('the shared native total deadline bounds a slow injected public reader', async () => {
  let requests = 0
  await assert.rejects(runFedEx({sourceTimeoutMs: 5, maxPages: 1, maxJobs: 1, fetchText: async (url, {signal}) => {
    requests++
    await delay(30, undefined, {signal})
    return replay(capture('fedex'))(url)
  }}), error => error.name === 'TimeoutError' || error.cause?.name === 'TimeoutError')
  assert.equal(requests, 1)
})
