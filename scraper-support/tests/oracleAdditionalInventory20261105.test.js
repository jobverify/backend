import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'

import * as zensar from '../../scraper/zensar/script.js'
import * as emerson from '../../scraper/emersonindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Exact public GET bodies are retained separately from the modeled edge cases.
const receipts = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/oracle-additional/2026-11-05-public.json.gz', import.meta.url))))
const text = url => {
  const receipt = receipts.find(packet => packet.url === url)
  assert.ok(receipt, `Uncaptured first-party handoff: ${url}`)
  return receipt.body
}
const body = 'Design, test and maintain production services. Work with the engineering team to investigate operational issues and deliver reliable software.'
const role = index => ({ Id: String(980000 + index), Title: `Engineer ${index}`,
  PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, Karnataka, India',
  secondaryLocations: [], ShortDescriptionStr: 'A listing excerpt.' })

const transport = (total = 1, modify = value => value) => {
  const offsets = [], detailIds = []
  let listingReads = 0
  const json = async (url, options) => {
    const match = /,offset=(\d+)/.exec(url)
    if (match) {
      const offset = Number(match[1])
      offsets.push(offset)
      const value = { items: [{ SiteNumber: 'CX_1', Limit: 24, Offset: offset,
        TotalJobsCount: total, requisitionList: Array.from({ length: Math.max(0, Math.min(24, total - offset)) }, (_, index) => role(offset + index)) }] }
      return modify(value, { kind: 'listing', offset, read: ++listingReads, options })
    }
    const id = /Id=%22(\d+)%22/.exec(url)?.[1]
    assert.ok(id, `Unexpected native detail URL: ${url}`)
    detailIds.push(id)
    return modify({ items: [{ ...role(Number(id) - 980000), ExternalDescriptionStr: `<p>${body}</p>` }] },
      { kind: 'detail', id, options })
  }
  return { json, offsets, detailIds }
}

for (const [source, module] of [['zensar', zensar], ['emersonindia', emerson]]) {
  const execute = (context, native, options = {}) => {
    // Also catch the old Zensar public run, which ignored caller options.
    context.mock.method(globalThis, 'fetch', async (url, init) => ({
      ok: true, json: () => native.json(url, init),
    }))
    return module.run({ fetchJson: native.json, fetchText: async url => text(url), ...options })
  }

  test(`${source} exhausts more than ten native pages and preserves full closing inventory evidence`, async context => {
    const native = transport(265)
    const jobs = await execute(context, native)
    assert.equal(jobs.length, 265)
    assert.equal(jobs.at(-1).jobId, '980264')
    assert.equal(native.offsets.length, 24, '12 opening pages plus 12 closing pages')
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence?.status, 'complete-inventory')
    assert.equal(evidence.reportedTotal, 265)
    assert.equal(evidence.indiaFacetCount, 265)
    assert.ok(jobs.every(job => job.sourceListingComplete && job.sourceDetailComplete && job.lifecycleCleanupAllowed))
  })

  test(`${source} marks explicit page and job caps incomplete`, async context => {
    for (const options of [{ maxPages: 1 }, { maxJobs: 1 }]) {
      const jobs = await execute(context, transport(25), options)
      assert.equal(jobs.length, options.maxPages ? 24 : 1)
      assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
      assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
    }
  })

  test(`${source} follows raw offsets after a foreign-only first page`, async context => {
    const native = transport(25, (value, phase) => {
      if (phase.kind === 'listing' && phase.offset === 0) for (const record of value.items[0].requisitionList) {
        record.PrimaryLocationCountry = 'US'; record.PrimaryLocation = 'Austin, Texas, United States'
      }
      return value
    })
    const jobs = await execute(context, native)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, '980024')
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 25)
    assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 1)
  })

  test(`${source} retains the native India secondary worksite rather than labeling a foreign city India`, async context => {
    const native = transport(1, value => {
      const records = value.items[0].requisitionList || value.items
      for (const record of records) Object.assign(record, {
        PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States',
        secondaryLocations: [{ CountryCode: 'IN', Name: 'Bengaluru, Karnataka, India' }],
      })
      return value
    })
    const jobs = await execute(context, native)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
    assert.equal(jobs[0].sourceDetailComplete, true)
  })

  test(`${source} does not certify missing descriptions, missing country evidence or missing native rows`, async context => {
    for (const gap of ['description', 'country', 'count']) {
      const native = transport(1, (value, phase) => {
        if (phase.kind === 'detail' && gap === 'description') value.items[0].ExternalDescriptionStr = '<p>&nbsp;</p>'
        if (gap === 'country') {
          const records = value.items[0].requisitionList || value.items
          for (const record of records) record.secondaryLocations = [{ Name: 'Remote' }]
        }
        if (phase.kind === 'listing' && gap === 'count') value.items[0].TotalJobsCount = 2
        return value
      })
      const jobs = await execute(context, native)
      assert.equal(jobs.length, 1)
      assert.equal(jobs[0].lifecycleCleanupAllowed, false, gap)
      if (gap !== 'description') assert.equal(readInventoryEvidence(jobs)?.listingComplete, false, gap)
      else assert.equal(jobs[0].sourceDetailComplete, false)
    }
  })

  test(`${source} rejects duplicate identities, different details and changed closing inventories`, async context => {
    for (const change of ['duplicate', 'detail', 'closing']) {
      const native = transport(change === 'duplicate' ? 25 : 1, (value, phase) => {
        if (phase.kind === 'listing' && phase.offset === 24 && change === 'duplicate') value.items[0].requisitionList[0] = role(0)
        if (phase.kind === 'listing' && phase.read > 1 && change === 'closing') value.items[0].requisitionList[0] = role(7)
        if (phase.kind === 'detail' && change === 'detail') value.items[0].Id = '980007'
        return value
      })
      await assert.rejects(execute(context, native), /identity|inventory changed|does not match/i)
    }
  })

  test(`${source} preserves the exact cancellation reason before and after an injected request`, async context => {
    const reason = Object.freeze({ cancelled: source })
    const before = new AbortController(); before.abort(reason)
    let requests = 0
    const native = transport()
    const original = native.json
    native.json = async (...args) => { requests++; return original(...args) }
    await assert.rejects(execute(context, native, { signal: before.signal }), error => error === reason)
    assert.equal(requests, 0)
    const during = new AbortController()
    native.json = async (...args) => { const value = await original(...args); during.abort(reason); return value }
    await assert.rejects(execute(context, native, { signal: during.signal }), error => error === reason)
  })

  test(`${source} genuine captured role bodies retain matching identity and authored descriptions`, () => {
    const listing = JSON.parse(receipts.find(packet => packet.source === source && packet.kind === 'native-first-page').body)
    const detail = JSON.parse(receipts.find(packet => packet.source === source && packet.kind === 'native-sample-detail').body)
    const first = module.extractSearchResults(listing)[0]
    const job = module.extractJobDetail(detail, first)
    assert.equal(job.jobId, first.jobId)
    assert.equal(job.title, first.title)
    assert.ok(job.jobDescription.length > 500)
  })

  test(`${source} caller cancellation settles ignored listing readers and dominates transport rejections`, async context => {
    const reason = Object.freeze({ cancelled: source })
    for (const rejectReader of [false, true]) {
      const controller = new AbortController()
      let entered, release
      const started = new Promise(resolve => { entered = resolve })
      const pendingRead = new Promise(resolve => { release = resolve })
      const native = transport()
      native.json = async () => {
        entered()
        if (rejectReader) { controller.abort(reason); throw new Error('Unrelated transport abort error') }
        return pendingRead
      }
      const operation = execute(context, native, { signal: controller.signal })
      const observed = operation.then(() => ({ resolved: true }), error => ({ error }))
      await started
      if (!rejectReader) controller.abort(reason)
      try {
        const settled = await Promise.race([observed, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 100))])
        assert.equal(settled.timedOut, undefined, 'Ignored transports must not retain the source after caller abort')
        assert.equal(settled.error, reason)
      } finally {
        release({})
        await observed
      }
    }
  })
}

test('all seven public receipts retain their original body hashes and Emerson handoff guards', () => {
  assert.equal(receipts.length, 7)
  for (const receipt of receipts) {
    assert.equal(receipt.method, 'GET')
    assert.equal(receipt.status, 200)
    assert.equal(createHash('sha256').update(receipt.body).digest('hex'), receipt.sha256)
  }
  assert.equal(emerson.hasOfficialCareersPageSignal(text(emerson.CAREERS_URL)), true)
  assert.equal(emerson.hasOfficialCandidateExperienceSignal(text(emerson.CANDIDATE_EXPERIENCE_URL)), true)
})

test('Emerson handoff cancellation preserves the caller reason when a reader rejects or ignores it', async () => {
  const reason = Object.freeze({ cancelled: 'handoff' })
  for (const rejectReader of [false, true]) {
    const controller = new AbortController()
    let entered, release
    const started = new Promise(resolve => { entered = resolve })
    const waiting = new Promise(resolve => { release = resolve })
    const operation = emerson.run({ signal: controller.signal, fetchText: async () => {
      entered()
      if (rejectReader) { controller.abort(reason); throw new Error('Generic handoff abort') }
      return waiting
    }, fetchJson: async () => { assert.fail('Cancelled handoff cannot read a native listing') } })
    const observed = operation.then(() => ({ resolved: true }), error => ({ error }))
    await started
    if (!rejectReader) controller.abort(reason)
    try {
      const settled = await Promise.race([observed, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 100))])
      assert.equal(settled.timedOut, undefined)
      assert.equal(settled.error, reason)
    } finally { release(''); await observed }
  }
})

test('Zensar retains a genuine suffixed native requisition ID through its exact detail endpoint', async context => {
  const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/oracle-additional/2026-11-05-zensar-variant.json.gz', import.meta.url))))
  for (const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
  const page = JSON.parse(packets[0].body).items[0]
  const record = page.requisitionList.find(value => value.Id === '152155_2')
  assert.equal(record.Title, 'C# Dot Net Dev')
  const detail = JSON.parse(packets[1].body)
  const requests = []
  context.mock.method(globalThis, 'fetch', () => { assert.fail('Only retained native bodies may be read') })
  const jobs = await zensar.run({ fetchJson: async url => {
    requests.push(url)
    if (url.includes(',offset=')) return { items: [{ ...page, Offset: 0, TotalJobsCount: 1, requisitionList: [record] }] }
    assert.equal(url, zensar.buildJobDetailApiUrl('152155_2'))
    return detail
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '152155_2')
  assert.match(jobs[0].sourceUrl, /\/job\/152155_2$/)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(requests.length, 3)
})

test('Zensar genuine ok and punctuation-only authored sections cannot certify full descriptions', async () => {
  const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/oracle-additional/2026-11-05-zensar-placeholders.json.gz', import.meta.url))))
  for (const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
  const ids = new Set(['147080', '152446', '152865'])
  const rows = packets.filter(packet => packet.url.includes('recruitingCEJobRequisitions?'))
    .flatMap(packet => JSON.parse(packet.body).items[0].requisitionList).filter(record => ids.has(record.Id))
  assert.equal(rows.length, 3)
  // The exact native role/detail bodies are unchanged; count=3 is an isolated
  // modeled transport and is never used as current inventory evidence.
  const jobs = await zensar.run({ fetchJson: async url => {
    if (url.includes(',offset=')) return { items: [{ SiteNumber: 'CX_1', Limit: 24, Offset: 0,
      TotalJobsCount: 3, requisitionList: rows }] }
    const packet = packets.find(receipt => receipt.url === url)
    assert.ok(packet)
    return JSON.parse(packet.body)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'missing-content'))
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})
