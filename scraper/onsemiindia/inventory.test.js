import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setImmediate as turn } from 'node:timers/promises'
import { gunzipSync } from 'node:zlib'

import * as onsemi from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/2026-11-05-public.json.gz', import.meta.url))))
const captured = ordinal => packets.find(packet => packet.ordinal === ordinal)
const parsed = ordinal => JSON.parse(captured(ordinal).body)
const corporate = captured(1).body, candidate = captured(4).body
const listingTemplate = parsed(3).items[0].requisitionList[0]
const detailTemplate = parsed(6).items[0]
const scope = jobs => jobs[Symbol.for('jobverify.onsemi-inventory')]

// The public GET bodies above are unchanged. These small inventories and
// failures deliberately model native edge cases, using complete captured rows.
const role = index => ({ ...structuredClone(listingTemplate), Id: String(980000 + index),
  Title: `Modeled verification engineer ${index}`, secondaryLocations: [] })
const nativeDetail = row => ({ ...structuredClone(detailTemplate), Id: row.Id, Title: row.Title,
  PrimaryLocation: row.PrimaryLocation, PrimaryLocationCountry: row.PrimaryLocationCountry,
  secondaryLocations: structuredClone(row.secondaryLocations) })
const response = (body, url, status = 200) => ({ ok: status >= 200 && status < 300, status, url,
  text: async () => body, json: async () => JSON.parse(body) })
const model = (total = 1, modify = value => value) => {
  const calls = [], offsets = [], detailIds = []
  let listRead = 0, active = 0, maximum = 0
  const fetchImpl = async (url, options = {}) => {
    calls.push(url)
    if (url === onsemi.CORPORATE_CAREERS_URL) {
      const result = await modify(corporate, { kind: 'corporate', url, options })
      return typeof result === 'string' ? response(result, url) : result
    }
    if (/\/hcmUI\//.test(url)) {
      const result = await modify(candidate, { kind: 'candidate', url, options })
      return typeof result === 'string' ? response(result, url) : result
    }
    const offsetMatch = /,offset=(\d+)/.exec(url)
    if (offsetMatch) {
      const offset = Number(offsetMatch[1])
      offsets.push(offset)
      const value = { items: [{ ...structuredClone(parsed(7).items[0]), Location: null,
        SiteNumber: 'CX_1001', Offset: offset, Limit: 24, TotalJobsCount: total,
        requisitionList: Array.from({ length: Math.max(0, Math.min(24, total - offset)) }, (_, index) => role(offset + index)) }] }
      const result = await modify(value, { kind: 'listing', offset, read: ++listRead, url, options })
      return result?.text ? result : response(JSON.stringify(result), url)
    }
    const id = /Id=%22(\d+)%22/.exec(url)?.[1]
    assert.ok(id, `Unexpected request: ${url}`)
    detailIds.push(id)
    maximum = Math.max(maximum, ++active)
    try {
      await turn()
      const result = await modify({ items: [nativeDetail(role(Number(id) - 980000))] }, { kind: 'detail', id, url, options })
      return result?.text ? result : response(JSON.stringify(result), url)
    } finally { active-- }
  }
  return { fetchImpl, calls, offsets, detailIds, get maximum() { return maximum } }
}
const execute = (context, transport, options = {}) => {
  // Prevent the previous default implementation from touching the network when
  // it ignores the newly supported public fetchImpl option.
  context.mock.method(globalThis, 'fetch', transport.fetchImpl)
  return onsemi.run({ fetchImpl: transport.fetchImpl, ...options })
}

test('onsemi current raw fixtures retain their recorded public response hashes', () => {
  for (const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
  assert.equal(parsed(7).items[0].TotalJobsCount, 698)
  assert.equal(parsed(3).items[0].TotalJobsCount, 92)
  assert.equal(parsed(8).items[0].Id, '2505739')
})

test('onsemi public run verifies the actual handoff before closing an unfiltered global inventory', async context => {
  const native = model(1)
  const jobs = await execute(context, native)
  assert.equal(native.calls[0], 'https://www.onsemi.com/careers')
  assert.equal(native.calls[1], 'https://hctz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001')
  assert.equal(native.calls.filter(url => url.includes('findReqs')).some(url => /,location=/.test(url)), false)
  assert.deepEqual(native.offsets, [0, 0])
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 1)
  assert.equal(scope(jobs)?.queryScope, 'global-site')
  assert.deepEqual(scope(jobs)?.opening?.ids, ['980000'])
  assert.deepEqual(scope(jobs)?.closing?.ids, ['980000'])
  assert.ok(jobs.every(job => job.sourceScopeComplete && job.sourceDetailComplete && job.lifecycleCleanupAllowed))
})

test('onsemi native pagination continues past ten pages and closes all raw offsets', async context => {
  const native = model(265)
  const jobs = await execute(context, native)
  assert.equal(jobs.length, 265)
  assert.equal(jobs.at(-1).jobId, '980264')
  assert.deepEqual(native.offsets, [...Array.from({ length: 12 }, (_, i) => i * 24), ...Array.from({ length: 12 }, (_, i) => i * 24)])
  assert.equal(scope(jobs)?.opening?.rawCount, 265)
})

test('onsemi crosses a foreign-only page before selecting typed India locations', async context => {
  const native = model(25, (value, phase) => {
    if (phase.kind === 'listing' && phase.offset === 0) for (const row of value.items[0].requisitionList) {
      row.PrimaryLocationCountry = 'US'; row.PrimaryLocation = 'Austin, Texas, United States'
    }
    return value
  })
  const jobs = await execute(context, native)
  assert.deepEqual(jobs.map(job => job.jobId), ['980024'])
  assert.deepEqual(native.offsets, [0, 24, 0, 24])
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 25)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 1)
})

test('onsemi follows later native offsets after a short raw page and retains the unreconciled count', async context => {
  const native = model(25, (value, phase) => {
    if (phase.kind === 'listing' && phase.offset === 0) value.items[0].requisitionList.pop()
    return value
  })
  const jobs = await execute(context, native)
  assert.equal(jobs.length, 24)
  assert.equal(jobs.at(-1).jobId, '980024')
  assert.deepEqual(native.offsets, [0, 24, 0, 24])
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.ok(jobs.every(job => !job.lifecycleCleanupAllowed))
})

test('onsemi caller page and job limits disable completeness and cleanup', async context => {
  for (const options of [{ maxPages: 1 }, { maxJobs: 1 }]) {
    const jobs = await execute(context, model(25), options)
    assert.equal(jobs.length, options.maxPages ? 24 : 1)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  }
})

test('onsemi accepts native secondary country IN without inventing a primary India workplace', async context => {
  const native = model(1, (value, phase) => {
    if (['listing', 'detail'].includes(phase.kind)) for (const row of value.items[0].requisitionList || value.items) {
      row.PrimaryLocationCountry = 'IL'; row.PrimaryLocation = 'Haifa, Haifa, Israel'
      row.secondaryLocations = [{ CountryCode: 'IN', Name: 'Bangalore' }]
    }
    return value
  })
  const jobs = await execute(context, native)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.deepEqual(jobs[0].sourceNativeLocations.map(location => location.country), ['Israel', 'India'])
})

test('onsemi unknown typed countries stay unknown and cannot authorize global cleanup', async context => {
  const native = model(2, (value, phase) => {
    if (phase.kind === 'listing') Object.assign(value.items[0].requisitionList[1], {
      PrimaryLocationCountry: null, PrimaryLocation: 'Bangalore, Karnataka, India', secondaryLocations: [] })
    return value
  })
  const jobs = await execute(context, native)
  assert.deepEqual(jobs.map(job => job.jobId), ['980000'])
  assert.equal(scope(jobs)?.opening?.unknownCountryIds?.includes('980001'), true)
  assert.equal(scope(jobs)?.opening?.records?.[1]?.locations?.[0]?.country, null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('onsemi preserves genuine primary and secondary India roles and every native external section', async context => {
  for (const ordinal of [6, 8]) {
    const detail = parsed(ordinal).items[0]
    const native = model(1, (value, phase) => {
      if (phase.kind === 'listing') value.items[0].requisitionList = [Object.assign(structuredClone(listingTemplate), {
        Id: detail.Id, Title: detail.Title, PrimaryLocation: detail.PrimaryLocation,
        PrimaryLocationCountry: detail.PrimaryLocationCountry, secondaryLocations: detail.secondaryLocations })]
      if (phase.kind === 'detail') return response(captured(ordinal).body, phase.url)
      return value
    })
    const jobs = await execute(context, native)
    assert.equal(jobs[0].jobId, detail.Id)
    assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0].sourceExternalSections.ExternalDescriptionStr, detail.ExternalDescriptionStr)
    assert.equal(jobs[0].sourceExternalSections.ExternalResponsibilitiesStr, detail.ExternalResponsibilitiesStr)
    assert.equal(jobs[0].sourceExternalSections.ExternalQualificationsStr, detail.ExternalQualificationsStr)
    assert.equal(jobs[0].sourceDescription, jobs[0].jobDescription)
    assert.ok(jobs[0].sourceDescription.length > 1000)
  }
})

test('onsemi failed details remain explicitly incomplete while other native roles survive', async context => {
  const native = model(2, (value, phase) => {
    if (phase.kind === 'detail' && phase.id === '980000') return response('Service unavailable', phase.url, 503)
    return value
  })
  const jobs = await execute(context, native)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'upstream')
  assert.equal(jobs[1].sourceDetailComplete, true)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('onsemi a summary-only native response cannot stand in for full authored content', async context => {
  const native = model(1, (value, phase) => {
    if (phase.kind === 'detail') Object.assign(value.items[0], {
      ExternalDescriptionStr: null, ExternalResponsibilitiesStr: null, ExternalQualificationsStr: null,
      ShortDescriptionStr: 'This is only a short preview of an engineering role.' })
    return value
  })
  const jobs = await execute(context, native)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.ok(!jobs[0].sourceDescription)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('onsemi preserves unresolved detail countries separately from complete native authored content', async context => {
  const native = model(1, (value, phase) => {
    if (['listing', 'detail'].includes(phase.kind)) for (const row of value.items[0].requisitionList || value.items) {
      row.secondaryLocations = [{ CountryCode: null, Name: 'Remote' }]
    }
    return value
  })
  const jobs = await execute(context, native)
  assert.ok(jobs[0].sourceDescription.length > 1000)
  assert.equal(jobs[0].sourceNativeLocations[1].country, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'native-location-scope-unresolved')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('onsemi missing native authored sections remain a content gap even with unresolved countries', async context => {
  const native = model(1, (value, phase) => {
    if (['listing', 'detail'].includes(phase.kind)) for (const row of value.items[0].requisitionList || value.items) {
      row.secondaryLocations = [{ CountryCode: null, Name: 'Remote' }]
    }
    if (phase.kind === 'detail') delete value.items[0].ExternalQualificationsStr
    return value
  })
  const jobs = await execute(context, native)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('onsemi rejects malformed native envelopes, identities and raw totals', async context => {
  for (const fault of ['envelope', 'site', 'limit', 'offset', 'identity', 'duplicate', 'null-record']) {
    const native = model(2, (value, phase) => {
      if (phase.kind !== 'listing') return value
      const c = value.items[0]
      if (fault === 'envelope') return { items: [] }
      if (fault === 'site') c.SiteNumber = 'CX_9'
      if (fault === 'limit') c.Limit = 1
      if (fault === 'offset') c.Offset = 24
      if (fault === 'identity') c.requisitionList[0].Id = null
      if (fault === 'duplicate') c.requisitionList[1].Id = c.requisitionList[0].Id
      if (fault === 'null-record') c.requisitionList[0] = null
      return value
    })
    await assert.rejects(execute(context, native), error => ['upstream_contract_changed', 'upstream_inventory_changed'].includes(error.failureKind), fault)
  }
})

test('onsemi closing inventory detects changed identity or native country relations', async context => {
  for (const fault of ['id', 'country', 'total']) {
    const native = model(1, (value, phase) => {
      if (phase.kind === 'listing' && phase.read === 2) {
        if (fault === 'id') value.items[0].requisitionList[0].Id = '980001'
        if (fault === 'country') value.items[0].requisitionList[0].secondaryLocations = [{ CountryCode: 'DE', Name: 'Munich, Germany' }]
        if (fault === 'total') value.items[0].TotalJobsCount = 2
      }
      return value
    })
    await assert.rejects(execute(context, native), error => error.failureKind === 'upstream_inventory_changed')
  }
})

test('onsemi cannot certify a global site when native query filters or offset/site identity are missing or constrained', async context => {
  for (const fault of ['location', 'keyword', 'category', 'organization', 'worksite', 'missing-site', 'missing-offset', 'missing-context']) {
    const native = model(1, (value, phase) => {
      if (phase.kind !== 'listing') return value
      const summary = value.items[0]
      if (fault === 'location') summary.Location = 'India'
      if (fault === 'keyword') summary.Keyword = 'Engineer'
      if (fault === 'category') summary.SelectedCategoriesFacet = '300002294318458'
      if (fault === 'organization') summary.OrganizationId = 300000006095873
      if (fault === 'worksite') summary.WorkLocationCountryCode = 'IN'
      if (fault === 'missing-site') delete summary.SiteNumber
      if (fault === 'missing-offset') delete summary.Offset
      if (fault === 'missing-context') delete summary.Location
      return value
    })
    await assert.rejects(execute(context, native), error => error.failureKind === 'upstream_contract_changed', fault)
  }
})

test('onsemi rejects detail identity, role title and secondary worksite conflicts', async context => {
  for (const fault of ['id', 'title', 'country', 'secondary']) {
    const native = model(1, (value, phase) => {
      if (phase.kind === 'detail') {
        if (fault === 'id') value.items[0].Id = '980999'
        if (fault === 'title') value.items[0].Title = 'A different role'
        if (fault === 'country') value.items[0].PrimaryLocationCountry = 'US'
        if (fault === 'secondary') value.items[0].secondaryLocations = [{ CountryCode: 'DE', Name: 'Munich, Germany' }]
      }
      return value
    })
    await assert.rejects(execute(context, native), error => error.failureKind === 'upstream_contract_changed', fault)
  }
})

test('onsemi current hiring proof rejects missing, inert, changed or redirected corporate handoffs', async context => {
  for (const fault of ['missing', 'inert', 'changed', 'candidate', 'redirect']) {
    const native = model(1, (value, phase) => {
      if (phase.kind === 'corporate') {
        if (fault === 'missing') return '<html><title>Careers</title><p>No hiring link.</p></html>'
        if (fault === 'inert') return `<template><a href="https://hctz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001">Jobs</a></template>`
        if (fault === 'changed') return value.replaceAll('sites/CX_1001', 'sites/CX_9999')
        if (fault === 'redirect') return response(value, 'https://unrelated.invalid/careers')
      }
      if (phase.kind === 'candidate' && fault === 'candidate') return value.replaceAll('data-sitenumber="CX_1001"', 'data-sitenumber="CX_9999"')
      return value
    })
    await assert.rejects(execute(context, native), error => error.failureKind === 'upstream_contract_changed', fault)
    assert.equal(native.detailIds.length, 0)
  }
})

test('onsemi optional detail concurrency remains bounded and returns native ordering', async context => {
  for (const options of [{}, { detailConcurrency: 3 }]) {
    const native = model(8)
    const jobs = await execute(context, native, options)
    assert.equal(native.maximum, options.detailConcurrency || 1)
    assert.deepEqual(jobs.map(job => job.jobId), ['980000', '980001', '980002', '980003', '980004', '980005', '980006', '980007'])
  }
})

test('onsemi rejects invalid controls before starting any public request', async context => {
  for (const options of [{ detailConcurrency: 0 }, { detailConcurrency: 11 }, { detailConcurrency: 2.5 },
    { maxPages: -1 }, { maxJobs: -1 }, { maxPages: 1e16 }, { maxJobs: 1e16 },
    { requestTimeoutMs: 0 }, { collectionBudgetMs: -1 }]) {
    const native = model(1)
    await assert.rejects(execute(context, native, options), error => error instanceof RangeError || error instanceof TypeError)
    assert.equal(native.calls.length, 0)
  }
})

test('onsemi preserves exact falsey and opaque caller cancellation reasons before public requests', async context => {
  for (const reason of [false, 0, '', null, Object.freeze({ stop: 'onsemi' })]) {
    const controller = new AbortController(); controller.abort(reason)
    const native = model(1)
    const result = await execute(context, native, { signal: controller.signal }).then(value => ({ value }), error => ({ error }))
    assert.equal(result.error, reason)
    assert.equal(native.calls.length, 0)
  }
})

test('onsemi races ignored transport and response-body cancellation without later queued reads', async context => {
  for (const phaseToHold of ['transport', 'body']) {
    const controller = new AbortController(), reason = Object.freeze({ stop: phaseToHold })
    let release, started
    const wait = new Promise(resolve => { release = resolve })
    const holding = new Promise(resolve => { started = resolve })
    const native = model(8, async (value, phase) => {
      if (phase.kind === 'detail') {
        started()
        if (phaseToHold === 'transport') await wait
        else return { ...response(JSON.stringify(value), phase.url), text: async () => { await wait; return JSON.stringify(value) } }
      }
      return value
    })
    const pending = execute(context, native, { signal: controller.signal, detailConcurrency: 3 })
      .then(value => ({ value }), error => ({ error }))
    try {
      await holding; await turn(); controller.abort(reason)
      const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))])
      assert.equal(result.timedOut, undefined)
      assert.equal(result.error, reason)
      const admitted = native.detailIds.length
      release(); await turn(); await turn()
      assert.equal(native.detailIds.length, admitted)
      assert.ok(admitted <= 3)
    } finally { controller.abort(reason); release(); await pending }
  }
})

test('onsemi fatal detail identity aborts ignored peers before queued detail admission', async context => {
  let release, started
  const wait = new Promise(resolve => { release = resolve })
  const holding = new Promise(resolve => { started = resolve })
  const native = model(8, async (value, phase) => {
    if (phase.kind === 'detail') {
      if (phase.id === '980000') { await turn(); value.items[0].Id = '980999'; return value }
      started(); await wait
    }
    return value
  })
  const pending = execute(context, native, { detailConcurrency: 3 }).then(value => ({ value }), error => ({ error }))
  try {
    await holding
    const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))])
    assert.equal(result.timedOut, undefined)
    assert.equal(result.error?.failureKind, 'upstream_contract_changed')
    release(); await turn(); await turn()
    assert.ok(native.detailIds.length <= 3)
  } finally { release(); await pending }
})

test('onsemi request and collection deadlines bound readers that ignore abort signals', async context => {
  for (const options of [{ requestTimeoutMs: 20 }, { collectionBudgetMs: 20 }]) {
    let release
    const wait = new Promise(resolve => { release = resolve })
    const native = model(1, async (value, phase) => { if (phase.kind === 'corporate') await wait; return value })
    const pending = execute(context, native, options).then(value => ({ value }), error => ({ error }))
    try {
      const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))])
      assert.equal(result.timedOut, undefined)
      assert.ok(result.error)
      assert.equal(native.calls.length, 1)
    } finally { release(); await pending }
  }
})

test('onsemi streamed response byte limits cancel the reader before another chunk or document', async context => {
  let reads = 0, cancellations = 0
  const native = model(1, (value, phase) => phase.kind === 'corporate' ? {
    ...response(value, phase.url), body: { getReader: () => ({
      read: async () => { reads++; return { done: false, value: Buffer.alloc(32) } },
      cancel: () => { cancellations++; return Promise.resolve() }, releaseLock: () => {},
    }) },
  } : value)
  await assert.rejects(execute(context, native, { maxResponseBytes: 16 }), error => error.code === 'ONSEMI_BODY_BYTE_LIMIT')
  assert.equal(reads, 1)
  assert.equal(cancellations, 1)
  assert.equal(native.calls.length, 1)
})

test('onsemi nonstream and decoded readers reject excessive bodies before parsing another native document', async context => {
  const native = model(1)
  await assert.rejects(execute(context, native, { maxResponseBytes: 16 }), error => error.code === 'ONSEMI_BODY_BYTE_LIMIT')
  assert.equal(native.calls.length, 1)
  let textReads = 0
  await assert.rejects(onsemi.run({ maxResponseBytes: 16, fetchText: async () => { textReads++; return corporate } }),
    error => error.code === 'ONSEMI_BODY_BYTE_LIMIT')
  assert.equal(textReads, 1)
})

test('onsemi aggregate byte limits include earlier successful documents', async context => {
  const native = model(1)
  const maxTotalBytes = Buffer.byteLength(corporate) + Buffer.byteLength(candidate) - 1
  await assert.rejects(execute(context, native, { maxResponseBytes: 2_000_000, maxTotalBytes }),
    error => error.code === 'ONSEMI_BODY_BYTE_LIMIT')
  assert.equal(native.calls.length, 2)
  assert.equal(native.detailIds.length, 0)
})

test('onsemi streaming cancellation preserves opaque and falsey caller reasons while cancelling pending reads', async context => {
  for (const reason of [false, Object.freeze({ stop: 'stream-body' })]) {
    const controller = new AbortController()
    let started, release, cancellations = 0
    const holding = new Promise(resolve => { started = resolve })
    const wait = new Promise(resolve => { release = resolve })
    const native = model(1, (value, phase) => phase.kind === 'corporate' ? {
      ...response(value, phase.url), text: async () => { started(); await wait; return value },
      body: { getReader: () => ({ read: async () => { started(); await wait; return { done: true } },
        cancel: () => { cancellations++; return Promise.reject(new Error('ignored reader cancellation')) }, releaseLock: () => {} }) },
    } : value)
    const pending = execute(context, native, { signal: controller.signal }).then(value => ({ value }), error => ({ error }))
    try {
      await holding; controller.abort(reason)
      const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))])
      assert.equal(result.timedOut, undefined)
      assert.equal(result.error, reason)
      assert.equal(cancellations, 1)
      assert.equal(native.calls.length, 1)
    } finally { release(); await pending }
  }
})

test('onsemi byte-limit failure aborts active peers and forbids late queued details', async context => {
  let release, peersStarted
  const wait = new Promise(resolve => { release = resolve })
  const holding = new Promise(resolve => { peersStarted = resolve })
  let cancellations = 0
  const native = model(8, (value, phase) => {
    if (phase.kind !== 'detail') return value
    const first = phase.id === '980000'
    return { ...response(JSON.stringify(value), phase.url),
      text: async () => { if (!first) { peersStarted(); await wait }; return JSON.stringify(value) },
      body: { getReader: () => ({ read: async () => {
        if (first) { await turn(); return { done: false, value: Buffer.alloc(2_000_001) } }
        peersStarted(); await wait; return { done: true }
      }, cancel: () => { cancellations++; return Promise.resolve() }, releaseLock: () => {} }) },
    }
  })
  const pending = execute(context, native, { detailConcurrency: 3, maxResponseBytes: 2_000_000 })
    .then(value => ({ value }), error => ({ error }))
  try {
    await holding
    const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 250))])
    assert.equal(result.timedOut, undefined)
    assert.equal(result.error?.code, 'ONSEMI_BODY_BYTE_LIMIT')
    assert.ok(native.detailIds.length <= 3)
    assert.ok(cancellations >= 1)
    const admitted = native.detailIds.length
    release(); await turn(); await turn()
    assert.equal(native.detailIds.length, admitted)
  } finally { release(); await pending }
})

test('onsemi invalid byte budgets fail before a public read', async context => {
  for (const options of [{ maxResponseBytes: 0 }, { maxResponseBytes: Infinity }, { maxTotalBytes: -1 }, { maxTotalBytes: 1.5 }]) {
    const native = model(1)
    await assert.rejects(execute(context, native, options), error => error instanceof RangeError)
    assert.equal(native.calls.length, 0)
  }
})

test('onsemi a nonbyte stream chunk cannot bypass byte accounting', async context => {
  let read = false, cancellations = 0
  const native = model(1, (value, phase) => phase.kind === 'corporate' ? {
    ...response(value, phase.url), body: { getReader: () => ({ read: async () => {
      if (read) return { done: true }
      read = true; return { done: false, value }
    }, cancel: () => { cancellations++; return Promise.resolve() }, releaseLock: () => {} }) },
  } : value)
  await assert.rejects(execute(context, native), error => error.failureKind === 'upstream_contract_changed')
  assert.equal(native.calls.length, 1)
  assert.equal(cancellations, 1)
})

test('onsemi an array-like stream chunk cannot underreport the bytes copied', async context => {
  let delivered = false, lengthReads = 0, cancellations = 0
  const fakeChunk = { byteLength: 1, 0: 65, get length() { lengthReads++; return 128 } }
  const native = model(1, (value, phase) => phase.kind === 'corporate' ? {
    ...response(value, phase.url), body: { getReader: () => ({ read: async () => {
      if (delivered) return { done: true }
      delivered = true; return { done: false, value: fakeChunk }
    }, cancel: () => { cancellations++; return Promise.resolve() }, releaseLock: () => {} }) },
  } : value)
  await assert.rejects(execute(context, native, { maxResponseBytes: 16 }),
    error => error.failureKind === 'upstream_contract_changed' && /stream.*byte/i.test(error.message))
  assert.equal(lengthReads, 0)
  assert.equal(cancellations, 1)
  assert.equal(native.calls.length, 1)
})
