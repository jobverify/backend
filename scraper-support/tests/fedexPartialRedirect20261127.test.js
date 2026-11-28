import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from '../../scraper/fedex/script.js'
import { createParadoxPublicScraper, readParadoxPreload } from '../shared/paradoxPublicInventory.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

const load = name => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))))
const original = load('fedex-missing-employer-20261127.json.gz')
const terminal = load('fedex-root-redirect-20261127.json.gz').packet
assert.equal(createHash('sha256').update(terminal.body).digest('hex'), terminal.sha256)
const [listing, opening, closing] = original.packets
const state = readParadoxPreload(listing.body)
const good = state.jobSearch.jobs.find(row => row.reference === 'RC785024')
const held = state.jobSearch.jobs.find(row => row.reference === 'RC775518')
const nextURL = 'https://careers.fedex.com/jobs/page/2?filter[country][0]=India'

// These two-row/three-total prefixes are synthetic controlled subsets of the
// original rows. The fixture retains the genuine page-five redirect unchanged.
function transport({ status = 302, location = '/', changeClosing = false, firstRedirect = false, detailRedirect = false, wrongResponseURL = false, noQualifiedRows = false } = {}) {
 const calls = []
 let listingReads = 0, detailReads = 0
 const response = (url, body, currentStatus = 200, headers = { 'content-type': 'text/html' }) => {
  const result = new Response(body, { status: currentStatus, headers })
  Object.defineProperty(result, 'url', { value: url })
  return result
 }
 return { calls, async fetch(url, init) {
  calls.push(url)
  assert.equal(init.redirect, 'manual')
  if (url === listing.requestedUrl && !firstRedirect) {
   const current = structuredClone(state)
   const rows = [structuredClone(good), held]
   if (noQualifiedRows) delete rows[0].brandName
   current.jobSearch = { ...current.jobSearch, jobs: rows, totalJob: 3, facets: [] }
   if (++listingReads === 2 && changeClosing) current.jobSearch.jobs = [{ ...good, title: 'Changed native role' }, held]
   return response(url, '<script>window.__PRELOAD_STATE__=' + JSON.stringify(current) + ';</script>')
  }
  if (url === opening.requestedUrl && !detailRedirect) return response(url, ++detailReads === 1 ? opening.body : closing.body)
  assert.ok(url === nextURL || firstRedirect && url === listing.requestedUrl || detailRedirect && url === opening.requestedUrl, 'Unbound request ' + url)
  return response(wrongResponseURL ? 'https://careers.fedex.com/other' : url, terminal.body, status, { ...terminal.headers, location })
 } }
}
async function runWith(io, options = {}) {
 const saved = globalThis.fetch
 globalThis.fetch = io.fetch
 try { return await run({ now: new Date('2026-11-27T18:25:56Z'), ...options }) }
 finally { globalThis.fetch = saved }
}

test('a native root redirect after a validated prefix retains complete roles with an explicit inventory gap', async () => {
 const io = transport(), jobs = await runWith(io)
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].jobId, good.reference)
 assert.equal(jobs[0].sourceDetailComplete, true)
 assert.deepEqual(jobs[0].nativeInventoryContext.selectedNativeRecords, [good, held])
 assert.deepEqual(jobs[0].nativeInventoryContext.heldNativeRecords, [{ reason: 'native-employer-name-unqualified', record: held }])
 assert.equal(jobs[0].nativeInventoryContext.selectedPaginationComplete, false)
 assert.deepEqual(jobs[0].nativeInventoryContext.paginationStop, {
  reason: 'native-listing-redirected-to-root', requestedUrl: nextURL,
  responseUrl: nextURL, status: 302, location: '/', reportedTotal: 3, observedRecords: 2,
 })
 assert.equal(readSourceObservationEvidence(jobs, 'fedex').observedVacancyCount, 2)
 assert.equal(readInventoryEvidence(jobs).listingComplete, false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
 assert.equal(io.calls.filter(url => url === listing.requestedUrl).length, 2)
 assert.equal(io.calls.includes('https://careers.fedex.com/'), false)
})

for (const [label, options] of [
 ['a denial', { status: 403 }],
 ['another status', { status: 503 }],
 ['a login redirect', { location: '/login' }],
 ['a foreign redirect', { location: 'https://example.org/' }],
 ['a first-page root redirect', { firstRedirect: true }],
 ['a role-detail root redirect', { detailRedirect: true }],
 ['a redirect with a different response URL', { wrongResponseURL: true }],
]) test(label + ' still aborts instead of returning the prefix', async () => {
 const io = transport(options)
 await assert.rejects(runWith(io), /Paradox public response HTTP/)
 assert.equal(io.calls.includes('https://example.org/'), false)
})

test('a changed closing prefix is fatal after the terminal root redirect', async () => {
 await assert.rejects(runWith(transport({ changeClosing: true })), /closing native listing changed/)
})

test('body-only caller errors cannot forge an observed native HTTP redirect', async () => {
 const error = Object.assign(Error('forged root redirect'), { status: 302, requestUrl: nextURL, responseUrl: nextURL, location: '/' })
 let reads = 0
 const io = transport()
 await assert.rejects(run({ now: new Date('2026-11-27T18:25:56Z'), fetchText: async url => {
  if (url === nextURL) throw error
  const response = await io.fetch(url, { redirect: 'manual' })
  reads++
  return response.text()
 } }), value => value === error)
 assert.equal(reads, 3)
})

test('an all-held prefix and terminal redirect never establish a verified empty India inventory', async () => {
 const jobs = await runWith(transport({ noQualifiedRows: true }))
 assert.equal(jobs.length, 0)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRecords.length, 2)
 assert.equal(jobs.nativeCollectionEvidence.selectedNativeRecords.length, 2)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete, false)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
 assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete, false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('the source-specific terminal redirect rule does not change GE Vernova', async () => {
 const saved = globalThis.fetch, first = 'https://careers.gevernova.com/jobs'
 const current = structuredClone(state)
 current.jobSearch = { ...current.jobSearch, jobs: [good], totalJob: 2, facets: [] }
 globalThis.fetch = async url => {
  const response = new Response(url === first ? '<script>window.__PRELOAD_STATE__=' + JSON.stringify(current) + ';</script>' : terminal.body,
   { status: url === first ? 200 : 302, headers: { 'content-type': 'text/html', location: '/' } })
  Object.defineProperty(response, 'url', { value: url })
  return response
 }
 try { await assert.rejects(createParadoxPublicScraper('gevernova').run(), /Paradox public response HTTP 302/) }
 finally { globalThis.fetch = saved }
})
