import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { gzipSha256, responseSha256 } from './test-data/manifest-20261103.js'

const gzip = fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))
assert.equal(createHash('sha256').update(gzip).digest('hex'), gzipSha256)
const captures = JSON.parse(zlib.gunzipSync(gzip))
const bodies = new Map(captures.map(row => {
  assert.equal(createHash('sha256').update(row.body).digest('hex'), responseSha256[row.requestedUrl])
  return [row.requestedUrl, row.body]
}))
const origin = 'https://eibd.fa.em2.oraclecloud.com'
const listing = origin + '/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,facetsList=NONE,limit=24,offset=0'
const reader = mutate => async (url, options = {}) => {
  assert.ok(options.signal == null || typeof options.signal.aborted === 'boolean')
  assert.ok(bodies.has(url), 'captured current protocol URL: ' + url)
  return mutate?.(url, bodies.get(url)) ?? bodies.get(url)
}

test('Adani follows all current employer portals and hydrates all 1023 native roles', async () => {
  let report
  const jobs = await run({ fetchText: reader(), onAudit: async value => { report = value } })
  assert.equal(jobs.length, 1023)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 1023)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.sourceScopeComplete))
  assert.equal(report.nativeRecords.length, 1023)
  assert.equal(report.publishedSiteCounts.CX_2027, 25)
  assert.equal(report.publishedSiteCounts.CX_2011, 114)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(report.closingMatches, true)
  const job = jobs.find(job => job.jobId === '56267')
  assert.match(job.jobDescription, /Product Strategy & Conceptualization/)
  assert.match(job.jobDescription, /PMP, Prince2, or Agile\/Scrum/)
  assert.ok(job.qualifications && job.responsibilities)
  assert.equal(job.legalEmployer, null)
})

test('Adani rejects a truncated native inventory page', async () => {
  await assert.rejects(run({ fetchText: reader((url, body) => {
    if (url !== listing) return body
    const value = JSON.parse(body); value.items[0].requisitionList.pop(); return JSON.stringify(value)
  }) }), /native page.*count/i)
})

test('Adani closes its native listing inventory after the full detail reconciliation', async () => {
  let groupFirstPages = 0, detailsAfterClosingListing = 0
  await run({ fetchText: reader((url, body) => {
    if (url === listing) groupFirstPages++
    if (url.includes('RequisitionDetails?') && groupFirstPages > 1) detailsAfterClosingListing++
    return body
  }) })
  assert.equal(groupFirstPages, 2)
  assert.equal(detailsAfterClosingListing, 0)
})

test('Adani rejects native listing and detail country disagreement', async () => {
  await assert.rejects(run({ fetchText: reader((url, body) => {
    if (!url.includes('RequisitionDetails?') || !url.includes('%2256267%22')) return body
    const value = JSON.parse(body); value.items[0].PrimaryLocationCountry = 'US'; return JSON.stringify(value)
  }) }), /detail.*country/i)
})

test('Adani retains a closing criteria mutation as an incomplete inventory', async () => {
  let reads = 0
  const jobs = await run({ fetchText: reader((url, body) => {
    if (!url.includes('RequisitionDetails?') || !url.includes('%2256267%22')) return body
    if (++reads === 1) return body
    const value = JSON.parse(body); value.items[0].ExternalQualificationsStr += '<p>New mandatory criterion</p>'; return JSON.stringify(value)
  }) })
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /closing.*criteria/)
})

test('Adani closing comparison includes every mapped department and employer identity field', async () => {
  for (const field of ['Department', 'JobFunction', 'Category', 'LegalEmployerId', 'BusinessUnitId', 'OrganizationId']) {
    let reads = 0
    const jobs = await run({ fetchText: reader((url, body) => {
      if (!url.includes('RequisitionDetails?') || !url.includes('%2256267%22') || ++reads === 1) return body
      const value = JSON.parse(body)
      value.items[0][field] = field.endsWith('Id') ? 999999999 : 'Changed native ' + field
      return JSON.stringify(value)
    }) })
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap', field)
    assert.match(readInventoryEvidence(jobs).reason, /closing.*criteria/, field)
  }
})

test('Adani does not accept contradictory shared-ID business listing models as complete inventory', async () => {
  for (const [field, replacement] of [['PrimaryLocationCountry', 'US'], ['Title', 'Contradictory native business title'], ['LegalEmployerId', 999999999]]) {
    let report
    const jobs = await run({ fetchText: reader((url, body) => {
      if (!url.includes('siteNumber=CX_2027,') || !url.includes('Requisitions?')) return body
      const value = JSON.parse(body)
      if (value.items[0].requisitionList.length) value.items[0].requisitionList[0][field] = replacement
      return JSON.stringify(value)
    }), onAudit: async value => { report = value } })
    assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap', field)
    assert.match(readInventoryEvidence(jobs).reason, /business.*listing.*model/, field)
    assert.ok(report.businessListingModelMismatches.length > 0, field)
    assert.ok(report.publishedBusinessRecords.CX_2027.length, field)
  }
})

const abortWithin = async (pending, reason) => {
  let timer
  try {
    await assert.rejects(Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('caller abort did not settle the scraper')), 250) })]), error => error === reason)
  } finally { clearTimeout(timer) }
}

test('Adani caller cancellation settles an abort-ignoring injected reader', async () => {
  const controller = new AbortController(), reason = new Error('caller cancelled blocked reader')
  let entered
  const ready = new Promise(resolve => { entered = resolve })
  const pending = run({ signal: controller.signal, fetchText: async () => { entered(); return new Promise(() => {}) } })
  await ready
  controller.abort(reason)
  await abortWithin(pending, reason)
})

test('Adani caller cancellation settles an abort-ignoring audit observer', async () => {
  const controller = new AbortController(), reason = new Error('caller cancelled blocked observer')
  let entered
  const ready = new Promise(resolve => { entered = resolve })
  const pending = run({ signal: controller.signal, fetchText: reader(), maxPages: 1, onAudit: async () => { entered(); return new Promise(() => {}) } })
  await ready
  controller.abort(reason)
  await abortWithin(pending, reason)
})

test('Adani cannot use only its first business site as group inventory', async () => {
  await assert.rejects(run({ fetchText: reader((url, body) => url === 'https://careers.adani.com/'
    ? body.replace(/#en\/sites\/CX_1\/requisitions/g, '#en/sites/CX_2027/requisitions') : body) }), /generic.*group|group.*generic/i)
})

test('Adani page cap remains an explicit coverage gap', async () => {
  const jobs = await run({ fetchText: reader(), maxPages: 1 })
  assert.ok(jobs.length > 0 && jobs.length < 1023)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /page-cap/)
})

test('Adani job cap cannot authorize cleanup', async () => {
  const jobs = await run({ fetchText: reader(), maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.match(readInventoryEvidence(jobs).reason, /job-cap/)
})

test('Adani awaits and propagates its audit callback exactly once', async () => {
  const failure = new Error('audit sink failed'); let calls = 0
  await assert.rejects(run({ fetchText: reader(), maxPages: 1, onAudit: async () => { calls++; throw failure } }), error => error === failure)
  assert.equal(calls, 1)
})

test('Adani forwards cancellation before reading a current employer surface', async () => {
  const controller = new AbortController(), reason = new Error('cancelled'); controller.abort(reason)
  let requests = 0
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => { requests++; return '' } }), error => error === reason)
  assert.equal(requests, 0)
})
