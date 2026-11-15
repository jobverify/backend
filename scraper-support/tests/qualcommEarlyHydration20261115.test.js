import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const read = name => JSON.parse(readFileSync(new URL('../apiPortal/test-data/qualcomm-20261031-' + name + '.json', import.meta.url)))
const captured = read('listing'), detail = read('detail')
const configure = (early = true) => {
  const provider = structuredClone(getScraperCatalog().find(row => row.source === 'qualcomm'))
  provider.config.pagination.pageSize = 1
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 }
  provider.config.detail.concurrency = 1
  provider.config.detail.hydrateDuringSnapshot = early
  return provider
}
const listing = (count = 2) => ({ ...structuredClone(captured), data: { ...structuredClone(captured.data),
  count, positions: [structuredClone(captured.data.positions[0])] } })
const denial = () => Object.assign(new Error('HTTP 429 native source rate limited'), { status: 429 })

test('Qualcomm can retain exact full native details when a later staged opening page is denied', async () => {
  const calls = [], error = denial()
  const jobs = await runApiPortalScraper({ provider: configure(), fetchJson: async url => {
    const address = new URL(url); calls.push(address.pathname + address.search)
    if (address.pathname.endsWith('/position_details')) return structuredClone(detail)
    if (address.searchParams.get('start') === '0') return listing()
    throw error
  } })
  assert.equal(jobs.length, 1)
  assert.equal(String(jobs[0].jobId), '446716674472')
  assert.equal(jobs[0].jobDescription, detail.data.jobDescription)
  assert.equal(jobs[0].country, 'India')
  assert.equal(calls.length, 3)
  assert.match(calls[1], /position_details/)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('early staged hydration still requires a complete independent closing cohort', async () => {
  const order = []
  const jobs = await runApiPortalScraper({ provider: configure(), fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname.endsWith('/position_details')) { order.push('detail'); return structuredClone(detail) }
    order.push('listing'); return listing(1)
  } })
  assert.deepEqual(order, ['listing', 'detail', 'listing'])
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a changed closing native record disables cleanup even after early details were bound', async () => {
  let listings = 0
  const jobs = await runApiPortalScraper({ provider: configure(), fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname.endsWith('/position_details')) return structuredClone(detail)
    const value = listing(1)
    if (++listings > 1) value.data.positions[0].department = 'Changed native department'
    return value
  } })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing-vacancy-record-changed/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('default staged mode still rejects an incomplete opening before hydrating roles', async () => {
  const error = denial(), calls = []
  await assert.rejects(runApiPortalScraper({ provider: configure(false), fetchJson: async url => {
    const address = new URL(url); calls.push(address.pathname)
    if (address.pathname.endsWith('/position_details')) assert.fail('Default staged mode must not hydrate incomplete opening')
    if (address.searchParams.get('start') === '0') return listing()
    throw error
  } }), value => value === error)
  assert.equal(calls.length, 2)
})

test('early snapshot detail cannot attach a foreign role identity', async () => {
  const wrong = structuredClone(detail)
  wrong.data.id = 999999
  await assert.rejects(runApiPortalScraper({ provider: configure(), fetchJson: async url =>
    new URL(url).pathname.endsWith('/position_details') ? wrong : listing(1) }), /detail identity mismatch/)
})

test('a denial before any full native detail is proven remains the original failure', async () => {
  const error = denial()
  await assert.rejects(runApiPortalScraper({ provider: configure(), fetchJson: async url => {
    if (new URL(url).pathname.endsWith('/position_details')) throw error
    return listing(1)
  } }), value => value === error)
})
