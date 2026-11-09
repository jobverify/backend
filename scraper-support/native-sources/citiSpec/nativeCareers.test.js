import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as citi from '../../../scraper/citiindia/script.js'
import { createCitiSpecScraper, specCards } from './nativeCareers.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

globalThis.fetch = async () => { throw Error('Offline tests prohibit all network and website JavaScript') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
// This archive predates SPEC's AJAX inventory reader and retains only the old
// advertised HTML cohort. Exercise its historical reader without inventing a
// POST response or weakening the current production inventory contract. The
// current registered AJAX path is covered by recruitmentGoal20261106SpecNative.
const spec = {
  extractCurrentOpenings: specCards,
  run: options => createCitiSpecScraper('specindia').run(options),
}
const pages = new Map(fixture.entities.map(page => [page.receipt.url, page]))
const html = url => Buffer.from(pages.get(url).bodyBase64, 'base64').toString('utf8')
const specRoles = fixture.entities.filter(page => page.receipt.source === 'specindia' && /\/current-opening\//.test(page.receipt.url))
const replay = (mutate = (url, body) => body) => {
  const requests = [], audits = [], visits = new Map()
  const fetchPage = async url => {
    requests.push(url);const page = pages.get(url)
    assert.ok(page, 'Only retained actual current endpoints, not guessed page URLs: ' + url)
    const visit = (visits.get(url) || 0) + 1;visits.set(url, visit)
    const body = mutate(url, Buffer.from(page.bodyBase64, 'base64').toString('utf8'), visit)
    return { url, status: body === null ? 503 : page.receipt.status,
      headers: page.receipt.headers || page.receipt.responseHeaders, bodyBase64: Buffer.from(body || '').toString('base64') }
  }
  const fetchText = async url => {
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetchPage(url)
      if (response.status >= 300 && response.status < 400 && response.headers.location) { url = new URL(response.headers.location, url).href;continue }
      assert.equal(response.status, 200)
      return Buffer.from(response.bodyBase64, 'base64').toString('utf8')
    }
    throw Error('Redirect limit')
  }
  return { requests, audits, visits, options: { fetchPage, fetchText, onAudit: async audit => audits.push(audit), now: () => '2026-10-31T11:00:00.000Z' } }
}

test('retained 2026-10-31 card shapes: Citi15 and SPEC3, without an assumed country at discovery', () => {
  const cards = citi.extractSearchResults(html(citi.CAREER_PAGE_URL))
  assert.equal(cards.length, 15)
  assert.ok(cards.every(card => card.country !== 'India'), 'Discovery facet is not role country')
  const specPrimary = fixture.entities.find(page => page.receipt.source === 'specindia' && page.receipt.status === 200 && /\/about\/career/.test(page.receipt.url))
  assert.equal(spec.extractCurrentOpenings(Buffer.from(specPrimary.bodyBase64, 'base64').toString('utf8')).length, 3)
})

test('genuine Citi detail keeps complete own criteria, both IDs and literal fields', () => {
  const expected = fixture.citiOracle[0]
  const job = citi.extractJobDetail(html(expected.url), { sourceUrl: expected.url, jobId: expected.sourceTBID })
  assert.equal(job.jobDescription, expected.ownDescriptionText)
  assert.deepEqual(job.sourceNativeJobPosting, expected.model)
  assert.equal(job.jobId, expected.sourceTBID);assert.equal(job.requisitionId, expected.nativeRequisitionLabel)
  assert.equal(job.sourceEmploymentType, 'Full time');assert.equal(job.remoteStatus, 'Hybrid')
  assert.equal(job.country, 'India');assert.equal(job.sourcePostingDatePrecision, 'day')
})

test('genuine full Citi620/42 cohort is audited before maxJobs; original models, source fields and pure India behavior agree', async () => {
  const r = replay()
  const jobs = await citi.createCitiIndiaScraper({ maxJobs: 1 }).run({ ...r.options, maxJobs: 1 })
  assert.equal(jobs.length, 1);assert.equal(r.audits.length, 1)
  const audit = r.audits[0]
  assert.equal(audit.observations.length, 620)
  assert.equal(audit.opening.searchPages.length, 42);assert.equal(audit.closing.searchPages.length, 42)
  assert.equal(audit.opening.distinctRoleURLs, 620);assert.equal(audit.closing.distinctRoleURLs, 620)
  assert.ok(audit.observations.every(job => job.sourceCurrentNativeRoleQualified && job.sourceNativePhase === 'closing'))
  for (const expected of fixture.citiOracle) {
    const job = audit.observations.find(job => job.sourceUrl === expected.url)
    assert.ok(job, expected.url);assert.deepEqual(job.sourceNativeJobPosting, expected.model)
    assert.equal(job.sourceNativeOwnCriteriaText, expected.ownDescriptionText)
    assert.equal(job.sourceNativeSchemaCriteriaText, expected.schemaDescriptionText)
    assert.ok(job.jobDescription.includes(expected.ownDescriptionText));assert.ok(job.jobDescription.includes(expected.schemaDescriptionText))
    assert.equal(job.jobId, expected.sourceTBID);assert.equal(job.requisitionId, expected.nativeRequisitionLabel)
    assert.deepEqual(job.sourceNativeRoleFacts, expected.ownFields)
    assert.equal(job.sourceNativeVisibleLocationLabel, expected.ownLocationLabel)
    assert.equal(job.sourceEmploymentType, expected.sourceTimeTypeValues[0] || null)
    assert.equal(job.sourceEmploymentTypeUnresolved, expected.sourceTimeTypeValues.length === 0)
    assert.equal(job.postingDate, expected.sourceDatePosted);assert.equal(job.sourcePostingDatePrecision, 'day')
    const normalized = normalizeScrapedJob(job, { source: 'citiindia', companyName: 'Citi India', countryFilter: 'India' })
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.sourceEmploymentType, expected.sourceTimeTypeValues[0] || null)
    assert.equal(isIndiaJob(normalized), true)
    assert.equal(normalized.postedAt.toISOString().slice(0, 10), expected.sourceDatePosted)
    if (!expected.ownFields['Job Type:']) assert.equal(normalized.remoteStatus, null)
  }
  assert.equal(audit.observations.filter(job => job.sourceEmploymentTypeUnresolved).length, 62)
  assert.equal(audit.observations.filter(job => !job.remoteStatus).length, 44)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(audit.sourceScopeComplete, false);assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('historical SPEC HTML reader follows advertised detail pages, keeps all criteria and withholds city-only country', async () => {
  const r = replay(), jobs = await spec.run(r.options)
  assert.equal(jobs.length, 3);assert.equal(r.audits.length, 1)
  assert.equal(r.audits[0].observations.length, 3)
  for (const job of jobs) {
    assert.ok(specRoles.some(page => page.receipt.url === job.sourceUrl))
    assert.ok(job.jobDescription.includes('Role & Responsibilities'))
    assert.ok(job.jobDescription.includes('Skills'))
    assert.ok(job.sourceNativeRoleFacts.Experience)
    assert.equal(job.sourceNativeRoleFacts['Job Location'], 'Ahmedabad')
    assert.equal(job.sourceNativeVisibleLocationLabel, 'Ahmedabad')
    assert.equal(job.country, null);assert.equal(job.city, null);assert.equal(job.location, null)
    assert.equal(job.sourceCountryScopeUnresolved, true)
    assert.equal(job.postingDate, null);assert.equal(job.requisitionId, null);assert.equal(job.jobId, null)
    assert.equal(job.sourceEmploymentType, null);assert.equal(job.remoteStatus, null)
    const normalized = normalizeScrapedJob(job, { source: 'specindia', companyName: 'SPEC INDIA', countryFilter: 'India' })
    assert.equal(isIndiaJob(normalized), false);assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.remoteStatus, null);assert.equal(normalized.sourceEmploymentType, null)
    assert.equal(normalized.postedAtProvenance, 'observation')
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const source of ['specindia']) {
  test(source + ' historical HTML reader: awaited audit errors and cancellation are propagated', async () => {
    const r = replay()
    await assert.rejects(spec.run({ ...r.options, onAudit: async () => { throw Error('audit sink failed') } }), /audit sink failed/)
    const controller = new AbortController();controller.abort(Error('cancelled by test'))
    await assert.rejects(spec.run({ ...r.options, signal: controller.signal }), /cancelled by test/)
  })
  test(source + ' historical HTML reader: artificial failed closing detail retains historical positive but removes it from current candidates', async () => {
    const target = specRoles[0].receipt.url, r = replay((url, body, visit) => url === target && visit === 2 ? null : body)
    const jobs = await spec.run(r.options)
    assert.equal(jobs.length, 2)
    const held = r.audits[0].observations.find(job => job.sourceUrl === target)
    assert.ok(held.jobDescription);assert.equal(held.sourceCurrentNativeRoleQualified, false)
    assert.ok(r.audits[0].observationHistory.some(entry => entry.url === target && entry.earlier.jobDescription))
  })
}

// Artificial bounded cohort uses only the genuine first-page links and role
// bodies. Its altered counters are offline controls, never fresh HTTP evidence.
const fifteenRoleControl = (url, body) => url === citi.CAREER_PAGE_URL
  ? body.replace(/data-total-job-results="620"/, 'data-total-job-results="15"').replace(/data-total-pages="42"/, 'data-total-pages="1"') : body

for (const changedField of ['requisition', 'application-target']) test('artificial changed closing Citi ' + changedField + ' retains both snapshots but holds the candidate', async () => {
  const target = fixture.citiOracle[0], r = replay((url, body, visit) => {
    body = fifteenRoleControl(url, body)
    if (url !== target.url || visit !== 2) return body
    if (changedField === 'requisition') return body.replaceAll(target.nativeRequisitionLabel, '99999999')
    return body.replace(/(class="[^"]*job-apply[^"]*"[^>]*href=")([^"]+)(")/g, '$1https://www.example.com/changed-public-handoff$3')
      .replace(/(href=")([^"]+)("[^>]*class="[^"]*job-apply[^"]*")/g, '$1https://www.example.com/changed-public-handoff$3')
  })
  const jobs = await citi.run(r.options), audit = r.audits[0]
  assert.equal(audit.observations.length, 15);assert.equal(jobs.length, 14)
  const held = audit.observations.find(job => job.sourceUrl === target.url), history = audit.observationHistory.find(row => row.url === target.url)
  assert.equal(held.sourceCurrentNativeRoleQualified, false)
  assert.match(held.sourceNativeTemporalQualification, /identity|handoff|application-target/)
  assert.ok(history.earlier.jobDescription);assert.ok(history.current.jobDescription)
  if (changedField === 'requisition') assert.notEqual(history.earlier.requisitionId, history.current.requisitionId)
  else assert.notEqual(history.earlier.applyUrl, history.current.applyUrl)
})

test('historical SPEC artificial changed closing CMS identity holds the complete role with both original snapshots retained', async () => {
  const target = specRoles[0].receipt.url, r = replay((url, body, visit) => url === target && visit === 2 ? body.replace(/postid-\d+/, 'postid-99999999') : body)
  const jobs = await spec.run(r.options), audit = r.audits[0]
  assert.equal(jobs.length, 2)
  const held = audit.observations.find(job => job.sourceUrl === target), history = audit.observationHistory.find(row => row.url === target)
  assert.equal(held.sourceCurrentNativeRoleQualified, false)
  assert.notEqual(history.earlier.sourceNativeCMSPostId, history.current.sourceNativeCMSPostId)
  assert.ok(history.earlier.jobDescription);assert.ok(history.current.jobDescription)
})

test('historical SPEC artificial out-of-order response timing preserves native observation/history order and maxJobs selection', async () => {
  const declared = spec.extractCurrentOpenings(html('https://www.spec-india.com/about/career')).map(link => link.url)
  const run = async delayed => {
    const r = replay(), originalFetch = r.options.fetchPage
    r.options.fetchPage = async url => {
      if (delayed && url === declared[0]) await new Promise(resolve => setTimeout(resolve, 80))
      return originalFetch(url)
    }
    return { jobs: await spec.run({ ...r.options, maxJobs: 1 }), audit: r.audits[0] }
  }
  const normal = await run(false), delayed = await run(true)
  for (const result of [normal, delayed]) {
    assert.deepEqual(result.audit.observations.map(job => job.sourceUrl), declared)
    assert.deepEqual(result.audit.observationHistory.map(row => row.url), declared)
    assert.equal(result.jobs[0].sourceUrl, declared[0]);assert.equal(result.audit.observations.length, 3)
  }
})
