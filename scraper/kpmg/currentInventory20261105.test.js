import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import * as kpmg from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper-support/tests/fixtures/kpmg/current-surfaces-20261105.json.gz', import.meta.url))))
const corporateUrl = 'https://kpmg.com/in/en/careers.html'
const talentUrl = 'https://kpmgindia.talentrecruit.com/career-page'
const corporate = packets.find(packet => packet.url === corporateUrl)
const denied = packets.find(packet => packet.url === talentUrl)
const authored = 'Design and maintain production services with the engineering team. Test changes, investigate operational failures and deliver reliable software.'
const row = (site, index) => ({ Id: String((site === 'CX_3' ? 31000000 : 41000000) + index),
  Title: `${site} engineering control ${index}`, PrimaryLocationCountry: 'IN',
  PrimaryLocation: 'Bengaluru, Karnataka, India', secondaryLocations: [], ShortDescriptionStr: 'Listing excerpt only.' })

// Genuine corporate/403 bodies bind current surfaces. Modeled native row
// subsets/counts below are explicit fault controls, not live inventory proof.
const transport = ({ total = 265, change = value => value, changeCorporate = value => value } = {}) => {
  const requests = [], offsets = []
  const fetchImpl = async (url, options = {}) => {
    requests.push(url)
    if (url === corporateUrl) return { ok: true, status: 200, url, text: async () => changeCorporate(corporate.body) }
    if (url === talentUrl) return { ok: false, status: 403, url, text: async () => denied.body }
    const site = /siteNumber=(CX_\d+)/.exec(url)?.[1]
    assert.ok(['CX_3', 'CX_3001'].includes(site), 'The retired CX_1 API cannot remain a current hiring source')
    let payload
    const match = /,offset=(\d+)/.exec(url)
    if (match) {
      const offset = Number(match[1]), count = site === 'CX_3' ? total : 2
      offsets.push({ site, offset })
      payload = { items: [{ SiteNumber: site, Limit: 24, Offset: offset, TotalJobsCount: count,
        requisitionList: Array.from({ length: Math.max(0, Math.min(24, count - offset)) }, (_, index) => row(site, offset + index)) }] }
      payload = change(payload, { kind: 'listing', site, offset, options })
    } else {
      const id = /Id=%22([^%]+)%22/.exec(url)?.[1]
      assert.ok(id)
      payload = { items: [{ ...row(site, Number(id) - (site === 'CX_3' ? 31000000 : 41000000)), ExternalDescriptionStr: authored }] }
      payload = change(payload, { kind: 'detail', site, id, options })
    }
    return { ok: true, status: 200, url, json: async () => payload, text: async () => JSON.stringify(payload) }
  }
  return { fetchImpl, requests, offsets }
}

test('KPMG current public run follows corporate handoffs, exhausts native offsets and keeps denied India practice unresolved', async context => {
  context.mock.method(globalThis, 'fetch', () => { assert.fail('The exported run must forward the supplied transport') })
  const native = transport()
  const jobs = await kpmg.run({ fetchImpl: native.fetchImpl })
  assert.equal(jobs.length, 267)
  assert.ok(native.offsets.some(value => value.site === 'CX_3' && value.offset === 264))
  assert.equal(native.offsets.filter(value => value.site === 'CX_3').length, 24)
  assert.ok(native.requests.includes(talentUrl))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence.reportedTotal, null, 'A denied declared surface leaves company total unknown')
  assert.match(evidence.reason, /talentrecruit.*403/i)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'kpmg', company: 'KPMG' })
  assert.equal(decorated[0].nativeCollectionEvidence?.source, 'kpmg')
  assert.deepEqual(decorated[0].nativeCollectionEvidence?.surfaces, jobs[kpmg.KPMG_SURFACE_EVIDENCE].surfaces)
  assert.equal(decorated[0].nativeCollectionEvidence?.allDeclaredSurfacesQualified, false)
  assert.equal(readInventoryEvidence(decorated)?.reportedTotal, null)
})

test('KPMG genuine corporate handoff and redirect receipts prove the retired site is not a current practice', () => {
  for (const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
  assert.equal(packets.length, 10)
  assert.equal(denied.status, 403)
  const retired = packets.find(packet => packet.url.endsWith('/sites/CX_1'))
  assert.match(retired.finalUrl, /\/sites\/CX_3$/)
  assert.match(corporate.body, /kpmgindia\.talentrecruit\.com\/career-page/)
})

test('KPMG explicit caller limits remain incomplete and are forwarded through public run', async context => {
  context.mock.method(globalThis, 'fetch', () => { assert.fail('No default network allowed') })
  const byPage = transport()
  const jobs = await kpmg.run({ fetchImpl: byPage.fetchImpl, maxPages: 1 })
  assert.equal(jobs.length, 26)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  const byJob = transport()
  const selected = await kpmg.run({ fetchImpl: byJob.fetchImpl, maxJobs: 2 })
  assert.equal(selected.length, 2)
  assert.ok(selected.every(job => job.lifecycleCleanupAllowed === false))
  assert.ok(!byJob.offsets.some(value => value.site === 'CX_3001'))
})

test('KPMG rejects corporate handoff drift before reading native inventories', async () => {
  const native = transport({ changeCorporate: body => body.replaceAll('https://kpmgindia.talentrecruit.com/career-page', 'https://unreviewed.invalid/jobs') })
  await assert.rejects(kpmg.createKpmgScraper({ fetchImpl: native.fetchImpl }).run(), /handoff|surface|corporate/i)
  assert.deepEqual(native.requests, [corporateUrl])
})

test('KPMG native details retain explicitly owned India secondary worksites', async () => {
  const native = transport({ total: 1, change: value => {
    const records = value.items[0].requisitionList || value.items
    for (const record of records) Object.assign(record, { PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States',
      secondaryLocations: [{ CountryCode: 'IN', Name: 'Bengaluru, Karnataka, India' }] })
    return value
  } })
  const jobs = await kpmg.createKpmgScraper({ fetchImpl: native.fetchImpl }).run()
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.location === 'Bengaluru, Karnataka, India' && job.sourceDetailComplete))
})

test('KPMG cannot certify listing excerpts or conflicting native detail identities as full descriptions', async () => {
  for (const fault of ['description', 'identity']) {
    const native = transport({ total: 1, change: (value, phase) => {
      if (phase.kind === 'detail') {
        if (fault === 'description') value.items[0].ExternalDescriptionStr = '<p>&nbsp;</p>'
        else value.items[0].Id = '99999999'
      }
      return value
    } })
    const operation = kpmg.createKpmgScraper({ fetchImpl: native.fetchImpl }).run()
    if (fault === 'identity') await assert.rejects(operation, /identity|does not match/i)
    else assert.ok((await operation).every(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'missing-content'))
  }
})

test('KPMG preserves exact cancellation when an official reader ignores or rejects after abort', async () => {
  for (const rejectReader of [false, true]) {
    const controller = new AbortController(), reason = Object.freeze({ cancelled: 'kpmg' })
    let entered, release
    const started = new Promise(resolve => { entered = resolve })
    const wait = new Promise(resolve => { release = resolve })
    const operation = kpmg.createKpmgScraper({ fetchImpl: async () => {
      entered()
      if (rejectReader) { controller.abort(reason); throw new Error('Transport rejected generically') }
      await wait
      return { ok: true, status: 200, url: corporateUrl, text: async () => corporate.body }
    } }).run({ signal: controller.signal })
    const observed = operation.then(value => ({ value }), error => ({ error }))
    try {
      await started
      if (!rejectReader) controller.abort(reason)
      const settled = await Promise.race([observed, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 100))])
      assert.equal(settled.timedOut, undefined)
      assert.equal(settled.error, reason)
    } finally { controller.abort(reason); release(); await observed }
  }
})

test('KPMG preserves a denied corporate HTTP status and refuses a cross-origin native response', async () => {
  await assert.rejects(kpmg.run({ fetchImpl: async url => ({ ok: false, status: 403, url, text: async () => denied.body }) }),
    error => error.status === 403)
  const native = transport({ total: 1 })
  await assert.rejects(kpmg.run({ fetchImpl: async (url, options) => {
    const response = await native.fetchImpl(url, options)
    return url.includes('recruitingCE') ? { ...response, url: 'https://unreviewed.invalid/native' } : response
  } }), /redirected|verified Oracle origin/)
})

test('KPMG a successful unqualified India-practice shell cannot certify company completeness', async () => {
  const native = transport({ total: 1 })
  const jobs = await kpmg.run({ fetchImpl: async (url, options) => url === talentUrl
    ? { ok: true, status: 200, url, text: async () => '<title>Unqualified native shell</title>' }
    : native.fetchImpl(url, options) })
  assert.equal(jobs.length, 3)
  assert.match(readInventoryEvidence(jobs).reason, /unqualified-current-talentrecruit/)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('KPMG rejects caller attempts to re-enable a retired or duplicated Oracle board before requests', async () => {
  for (const siteNumbers of [[], ['CX_1'], ['CX_3', 'CX_3'], ['UNKNOWN']]) {
    let requests = 0
    await assert.rejects(kpmg.run({ siteNumbers, fetchImpl: async () => { requests++; assert.fail('No unreviewed request') } }), /declared Oracle/)
    assert.equal(requests, 0)
  }
})
