import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

import * as cognex from '../../scraper/cognex.workday/script.js'
import * as condenast from '../../scraper/condenast.workday/script.js'
import { WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

export const WORKDAY_PROOF = Symbol.for('jobverify.workday.country-inventory-proof')
export const sources = { cognex, condenast }
export const sha = value => createHash('sha256').update(value).digest('hex')
export const captures = Object.fromEntries(Object.keys(sources).map(source => {
  const bytes = fs.readFileSync(new URL(`../../scraper/${source}.workday/native-captures/2026-11-01-scoped.json.gz`, import.meta.url))
  const capture = JSON.parse(gunzipSync(bytes))
  for (const packet of capture.capturedResponses) assert.equal(sha(Buffer.from(packet.bodyBase64, 'base64')), packet.bodySHA256)
  return [source, capture]
}))
export const packetFor = (source, predicate) => {
  const packet = captures[source].capturedResponses.find(predicate)
  assert.ok(packet, `Missing ${source} packet`)
  return { ...packet, body: Buffer.from(packet.bodyBase64, 'base64') }
}
export const details = Object.fromEntries(Object.keys(sources).map(source => [source,
  JSON.parse(packetFor(source, packet => packet.kind?.includes('detail')).body)]))
export const configPath = source => fileURLToPath(new URL(`../../scraper/${source}.workday/config.json`, import.meta.url))
export const providerFor = source => {
  const provider = getScraperCatalog().find(provider => provider.source === source)
  assert.ok(provider)
  return provider
}
export const asResponse = ({ url, body, status = 200, contentType = 'application/json' }) => {
  const response = new Response(body, { status, headers: { 'content-type': contentType } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

// This is a SYNTHETIC one-role opening/closing cohort. Every selected row,
// native detail and retained packet remains exact; total=1 is not a capture.
// BOTH positive primary handoffs are explicitly synthetic: Cognex's real
// primary was 429; Conde's raw SSR India anchors have opacity:0 ancestors.
// Both native primary limitations are tested separately. No company proof.
export async function exercise(t, source, { change = () => {}, options = {}, registered = false, handle = null } = {}) {
  const module = sources[source]
  const detailPacket = packetFor(source, packet => packet.kind?.includes('detail'))
  const indiaPacket = packetFor(source, packet => packet.kind === 'india-filtered-listing')
  const nativeListing = JSON.parse(indiaPacket.body)
  const info = details[source].jobPostingInfo
  const selected = nativeListing.jobPostings.find(row => row.externalPath === new URL(info.externalUrl).pathname.split(/\/(?:External_Career_Site|CondeCareers)/)[1])
  assert.ok(selected, 'Selected detail must be an exact native listing row')
  const apiUrl = indiaPacket.url
  const boardUrl = source === 'cognex' ? 'https://cognex.wd1.myworkdayjobs.com/External_Career_Site'
    : 'https://condenast.wd115.myworkdayjobs.com/CondeCareers'
  const corporateUrl = source === 'cognex' ? 'https://www.cognex.com/en/company/careers' : 'https://www.condenast.com/careers'
  const primary = { url: corporateUrl, body: `<html><body><a href="${boardUrl}">View Open Positions</a></body></html>`, contentType: 'text/html', status: 200 }
  const bootstrap = packetFor(source, packet => packet.phase === 'html-accept')
  const state = {
    primary, bootstrap, detail: structuredClone(details[source]),
    initial: { total: 1, jobPostings: [structuredClone(selected)], facets: [] },
    closing: { total: 1, jobPostings: [structuredClone(selected)], facets: [] },
  }
  change(state)
  const inputBefore = JSON.stringify(state)
  const calls = []
  let listingCalls = 0
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    calls.push({ url, method, signal: init.signal, ...(init.body ? { body: JSON.parse(init.body) } : {}) })
    if (handle) {
      const response = await handle({ url, method, init, state, calls })
      if (response !== undefined) return response
    }
    if (url === corporateUrl && method === 'GET') return asResponse(state.primary)
    if (url === boardUrl && method === 'GET') return asResponse(state.bootstrap)
    if (url === apiUrl && method === 'POST') {
      const body = JSON.parse(init.body)
      assert.deepEqual(body.appliedFacets, {}, 'Unfiltered complete-board proof cannot relabel Cognex jobFamily as locationCountry')
      assert.equal(body.searchText, '')
      assert.equal(body.offset, 0)
      assert.equal(body.limit, 20)
      assert.ok(++listingCalls <= 2, 'One synthetic opening and one closing snapshot only')
      return asResponse({ url, body: JSON.stringify(listingCalls === 1 ? state.initial : state.closing) })
    }
    if (url === detailPacket.url && method === 'GET') return asResponse({ url, body: JSON.stringify(state.detail) })
    assert.fail(`Unmocked request is prohibited: ${method} ${url}`)
  })
  let jobs, error, rejected = false
  try {
    const runOptions = {
      requestTimeoutMs: 1000, retryBaseDelayMs: 0,
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} },
      circuitBreaker: new WorkdayHostCircuitBreaker(), detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
      ...options,
    }
    jobs = registered ? await createCatalogScraper(providerFor(source)).run(runOptions) : await module.run(runOptions)
  } catch (failure) { rejected = true; error = failure }
  finally { fetchMock.mock.restore() }
  assert.equal(JSON.stringify(state), inputBefore, 'Native/mock input data must not be mutated')
  return { jobs, error, rejected, calls, state, evidence: readInventoryEvidence(jobs) }
}

export const assertScopedRole = (result, source) => {
  assert.equal(result.rejected, false, result.error?.stack)
  assert.equal(result.jobs?.length, 1)
  const job = result.jobs[0], info = details[source].jobPostingInfo
  assert.equal(job.source, source)
  assert.equal(job.company, source === 'cognex' ? 'Cognex' : 'Conde Nast')
  assert.equal(job.title, info.title)
  assert.equal(job.requisitionId, info.jobReqId)
  assert.equal(job.link, info.externalUrl)
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.sourceDescription?.length > 100)
  assert.equal(job.sourceRawDates.startDate, info.startDate)
  assert.equal(job.sourceRawDates.endDate, info.endDate ?? null)
  assert.equal(job.sourcePostingDateIsExact, false, 'Native day precision must not become an exact timestamp')
  assert.equal(job.postingDatePrecision, 'calendar-date')
  assert.equal(job.postedAt.toISOString(), info.startDate + 'T00:00:00.000Z')
  if (info.endDate) {
    assert.equal(job.closingDate.toISOString(), info.endDate + 'T00:00:00.000Z')
    assert.equal(job.closingDatePrecision, 'calendar-date')
    assert.equal(job.sourceClosingDateIsExact, false)
  }
  assert.ok(job.locations.includes(info.location), 'Native IN-coded address must remain exact, without invented country text')
  if (job.sourceLocationCountryScopes) {
    assert.ok(job.sourceLocationCountryScopes.some(row => row.label === info.location && row.scope === 'india'))
  } else {
    assert.match(job.location, /\bIndia\b/, 'Explicit listing country can avoid a second location-scope receipt')
  }
  assert.ok(result.jobs[WORKDAY_PROOF], 'Direct or registered route must retain typed board proof')
  assert.equal(result.jobs[WORKDAY_PROOF].initial.count, 1, 'Synthetic cohort count only')
  assert.equal(result.jobs[WORKDAY_PROOF].closing.count, 1)
  assert.equal(result.evidence?.reportedTotal, 1, 'Synthetic cohort, never the captured company count')
  assert.equal(result.calls.filter(call => call.method === 'POST').length, 2)
  assert.ok(result.calls.every(call => call.signal instanceof AbortSignal))
}
