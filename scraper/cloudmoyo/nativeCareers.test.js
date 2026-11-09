import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCloudMoyoScraper, hasVerifiedZeroListingsSignal } from './script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { CLOUDMOYO_CATALOG } from './catalog.js'

// Complete genuine HTTP corpus. Mutations are explicitly artificial offline
// negative controls; they are never current native feeds or closing evidence.
globalThis.fetch = async () => { throw Error('Offline test prohibits HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
for (const row of fixture.responses) {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(body.length, row.bytes)
  assert.equal(createHash('sha256').update(body).digest('hex'), row.sha256)
}
const resourceURL = value => { const u = new URL(value);u.hash = '';return u.href }
const execute = async ({ signal, onAudit, mutate = page => page, deliberatelyMissingIDs = [] } = {}) => {
  const queues = new Map(), requests = [], unexpected = [], audits = []
  for (const row of fixture.responses) {
    const key = resourceURL(row.url)
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  const get = async url => {
    requests.push(url)
    const row = queues.get(resourceURL(url))?.shift()
    if (!row) {
      if (!deliberatelyMissingIDs.some(id => new URL(url).pathname.endsWith('-' + id))) unexpected.push(url)
      throw Error('No genuine retained response for ' + url)
    }
    const original = Buffer.from(row.bodyBase64, 'base64').toString('utf8')
    const page = await mutate({ html: original, status: row.status, url: row.finalURL,
      headers: structuredClone(row.responseHeaders), bodyBase64: row.bodyBase64, purpose: row.purpose })
    if (page.html !== original) page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const jobs = await createCloudMoyoScraper().run({ signal, now: () => '2026-10-31T00:00:00.000Z',
    fetchPage: get, fetchText: async url => (await get(url)).html,
    fetchJson: async url => JSON.parse((await get(url)).html),
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(unexpected, [])
  return { jobs, audit: audits[0], requests, evidence: readInventoryEvidence(jobs) }
}

test('current corporate handoffs recover both CloudMoyo records despite the obsolete API zero', async () => {
  const { jobs, audit, evidence } = await execute()
  assert.equal(audit?.observations.length, 2)
  assert.deepEqual(new Set(audit.observations.map(job => job.jobId)), new Set(['4481007123', '4476092177']))
  assert.ok(audit.observations.every(job => job.company === 'CloudMoyo' && job.jobDescription.length > 5000))
  assert.ok(audit.observations.every(job => job.requisitionId === null && job.sourceDetailComplete === false))
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
})

test('role-owned US metadata survives corporate Pune/India text through actual consumers', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 2)
  for (const job of audit.observations) {
    assert.equal(job.country, 'United States')
    assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, 'US')
    assert.equal(isIndiaJob(job), false)
    assert.equal(isIndiaJob(normalizeScrapedJob(job, CLOUDMOYO_CATALOG)), false)
  }
})

test('original role metadata and every original response are retained without a complete-source claim', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 2)
  assert.ok(audit.observations.every(job => job.sourceNativeJobPosting.description.length === 11393))
  assert.ok(audit.observations.every(job => job.sourceNativeJobPosting.identifier.value === undefined))
  assert.ok(audit.rawPages.some(page => page.status === 302 && page.headers.location === 'https://jobs.smartrecruiters.com'))
  assert.ok(audit.rawPages.every(page => page.bodyBase64 && page.bodySHA256))
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('missing totals, coercible totals and malformed payloads are not native zero-listing evidence', () => {
  assert.equal(hasVerifiedZeroListingsSignal({ totalFound: 0, content: [] }), true)
  for (const total of [undefined, null, '', false, '0', {}, []]) {
    assert.equal(hasVerifiedZeroListingsSignal({ totalFound: total, content: [] }), false)
  }
})

test('caller abort before entry propagates without a public request', async () => {
  const controller = new AbortController(), reason = Error('Caller stopped source')
  controller.abort(reason)
  await assert.rejects(execute({ signal: controller.signal }), error => error === reason)
})

test('awaited audit failures propagate after genuine role data is retained', async () => {
  const reason = Error('Audit sink refused source')
  await assert.rejects(execute({ onAudit: audit => { assert.equal(audit.observations.length, 2);throw reason } }), error => error === reason)
})

test('one bad native H1 cannot contaminate its country or the other healthy role', async () => {
  let changed = 0
  const { audit } = await execute({ mutate: page => {
    if (new URL(page.url).pathname.endsWith('-4481007123')) {
      changed++;return { ...page, html: page.html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, '<h1>Unrelated offline role</h1>') }
    }
    return page
  } })
  assert.equal(changed, 1)
  assert.equal(audit.observations.filter(job => job.jobDescription).length, 1)
  const bad = audit.observations.find(job => job.sourceNativeRoleDetail?.bound === false)
  assert.equal(bad.country, null)
  assert.equal(bad.city, null)
  assert.deepEqual(bad.locations, [])
})

test('recommended-job URNs cannot replace the native main job marker', async () => {
  const { audit } = await execute({ mutate: page => new URL(page.url).pathname.endsWith('-4481007123')
    ? { ...page, html: page.html.replace('data-semaphore-content-urn="urn:li:jobPosting:4481007123"', 'data-semaphore-content-urn="urn:li:jobPosting:4476092177"') } : page })
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 1)
  assert.ok(audit.observations.filter(job => !job.sourceNativeRoleDetail.bound).every(job => job.country === null))
})

test('a missing native worksite country cannot inherit corporate/applicant India data', async () => {
  let changed = 0
  const { audit } = await execute({ mutate: page => {
    if (!new URL(page.url).pathname.endsWith('-4481007123')) return page
    changed++
    return { ...page, html: page.html.replace('"addressCountry":"US"', '"addressCountry":null').replace('"hiringOrganization":{',
      '"applicantLocationRequirements":{"name":"India"},"hiringOrganization":{"address":{"addressCountry":"IN"},') }
  } })
  assert.equal(changed, 1)
  const job = audit.observations.find(job => job.jobId === '4481007123')
  assert.equal(job.country, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
  assert.equal(isIndiaJob(normalizeScrapedJob(job, CLOUDMOYO_CATALOG)), false)
})

test('a decoded duplicate JSON-LD key cannot silently select its last country', async () => {
  let changed = 0
  const { audit } = await execute({ mutate: page => {
    if (!new URL(page.url).pathname.endsWith('-4481007123')) return page
    const html = page.html.replace('"addressCountry":"US"', '"addressCountry":"US","address\\u0043ountry":"IN"')
    assert.notEqual(html, page.html);changed++;return { ...page, html }
  } })
  assert.equal(changed, 1)
  assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 1)
  assert.ok(audit.observations.filter(job => !job.sourceNativeRoleDetail.bound).every(job => job.country === null))
})

test('closing-only native links remain observations even when their detail is deliberately unavailable', async () => {
  let changed = 0
  const { audit, requests } = await execute({ deliberatelyMissingIDs: ['9999999999'], mutate: page => {
    if (page.purpose !== 'declared-all-jobs-closing') return page
    const html = page.html.replaceAll('4481007123', '9999999999')
    assert.notEqual(html, page.html);changed++;return { ...page, html }
  } })
  assert.equal(changed, 1)
  assert.equal(audit.observations.length, 3)
  assert.ok(requests.some(url => new URL(url).pathname.endsWith('-9999999999')))
  const late = audit.observations.find(job => new URL(job.sourceUrl).pathname.endsWith('-9999999999'))
  assert.equal(late.country, null)
  assert.equal(late.jobDescription, null)
})
