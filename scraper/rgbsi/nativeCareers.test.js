import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createRgbsiScraper } from './script.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { RGBSI_CATALOG } from './catalog.js'
import { generateFingerprint } from '../../scraper-support/utils/applicationIdentity.js'

globalThis.fetch = async () => { throw Error('Offline test prohibits HTTP') }
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
for (const row of fixture.responses) {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(body.length, row.bytes)
  assert.equal(createHash('sha256').update(body).digest('hex'), row.sha256)
}
const resourceURL = value => { const u = new URL(value);u.hash = '';return u.href }
const execute = async ({ signal, onAudit, mutate = page => page } = {}) => {
  const queues = new Map(), requests = [], unexpected = [], audits = []
  // Repeated primary-board anchors in the discovery corpus are real archived
  // requests, not replacement closing evidence. Select the distinct opening
  // and closing observations for the source run.
  const rows = fixture.responses.filter(row => row.purpose !== 'declared-native-board')
  for (const row of rows) {
    const key = resourceURL(row.url)
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  const get = async url => {
    requests.push(url)
    const row = queues.get(resourceURL(url))?.shift()
    if (!row) { unexpected.push(url);throw Error('No genuine retained response for ' + url) }
    const bytes = Buffer.from(row.bodyBase64, 'base64'), text = bytes.toString('utf8')
    const original = Buffer.from(text).equals(bytes) ? text : null
    const page = await mutate({ html: original, status: row.status, url: row.finalURL,
      headers: structuredClone(row.responseHeaders), bodyBase64: row.bodyBase64, purpose: row.purpose })
    // Modified bytes below are artificial offline controls, never live data.
    if (page.html !== original && typeof page.html === 'string') page.bodyBase64 = Buffer.from(page.html).toString('base64')
    return page
  }
  const jobs = await createRgbsiScraper().run({ signal, now: () => '2026-10-31T00:00:00.000Z',
    fetchPage: get, fetchText: async url => (await get(url)).html,
    fetchJson: async url => JSON.parse((await get(url)).html),
    onAudit: async audit => { audits.push(audit);await onAudit?.(audit) } })
  assert.deepEqual(unexpected, [])
  return { jobs, audit: audits[0], requests, evidence: readInventoryEvidence(jobs) }
}

test('all two-hundred current RSS records and five legacy records retain their full native criteria', async () => {
  const { jobs, audit, evidence } = await execute()
  assert.equal(audit?.observations.length, 205)
  const current = audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva')
  assert.equal(current.length, 200)
  assert.equal(new Set(current.map(job => job.jobId)).size, 200)
  assert.ok(current.every(job => job.jobDescription.length > 200 && job.sourceNativeRSSItem.description.length > 700))
  assert.equal(audit.observations.filter(job => job.sourceNativePlatform === 'smartrecruiters').length, 5)
  assert.ok(audit.observations.every(job => job.jobDescription && job.sourceDetailComplete === false))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '29396064')
  assert.equal(jobs[0].country, null)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
})

test('the explicitly advertised staffing division keeps its own Zobility label and raw literal-format caveat', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 205)
  const current = audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva')
  assert.ok(current.every(job => job.company === 'Zobility' && job.sourceParentPublisher === 'RGBSI'))
  assert.ok(current.every(job => job.sourceNativeJobPosting.hiringOrganization.name === 'Zobility'))
  assert.ok(current.every(job => job.sourceNativeModelSyntax.validJSON === false && job.sourceNativeModelSyntax.rawControlCharacters.length > 0))
  assert.ok(current.every(job => job.requisitionId === null))
})

test('native country values remain literal while one genuine title contradiction keeps normalized geography unknown', async () => {
  const { audit } = await execute()
  assert.equal(audit?.observations.length, 205)
  const current = audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva')
  assert.equal(current.filter(job => job.sourceNativeJobPosting.jobLocation.address.addressCountry === 'US').length, 193)
  assert.equal(current.filter(job => job.country === 'United States').length, 192)
  assert.equal(current.filter(job => job.country === 'Canada').length, 7)
  const conflicting = current.find(job => job.jobId === '29396064')
  assert.match(conflicting.sourceNativeRSSItem.title, /Tooling Technican/)
  assert.equal(conflicting.sourceNativeJobPosting.title, 'Tooling Technician (Off Shift)')
  assert.equal(conflicting.country, null)
  assert.deepEqual(conflicting.locations, [])
  for (const job of audit.observations) {
    assert.equal(isIndiaJob(job), false)
    assert.equal(isIndiaJob(normalizeScrapedJob(job, RGBSI_CATALOG)), false)
  }
})

test('native requested cap and changed RSS timestamp links never become authoritative source/India totals', async () => {
  const { audit, evidence } = await execute()
  assert.equal(audit?.observations.length, 205)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(audit.rawPages.filter(page => page.originalText?.startsWith('<?xml')).length >= 2)
  assert.ok(audit.rawPages.some(page => page.bodyBase64 && !page.originalText))
})

test('caller abort and audit sink failures are not swallowed as an empty source result', async () => {
  const controller = new AbortController(), abort = Error('Caller stopped RGBSI')
  controller.abort(abort)
  await assert.rejects(execute({ signal: controller.signal }), error => error === abort)
  const sink = Error('Audit sink refused RGBSI')
  await assert.rejects(execute({ onAudit: () => { throw sink } }), error => error === sink)
})

const firstRole = page => new URL(page.url).pathname === '/portal/' && new URL(page.url).searchParams.get('jobid') === '29562619'

test('a conflicting native city/state cannot promote another location into the RSS record', async () => {
  let changed = 0
  const { audit } = await execute({ mutate: page => {
    if (!firstRole(page)) return page
    const html = page.html.replace('"New Hudson"', '"Pune"').replace('"MI"', '"MH"')
    assert.notEqual(html, page.html);changed++;return { ...page, html }
  } })
  assert.equal(changed, 1)
  const job = audit.observations.find(job => job.jobId === '29562619')
  assert.equal(job.country, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
  assert.ok(job.jobDescription.length > 200)
})

test('a duplicate decoded country key rejects one literal model without erasing other criteria', async () => {
  let changed = 0
  const { audit } = await execute({ mutate: page => {
    if (!firstRole(page)) return page
    const html = page.html.replace('"addressCountry": "US"', '"addressCountry": "US", "address\\u0043ountry": "IN"')
    assert.notEqual(html, page.html);changed++;return { ...page, html }
  } })
  assert.equal(changed, 1)
  assert.equal(audit.observations.length, 205)
  const job = audit.observations.find(job => job.jobId === '29562619')
  assert.equal(job.country, null)
  assert.deepEqual(job.locations, [])
  assert.ok(job.jobDescription.length > 200)
})

test('a foreign native RSS link is retained as unqualified data and never requested or emitted', async () => {
  let changed = 0
  const { jobs, audit, requests } = await execute({ mutate: page => {
    if (page.purpose !== 'declared-public-RSS-opening' && page.purpose !== 'declared-public-RSS-closing') return page
    const html = page.html.replace(/https:\/\/www2\.jobdiva\.com\/candidates\/myjobs\/openjob_outside\.jsp(?=[^<]*id=29562619)/,
      'https://unrelated.invalid/candidates/myjobs/openjob_outside.jsp')
    assert.notEqual(html, page.html);changed++;return { ...page, html }
  } })
  assert.equal(changed, 2)
  assert.ok(requests.every(url => !url.includes('unrelated.invalid')))
  assert.ok(jobs.every(job => !String(job.applyUrl).includes('unrelated.invalid')))
  assert.ok(audit.observations.some(job => job.sourceNativeRSSItem?.link.includes('unrelated.invalid')))
})

test('a native XML declaration with external entities is not evaluated or accepted as an empty feed', async () => {
  let changed = 0
  const { audit, evidence, requests } = await execute({ mutate: page => {
    if (page.purpose !== 'declared-public-RSS-opening') return page
    changed++;return { ...page, html: page.html.replace('<rss', '<!DOCTYPE rss [<!ENTITY leak SYSTEM "https://unrelated.invalid/private">]><rss') }
  } })
  assert.equal(changed, 1)
  assert.equal(audit.observations.length, 5)
  assert.equal(evidence.listingComplete, false)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.ok(requests.every(url => !url.includes('unrelated.invalid')))
})

test('lost first-party division evidence cannot turn Zobility into an assumed RGBSI employer', async () => {
  const { jobs, audit } = await execute({ mutate: page => new URL(page.url).hostname === 'rgbsi.com' && new URL(page.url).pathname === '/careers/'
    ? { ...page, html: page.html.replace('Zobility is now RGBSI', 'Unverified brand is now RGBSI') } : page })
  assert.equal(audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva').length, 200)
  assert.ok(audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva').every(job => job.company === 'Zobility' && job.sourceCompanyScopeUnresolved))
  assert.equal(jobs.length, 0)
})

test('all original RSS criteria and nonstandard literal descriptions match independent whole-corpus values', async () => {
  const { audit } = await execute()
  const current = audit.observations.filter(job => job.sourceNativePlatform === 'jobdiva').sort((a, b) => Number(a.jobId) - Number(b.jobId))
  const hash = text => createHash('sha256').update(text, 'utf8').digest('hex')
  // Independently calculated from original Expat byte ranges and byte-decoded
  // literal models. These raw-value hashes preserve CRLF; ordinary Python text
  // reads/XML semantic values normalize line endings and have different hashes.
  assert.equal(hash(current.map(job => job.jobId + '\0' + job.sourceNativeRSSItem.description + '\n').join('')),
    '5f28254557a87c8cb2e5f9ee80ea6d4b3c5ec9c6b6d1f5018572e3484f935543')
  assert.equal(hash(current.map(job => job.jobId + '\0' + job.sourceNativeJobPosting.description + '\n').join('')),
    '3b9f219c74089445e23e1bdccbad90048d4c9e50ec893f2616579d391ae3cca7')
  assert.equal(new Set(audit.observations.map(job => generateFingerprint(normalizeScrapedJob(job, RGBSI_CATALOG)))).size, 205)
  for (const job of current) {
    assert.equal(job.sourceNativeApplication.derivedFromObservedRouter, true)
    assert.equal(new URL(job.applyUrl).hash, '#/jobs/' + job.jobId)
    assert.equal(new URL(job.applyUrl).searchParams.has('t'), false)
    assert.ok(job.sourceNativeRSSItem.link.includes('&t='))
    assert.equal(job.sourceNativeApplication.activationVerified, false)
  }
})
