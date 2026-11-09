import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import * as native from './nativeContract.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/discovery-filtered-count-20261105.json.gz', import.meta.url))))
const historical = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-radancy-41.json.gz', import.meta.url))))

test('actual ten GET receipts independently reconcile filtered35 while discovery stays37', () => {
  const discovery = native.inspectSearch(captured[0].body)
  assert.equal(discovery.count, 37)
  assert.equal(typeof native.inspectFilteredScope, 'function')
  const filtered = { ...discovery, ...native.inspectFilteredScope(captured[1].body) }
  assert.equal(filtered.count, 35)
  const opening = [], closing = []
  for (let page = 1; page <= 4; page++) {
    opening.push(...native.parsePage(captured[page].body, { scope: filtered, page, now: new Date(captured[page].at) }).rows)
    closing.push(...native.parsePage(captured[page + 4].body, { scope: filtered, page, now: new Date(captured[page + 4].at) }).rows)
  }
  assert.equal(opening.length, 35)
  assert.equal(new Set(opening.map(row => row.id)).size, 35)
  assert.deepEqual(closing, opening)
  const boundReqs = opening.filter(row => row.req).map(row => row.req)
  assert.equal(new Set(boundReqs).size, boundReqs.length)
  assert.ok(opening.some(row => row.req === null), 'Listing evidence must preserve requisitions awaiting detail binding')
  assert.deepEqual(native.inspectSearch(captured[9].body), discovery)
})

function changeDiscoveryCount(html, count) {
  const input = html.match(/<input\b[^>]*data-display="India"[^>]*>/)?.[0]
  assert.ok(input)
  const id = input.match(/\bid="([^"]+)"/)[1]
  const oldCount = input.match(/data-count="(\d+)"/)[1]
  const changed = input.replace(/data-count="\d+"/, `data-count="${count}"`)
  const label = new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>[\\s\\S]*?<\\/label>`)
  const result = html.replace(input, changed).replace(label, value => value.replace(new RegExp(`\\b${oldCount}\\b`, 'g'), String(count)))
  assert.equal(native.inspectSearch(result).count, count)
  return result
}

function transport({ discoveryCount = 34, mutate = () => {} } = {}) {
  const records = structuredClone(historical.records)
  records[0].body = changeDiscoveryCount(records[0].body, discoveryCount)
  for (const packet of records) {
    const url = new URL(packet.url)
    if (url.searchParams.has('FacetFilters[0].Count')) {
      url.searchParams.set('FacetFilters[0].Count', String(discoveryCount))
      packet.url = url.href
      packet.finalURL = url.href
    }
  }
  mutate(records)
  const queues = new Map(), calls = []
  for (const packet of records) {
    if (!queues.has(packet.url)) queues.set(packet.url, [])
    queues.get(packet.url).push(packet)
  }
  return { now: new Date(historical.records[0].startedAt), calls,
    fetch: async url => {
      const queue = queues.get(String(url))
      assert.ok(queue?.length, 'Only retained native fixture URLs may be requested: ' + url)
      const packet = queue.length > 1 ? queue.shift() : queue[0]
      calls.push(String(url))
      return { status: packet.status, url: packet.finalURL, text: async () => packet.body }
    },
  }
}

test('stable discovery/native discrepancy retains independently closed full native roles with explicit coverage gap', async () => {
  const options = transport(), jobs = await run(options)
  assert.equal(jobs.length, 32, 'These full details are retained historical fixtures, not fabricated current35 details')
  assert.ok(jobs.every(job => job.sourceDetailComplete && !job.sourceScopeComplete && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, 32)
  assert.equal(evidence.reportedTotal, null)
  assert.match(evidence.reason, /discovery.*discrepancy.*34.*32/i)
  assert.equal(options.calls.filter(url => url === native.SEARCH_URL).length, 2)
})

for (const [name, mutate] of [
  ['filtered count changes', records => { const payload = JSON.parse(records[2].body); payload.results = payload.results.replace('data-total-job-results="32"', 'data-total-job-results="33"'); records[2].body = JSON.stringify(payload) }],
  ['closing count changes', records => { const payload = JSON.parse(records[37].body); payload.results = payload.results.replace('data-total-job-results="32"', 'data-total-job-results="31"'); records[37].body = JSON.stringify(payload) }],
  ['closing identity changes', records => { const payload = JSON.parse(records[37].body); payload.results = payload.results.replaceAll('102237954144', '999999999999'); records[37].body = JSON.stringify(payload) }],
]) test(`discovery discrepancy cannot hide genuine ${name}`, async () => {
  await assert.rejects(run(transport({ mutate })))
})

test('changing discovery count on closing cannot qualify the discrepancy', async () => {
  const options = transport(), fetch = options.fetch
  let discoveries = 0
  await assert.rejects(run({ ...options, fetch: async url => {
    const response = await fetch(url)
    if (url === native.SEARCH_URL && ++discoveries === 2) return { ...response, text: async () => changeDiscoveryCount(await response.text(), 35) }
    return response
  } }), /discovery.*(?:changed|drift)/i)
})

test('discovery-positive and filtered-zero mismatch cannot become an empty success', async () => {
  await assert.rejects(run(transport({ mutate: records => {
    const payload = JSON.parse(records[1].body)
    payload.results = payload.results.replace('data-total-job-results="32"', 'data-total-job-results="0"')
      .replace('data-total-pages="4"', 'data-total-pages="1"').replace('data-results-count="32"', 'data-results-count="0"')
    records[1].body = JSON.stringify(payload)
  } })), /discovery discrepancy.*empty/i)
})

test('discovery discrepancy cannot weaken the first applied-country identity', async () => {
  await assert.rejects(run(transport({ mutate: records => {
    const payload = JSON.parse(records[1].body)
    payload.results = payload.results.replace('data-active-facet-id="1269750"', 'data-active-facet-id="6252001"')
    records[1].body = JSON.stringify(payload)
  } })), /Country scope drift/)
})

test('native enumeration limits apply to the filtered inventory rather than discovery hints', async () => {
  assert.equal((await run({ ...transport(), maxJobs: 33, maxPages: 4 })).length, 32)
  await assert.rejects(run({ ...transport(), maxJobs: 31 }), /job cap/)
  await assert.rejects(run({ ...transport(), maxPages: 3 }), /page limit/)
})

test('caller cancellation at the new closing-discovery phase preserves exact reason', async () => {
  const options = transport(), fetch = options.fetch, controller = new AbortController()
  const reason = new Error('controlled closing-discovery cancellation')
  let discoveries = 0
  await assert.rejects(run({ ...options, signal: controller.signal, fetch: async url => {
    const response = await fetch(url)
    if (url === native.SEARCH_URL && ++discoveries === 2) controller.abort(reason)
    return response
  } }), error => error === reason)
})

test('empty discovery discrepancy is an explicit non-retryable soft fail-closed source outcome', async () => {
  let attempts = 0, owned, failure
  try {
    await withRetry(async () => {
      attempts += 1
      try {
        return await run(transport({ mutate: records => {
          const payload = JSON.parse(records[1].body)
          payload.hasJobs = false
          payload.results = payload.results.replace('data-total-job-results="32"', 'data-total-job-results="0"')
            .replace('data-total-pages="4"', 'data-total-pages="1"').replace('data-results-count="32"', 'data-results-count="0"')
            .replace(/(<ul\b[^>]*id="search-results-jobs"[^>]*>)[\s\S]*?(<\/ul>)/, '$1$2')
          records[1].body = JSON.stringify(payload)
        } }))
      } catch (error) { owned = error; throw error }
    }, { attempts: 3, baseDelayMs: 0, label: 'disney-empty-discrepancy-control' })
  } catch (error) { failure = error }
  assert.ok(owned)
  const expected = { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' }
  assert.deepEqual(classifyScraperError(owned), expected)
  assert.deepEqual(classifyScraperError(failure), expected)
  assert.equal(attempts, 1)
  assert.equal(owned.abortRetries, true)
  assert.equal(owned.sourceScopeComplete, false)
  assert.equal(owned.lifecycleCleanupAllowed, false)
  assert.equal(owned.inventoryEvidence, null)
})

test('closing discovery changes retain soft fail-closed classification', async () => {
  const options = transport(), fetch = options.fetch
  let discoveries = 0, failure
  try {
    await run({ ...options, fetch: async url => {
      const response = await fetch(url)
      if (url === native.SEARCH_URL && ++discoveries === 2) return { ...response, text: async () => changeDiscoveryCount(await response.text(), 35) }
      return response
    } })
  } catch (error) { failure = error }
  assert.ok(failure)
  assert.deepEqual(classifyScraperError(failure), { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' })
})
