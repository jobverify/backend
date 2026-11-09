import assert from 'node:assert/strict'
import test from 'node:test'
import { parseExpressionAt } from 'acorn'
import { fixture, replay, editHTML, editJSON } from './fixtureReplay.js'
import { createCatalogScraper, getScraperCatalog } from '../../providers/index.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { primaryModel } from './nativeData.js'

globalThis.fetch = async () => { throw Error('Offline original-entity tests prohibit network or website execution') }
const provider = getScraperCatalog().find(row => row.source === 'clumio')
const run = (r, options = {}) => createCatalogScraper(provider).run({ ...r.options, ...options })
const primary = 'https://www.commvault.com/careers/jobs', api = 'https://boards-api.greenhouse.io/v1/boards/commvault'

test('registered Clumio traverses all 61 corporate and native posts before deriving its nine Global brand-related candidates', async () => {
  const r = replay(), jobs = await run(r)
  assert.equal(r.audits.length, 1)
  const audit = r.audits[0]
  assert.equal(audit.countryFilter, 'Global')
  assert.equal(audit.observations.length, 61)
  assert.equal(audit.observationHistory.length, 61)
  assert.deepEqual(audit.observations.map(job => job.jobId), fixture.records.map(row => row.id))
  assert.deepEqual(jobs.map(job => job.jobId), fixture.records.filter(row => row.brandQualified).map(row => row.id))
  assert.equal(jobs.length, 9)
  assert.equal(fixture.records.filter(row => row.excerptBrandMatch).length, 7)
  assert.ok(jobs.some(job => job.jobId === '5137752008'))
  assert.ok(jobs.some(job => job.jobId === '5371669008'))
  assert.deepEqual(r.records[0], audit.observations)
  for (const original of fixture.records) {
    const job = audit.observations.find(job => job.jobId === original.id)
    assert.equal(job.source, 'clumio');assert.equal(job.company, 'Commvault')
    assert.equal(job.title, original.title)
    assert.deepEqual(job.sourceFirstPartyListingRecord, original.inline)
    assert.deepEqual(job.sourceNativeListingRecord, original.listing)
    assert.deepEqual(job.sourceNativeRecord, original.native)
    assert.equal(job.sourceFirstPartyBodyText, original.firstPartyBody)
    assert.equal(job.sourcePostingDate, original.originalFirstPublished)
    assert.deepEqual(job.sourceNativePayInputRanges, original.originalPayInputRanges)
    for (const fact of original.criteriaFacts) assert.ok(job.jobDescription?.includes(fact), original.id + ': complete original criteria required')
    assert.equal(job.sourceBrandScopeQualified, original.brandQualified)
    assert.equal(job.sourceCurrentNativePostingIdentityQualified, true, original.id + ': ' + job.sourceNativeIssues?.join(';'))
    assert.equal(job.sourceScopeComplete, false);assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    const normalized = normalizeScrapedJob(job, provider)
    assert.equal(normalized.company, 'Commvault')
    assert.equal(normalized.sourceDescription, job.jobDescription)
    if (!job.country) assert.equal(isIndiaJob(normalized), false)
    if (original.inline.remote_position === 'No') assert.notEqual(job.sourceNativeWorkplaceTypeProvenance, 'negative-remote-means-onsite')
  }
  assert.ok(jobs.some(job => job.country === 'South Korea'))
  assert.ok(jobs.some(job => job.country === 'United States'))
  assert.equal(audit.opening.qualified, true, JSON.stringify(audit.opening.issues))
  assert.equal(audit.closing.qualified, true, JSON.stringify(audit.closing.issues))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readSourceObservationEvidence(jobs, 'clumio').observedRecordCount, 61)
  assert.ok(r.requests.every(url => !/job-boards|\/apply\b|application-form/.test(url)))
  assert.doesNotThrow(() => JSON.stringify(audit))
})

test('a cap is applied after every complete original record reaches both awaited detached observers', async () => {
  const r = replay(), events = []
  const jobs = await run(r, { maxJobs: 0, onAudit: async audit => { await Promise.resolve();events.push('audit');audit.observations[0].title = 'sink edit' },
    onRecords: async rows => { await Promise.resolve();events.push('records');assert.equal(rows.length, 61);assert.notEqual(rows[0].title, 'sink edit') } })
  assert.equal(jobs.length, 0);assert.deepEqual(events, ['audit', 'records'])
  assert.equal(new Set(r.requests).size, 126)
})

test('closing first-party detail failure retains complete earlier criteria and holds only that identity', async () => {
  const id = '5137752008', r = replay((url, page, visit) => url === primary + '/' + id && visit === 2 ? { ...page, status: 502 } : page)
  const jobs = await run(r), job = r.audits[0].observations.find(row => row.jobId === id)
  assert.equal(r.audits[0].observations.length, 61)
  assert.ok(job.jobDescription.includes(fixture.records.find(row => row.id === id).firstPartyBody))
  assert.equal(job.sourceCurrentNativePostingIdentityQualified, false)
  assert.equal(jobs.length, 8)
})

test('Global country conflicts retain the posting and raw claims with an unknown public geography', async () => {
  const id = '5137752008', r = replay((url, page) => url === primary ? editHTML(page, raw => {
    const original = fixture.records.find(row => row.id === id).inline
    const changed = JSON.stringify({ ...original, country: 'India', location: 'Bangalore, India' })
    const marker = /const\s+greenhouse_list\s*=\s*/.exec(raw), start = marker.index + marker[0].length
    const end = start + parseExpressionAt(raw.slice(start, raw.indexOf('</script>', start)), 0, { ecmaVersion: 'latest' }).end
    const rows = JSON.parse(raw.slice(start, end))
    rows[rows.findIndex(row => String(row.job_id) === id)] = JSON.parse(changed)
    return raw.slice(0, start) + JSON.stringify(rows) + raw.slice(end)
  }) : page)
  const jobs = await run(r), job = jobs.find(row => row.jobId === id)
  assert.ok(job);assert.equal(job.sourceCurrentNativePostingIdentityQualified, true)
  assert.equal(job.sourceCurrentNativeRoleQualified, false)
  assert.equal(job.sourceNativeCountryConflict, true)
  assert.equal(job.country, null);assert.equal(job.city, null);assert.equal(job.location, null);assert.deepEqual(job.locations, [])
  assert.equal(isIndiaJob(normalizeScrapedJob(job, provider)), false)
})

test('generic corporate boilerplate cannot manufacture a Clumio role match', async () => {
  const id = fixture.records.find(row => !row.brandQualified).id
  const r = replay((url, page) => url === primary + '/' + id
    ? editHTML(page, raw => raw.replace('<div class="content-conclusion">', '<div class="content-conclusion"><p>Commvault portfolio includes Clumio.</p>')) : page)
  const jobs = await run(r)
  assert.equal(jobs.some(job => job.jobId === id), false)
})

test('closing native title changes retain evidence but cannot keep a current identity', async () => {
  const id = '5137752008', r = replay((url, page, visit) => visit === 2 && url === api + '/jobs/' + id + '?pay_transparency=true'
    ? editJSON(page, value => { value.title += ' changed' }) : page)
  const jobs = await run(r)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(r.audits[0].observations.find(job => job.jobId === id).sourceCurrentNativePostingIdentityQualified, false)
})

test('parsed-only transport, invalid limits and pre-aborted work fail before any GET', async () => {
  for (const maxJobs of [-1, Infinity, 1.1, '1']) { const r = replay();await assert.rejects(run(r, { maxJobs }), /maxJobs/);assert.equal(r.requests.length, 0) }
  const r = replay()
  await assert.rejects(createCatalogScraper(provider).run({ fetchText: r.options.fetchText }), /original HTTP/)
  await assert.rejects(run(r, { signal: AbortSignal.abort(Error('cancelled')) }), /cancelled/)
  assert.equal(r.requests.length, 0)
})

test('a malformed own native ID cannot qualify through otherwise matching corporate and native fields', async () => {
  const id = '5137752008', r = replay((url, page) => url === api + '/jobs/' + id + '?pay_transparency=true'
    ? editJSON(page, value => { value.id += 1 }) : page)
  const jobs = await run(r)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(r.audits[0].observations.find(job => job.jobId === id).sourceCurrentNativePostingIdentityQualified, false)
})

test('a failed opening detail cannot qualify a paired current identity from closing alone', async () => {
  const id = '5137752008', r = replay((url, page, visit) => url === primary + '/' + id && visit === 1 ? { ...page, status: 502 } : page)
  const jobs = await run(r)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(r.audits[0].observations.find(job => job.jobId === id).sourceCurrentNativePostingIdentityQualified, false)
})

test('R1: incomplete feed total preserves individually paired Global posts without wider inventory authority', async () => {
  const r = replay((url, page) => url === api + '/jobs?content=true' ? editJSON(page, value => { value.meta.total += 1 }) : page)
  const jobs = await run(r), audit = r.audits[0]
  assert.equal(jobs.length, 9)
  assert.equal(audit.observations.length, 61)
  assert.equal(audit.opening.nativeListingComplete, false)
  assert.equal(audit.closing.qualified, false)
  assert.ok(jobs.every(job => job.sourceCurrentNativePostingIdentityQualified))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
})

test('R1: recovered closing publisher qualifies two matching own-role reads after opening metadata failure', async () => {
  const r = replay((url, page, visit) => url === api && visit === 1 ? { ...page, status: 502 } : page)
  const jobs = await run(r), audit = r.audits[0]
  assert.equal(audit.opening.publisherQualified, false)
  assert.equal(audit.closing.publisherQualified, true)
  assert.equal(jobs.length, 9)
  assert.ok(jobs.every(job => job.sourceCurrentNativePostingIdentityQualified))
  assert.equal(audit.sourceScopeComplete, false)
})

test('R1: recovered closing publisher cannot qualify a mismatching opening own-post identity', async () => {
  const id = '5137752008', r = replay((url, page, visit) => url === api && visit === 1 ? { ...page, status: 502 }
    : url === api + '/jobs/' + id + '?pay_transparency=true' && visit === 1 ? editJSON(page, value => { value.id += 1 }) : page)
  const jobs = await run(r)
  assert.equal(jobs.some(job => job.jobId === id), false)
  assert.equal(r.audits[0].observations.find(job => job.jobId === id).sourceCurrentNativePostingIdentityQualified, false)
})

for (const [kind, statement] of [['direct', 'greenhouse_list.length = 0;'], ['alias', 'const archived = greenhouse_list; archived.splice(0);']]) {
  test('R2: ' + kind + ' mutation cannot leave a stale literal initializer qualified', async () => {
    const changed = html => html.replace(/(const\s+greenhouse_list\s*=[\s\S]*?)(\n\/\/# sourceURL=greenhouseJS-js-before)/, '$1\n' + statement + '$2')
    const original = fixture.entities.find(entity => entity.receipt.url === primary)
    const html = Buffer.from(original.bodyBase64, 'base64').toString('utf8')
    assert.notEqual(changed(html), html, 'The boundary mutation must reach the actual current model script')
    assert.throws(() => primaryModel(changed(html)), /literal|statement|ownership/)
    const r = replay((url, page) => url === primary ? editHTML(page, changed) : page)
    const jobs = await run(r)
    assert.equal(jobs.length, 0)
    assert.equal(r.audits[0].observations.length, 61)
    assert.equal(r.audits[0].closing.publisherQualified, false)
    assert.ok(r.audits[0].observations.every(job => !job.sourceCurrentNativePostingIdentityQualified && job.sourceNativeRecord))
  })
}
