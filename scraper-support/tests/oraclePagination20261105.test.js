import assert from 'node:assert/strict'
import test from 'node:test'

import * as oracle from '../../scraper/oracle/script.js'
import * as honeywell from '../../scraper/honeywell/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const description = 'Design and maintain production software services with the engineering team. Collaborate on testing, delivery, and operational reliability.'
const row = index => ({
  Id: String(900000 + index), Title: `Software Engineer ${index}`,
  PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, Karnataka, India',
  PostedDate: '2026-11-03', ShortDescriptionStr: description,
})

// Model the actual native API boundary, including the unfiltered count/offset.
const nativeTransport = (total, { foreignFirst = false, duplicate = false, emptySecond = false, detailFailure = false } = {}) => {
  const offsets = []
  const json = async url => {
    const match = /,offset=(\d+)/.exec(url)
    if (match) {
      const offset = Number(match[1])
      offsets.push(offset)
      const records = Array.from({ length: Math.min(24, total - offset) }, (_, index) => row(offset + index))
      if (foreignFirst && offset === 0) records[0] = { ...records[0], PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States' }
      if (duplicate && offset === 24) records[0] = row(0)
      return { items: [{ Offset: offset, Limit: 24, TotalJobsCount: total,
        requisitionList: emptySecond && offset === 24 ? [] : records }] }
    }
    if (detailFailure) throw Object.assign(new Error('HTTP 503'), { status: 503 })
    const id = /recruitingCEJobRequisitionDetails\/(\d+)/.exec(url)?.[1]
    assert.ok(id, `Unexpected native URL: ${url}`)
    return { ...row(Number(id) - 900000), ExternalDescriptionStr: `<p>${description}</p>` }
  }
  return { json, offsets }
}

for (const [name, module, execute] of [
  ['oracle', oracle, (options, transport) => oracle.run({ ...options,
    fetchImpl: async (url, init) => ({ ok: true, json: () => transport.json(url, init) }) })],
  ['honeywell', honeywell, (options, transport) => honeywell.createHoneywellScraper({ ...options, fetchJson: transport.json }).run()],
]) {
  test(`${name} default API pagination reads jobs beyond the inherited ten-page UI limit`, async () => {
    const transport = nativeTransport(265)
    const jobs = await execute({}, transport)
    assert.equal(jobs.length, 265)
    assert.equal(jobs.at(-1).jobId, '900264')
    assert.ok(transport.offsets.includes(264), 'the eleventh full page must not be the last page')
  })

  test(`${name} advances by raw native rows when an India-filtered page contains a foreign job`, async () => {
    const transport = nativeTransport(25, { foreignFirst: true })
    const jobs = await execute({}, transport)
    assert.equal(jobs.length, 24)
    assert.equal(jobs.at(-1).jobId, '900024')
    assert.ok(transport.offsets.includes(24))
  })

  test(`${name} preserves an explicit caller page limit as incomplete inventory`, async () => {
    const transport = nativeTransport(25)
    const jobs = await execute({ maxPages: 1 }, transport)
    assert.equal(jobs.length, 24)
    assert.deepEqual(transport.offsets, [0])
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  })

  test(`${name} rejects overlapping native pages instead of duplicating or silently dropping jobs`, async () => {
    await assert.rejects(execute({}, nativeTransport(25, { duplicate: true })), /duplicate|overlap|inventory changed/i)
  })

  test(`${name} retains observed jobs when an empty page contradicts the native total`, async () => {
    const jobs = await execute({}, nativeTransport(25, { emptySecond: true }))
    assert.equal(jobs.length, 24)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 25)
    assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  })

  test(`${name} reads later native offsets after a short nonterminal page and reports the count gap`, async () => {
    const transport = nativeTransport(25)
    const json = transport.json
    transport.json = async url => {
      const payload = await json(url)
      if (url.includes(',offset=0,')) payload.items[0].requisitionList.pop()
      return payload
    }
    const jobs = await execute({}, transport)
    assert.equal(jobs.length, 24)
    assert.equal(jobs.at(-1).jobId, '900024')
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 25)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, /count/)
    assert.ok(transport.offsets.includes(24))
  })

  test(`${name} retains useful listing data while marking failed native details incomplete`, async () => {
    const jobs = await execute({}, nativeTransport(1, { detailFailure: true }))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(jobs[0].jobId, '900000')
  })

  test(`${name} rejects a closing inventory whose role identities changed during hydration`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    let listings = 0
    transport.json = async url => {
      const payload = await json(url)
      if (url.includes(',offset=') && ++listings > 1) payload.items[0].requisitionList[0] = row(7)
      return payload
    }
    await assert.rejects(execute({}, transport), /inventory changed|closing/i)
  })

  test(`${name} never substitutes another role's detail payload for the requested identity`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    transport.json = async url => url.includes(',offset=') ? json(url) : { ...row(7), ExternalDescriptionStr: description }
    await assert.rejects(execute({}, transport), /identity|does not match|changed/i)
  })

  test(`${name} respects a pre-aborted source signal before any request`, async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled audit'))
    const transport = nativeTransport(1)
    await assert.rejects(execute({ signal: controller.signal }, transport), /cancelled audit/)
    assert.deepEqual(transport.offsets, [])
  })

  test(`${name} rejects a detail's foreign country label when the listing asserts India`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    transport.json = async url => url.includes(',offset=') ? json(url) : {
      ...row(0), PrimaryLocationCountry: null, PrimaryLocation: 'Austin, Texas, United States', ExternalDescriptionStr: description,
    }
    await assert.rejects(execute({}, transport), /countr|location/i)
  })

  test(`${name} accepts matching native titles after normalizing whitespace and HTML entities`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    transport.json = async url => {
      const payload = await json(url)
      if (url.includes(',offset=')) payload.items[0].requisitionList[0].Title = 'Research &amp;  Development Engineer'
      else payload.Title = 'Research &amp;  Development Engineer'
      return payload
    }
    const jobs = await execute({}, transport)
    assert.equal(jobs[0].title, 'Research & Development Engineer')
  })

  test(`${name} rejects a detail that replaces the listing's India secondary worksite with a foreign country`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    const foreign = { ...row(0), PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States' }
    transport.json = async url => {
      if (!url.includes(',offset=')) return { ...foreign, secondaryLocations: [{ CountryCode: 'GB', Name: 'London, United Kingdom' }], ExternalDescriptionStr: description }
      const payload = await json(url)
      payload.items[0].requisitionList[0] = { ...foreign, secondaryLocations: [{ CountryCode: 'IN', Name: 'Bengaluru, Karnataka, India' }] }
      return payload
    }
    await assert.rejects(execute({}, transport), /countr|location/i)
  })

  test(`${name} does not treat empty native rich text or a listing fallback as full role details`, async () => {
    const transport = nativeTransport(1)
    const json = transport.json
    transport.json = async url => url.includes(',offset=') ? json(url) : { ...row(0), ExternalDescriptionStr: '<p>&nbsp;</p>' }
    const jobs = await execute({}, transport)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })
}

test('Honeywell public run forwards the caller transport and pagination options', async context => {
  context.mock.method(globalThis, 'fetch', async () => {
    assert.fail('the injected public transport must be used instead of the network')
  })
  const transport = nativeTransport(1)
  const jobs = await honeywell.run({ fetchJson: transport.json })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '900000')
})

test('Oracle retains a native India secondary worksite when the primary worksite is abroad', () => {
  const record = { ...row(0), PrimaryLocationCountry: 'US', PrimaryLocation: 'Austin, Texas, United States',
    secondaryLocations: [{ CountryCode: 'IN', Name: 'Bengaluru, Karnataka, India' }] }
  const jobs = oracle.extractSearchResults({ items: [{ requisitionList: [record] }] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  const detail = oracle.extractJobDetail({ ...record, ExternalDescriptionStr: description }, jobs[0])
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
})
