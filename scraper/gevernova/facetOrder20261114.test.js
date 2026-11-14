import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {run} from './script.js'
import {readParadoxPreload} from '../../scraper-support/shared/paradoxPublicInventory.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-facet-order-20261114.json.gz', import.meta.url))))
const indexURL = 'https://careers.gevernova.com/jobs'
const opening = packets.find(packet => packet.requestUrl === indexURL)
const closing = packets.findLast(packet => packet.requestUrl === indexURL)
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const rewriteState = (html, change) => {
  const state = readParadoxPreload(html)
  change(state.jobSearch)
  const pattern = /window\.__PRELOAD_STATE__\s*=\s*[\s\S]*?;\s*window\.__BUILD__/
  assert.match(html, pattern)
  return html.replace(pattern, `window.__PRELOAD_STATE__ = ${JSON.stringify(state)}; window.__BUILD__`)
}
const replay = ({changeClosing = html => html, changeDetail = html => html} = {}) => {
  const calls = new Map()
  return async (url, {signal}) => {
    signal.throwIfAborted()
    const found = packets.filter(packet => packet.requestUrl === url)
    assert.ok(found.length, `Uncaptured native URL: ${url}`)
    const count = calls.get(url) || 0
    calls.set(url, count + 1)
    const body = found[Math.min(count, found.length - 1)].body
    if (url === indexURL && count > 0) return changeClosing(body)
    if (url.includes('/job/') && count > 0) return changeDetail(body)
    return body
  }
}
const bounds = {maxPages: 10, maxJobs: 250, now: new Date('2026-11-14T13:50:00Z')}

test('fresh native pair differs only in the order of two complete City/State facet buckets', () => {
  const before = readParadoxPreload(opening.body).jobSearch
  const after = readParadoxPreload(closing.body).jobSearch
  assert.notEqual(canonical(before), canonical(after))
  assert.equal(canonical({...before, facets: null}), canonical({...after, facets: null}))
  for (let index = 0; index < before.facets.length; index++) {
    const a = before.facets[index], b = after.facets[index]
    assert.equal(canonical({...a, facet_field_keyvalue: null}), canonical({...b, facet_field_keyvalue: null}))
    assert.deepEqual(a.facet_field_keyvalue.map(canonical).sort(), b.facet_field_keyvalue.map(canonical).sort())
    if (!['city', 'state'].includes(a.field)) assert.equal(canonical(a), canonical(b))
  }
})

test('registered GE Vernova runtime accepts the archived facet tie order change with all native criteria', async () => {
  const jobs = await run({...bounds, fetchText: replay()})
  assert.equal(jobs.length, 7)
  assert.ok(jobs.every(job => job.source === 'gevernova' && job.company === 'GE Vernova' && job.country === 'India'))
  assert.ok(jobs.every(job => job.jobDescription.length > 1000 && job.sourceDescription === job.nativeJobPosting.description))
  assert.ok(jobs.every(job => job.sourceDetailComplete && !job.sourceListingComplete && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed))
  assert.ok(jobs.every(job => job.sourceNativeClosingContext.fullRoleRechecked && job.sourceNativeClosingContext.selectedListingPagesRechecked))
  assert.equal(jobs[0].nativeInventoryContext.observedRecordCount, 100)
  assert.equal(jobs[0].nativeInventoryContext.selectedPaginationComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].nativeInventoryContext.selectedNativeRecords.length, 100)
})

const facet = search => search.facets.find(value => value.field === 'city')
for (const [name, change] of [
  ['facet count', search => { facet(search).facet_field_keyvalue[0].doc_count++ }],
  ['case-sensitive facet identity', search => { facet(search).facet_field_keyvalue[0].original_value = 'ABIDJAN' }],
  ['facet display value', search => { facet(search).facet_field_keyvalue[0].custom_value += ' changed' }],
  ['additional facet property', search => { facet(search).facet_field_keyvalue[0].unreviewed = true }],
  ['duplicate facet occurrence', search => { facet(search).facet_field_keyvalue.push({...facet(search).facet_field_keyvalue[0]}) }],
  ['removed facet occurrence', search => { facet(search).facet_field_keyvalue.pop() }],
  ['country facet count', search => { search.facets.find(value => value.field === 'country').facet_field_keyvalue.find(value => value.original_value === 'India').doc_count++ }],
  ['facet collection order', search => { search.facets.reverse() }],
  ['unreviewed country facet order', search => { search.facets.find(value => value.field === 'country').facet_field_keyvalue.reverse() }],
  ['job identity', search => { search.jobs[0].uniqueID += '-changed' }],
  ['job country', search => { search.jobs[0].locations[0].country = 'India'; search.jobs[0].locations[0].countryAbbr = 'IN' }],
  ['job publication', search => { search.jobs[0].isInternal = 'true' }],
  ['job order', search => { search.jobs.reverse() }],
  ['job total', search => { search.totalJob++ }],
  ['search params', search => { search.params.sort = 'title' }],
  ['pagination', search => { search.params.page_number = 2 }],
]) {
  test(`closing native listing still rejects changed ${name}`, async () => {
    await assert.rejects(run({...bounds, maxPages: 1, fetchText: replay({changeClosing: html => rewriteState(html, change)})}),
      /closing native listing changed|native search envelope changed/)
  })
}

test('unreviewed facet bucket schema does not gain unordered comparison semantics', async () => {
  let calls = 0
  await assert.rejects(run({...bounds, maxPages: 1, fetchText: async () => rewriteState(++calls === 1 ? opening.body : closing.body,
    search => { facet(search).facet_field_keyvalue[0].doc_count = '2' })}), /closing native listing changed/)
  assert.equal(calls, 2)
})

test('closing full role criteria remain strict while facet order may vary', async () => {
  let changed = 0
  await assert.rejects(run({...bounds, fetchText: replay({changeDetail: html => {
    assert.ok(html.includes('Job Description Summary'))
    changed++
    return html.replaceAll('Job Description Summary', 'Job Description Summary revised')
  }})}), /closing native role changed/)
  assert.ok(changed > 0)
})

test('facet comparison preserves opaque caller cancellation before any native request', async () => {
  const controller = new AbortController(), reason = Symbol('cancelled')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(run({signal: controller.signal, fetchText: async () => { calls++; return opening.body }}), error => error === reason)
  assert.equal(calls, 0)
})

test('facet comparison preserves cancellation during the closing listing read', async () => {
  const controller = new AbortController(), reason = Symbol('cancelled at closing')
  let calls = 0
  await assert.rejects(run({...bounds, maxPages: 1, signal: controller.signal, fetchText: async () => {
    if (++calls === 2) controller.abort(reason)
    return calls === 1 ? opening.body : closing.body
  }}), error => error === reason)
  assert.equal(calls, 2)
})

test('facet comparison retains the existing shared source deadline', async () => {
  let calls = 0
  await assert.rejects(run({...bounds, sourceTimeoutMs: 5, fetchText: async (_url, {signal}) => {
    calls++
    await delay(100, undefined, {signal})
    return opening.body
  }}), error => error.name === 'TimeoutError' || error.cause?.name === 'TimeoutError')
  assert.equal(calls, 1)
})
