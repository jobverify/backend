import assert from 'node:assert/strict'
import test from 'node:test'
import { careers, description, fixture, transport } from './native.fixtures.js'

globalThis.fetch = async () => { throw new Error('NETWORK_TRIPWIRE: inject the registered transport') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const { readSourceObservationEvidence } = await import('../../scraper-support/utils/sourceObservationEvidence.js')
const { visibleText } = await import('./nativeHtml.js')
const run = options => createCatalogScraper(getScraperCatalog().find(p => p.source === 'delinea')).run({ now: () => '2026-10-27T09:00:00.000Z', ...options })

test('Delinea retains native observed counts when an advertised migration channel remains unresolved', async () => {
  const rows = [fixture({country:'United States',location:'Remote (United States)'})]
  const injected = transport(rows)
  const jobs = await run({...injected,fetchText:async url=>url==='https://delinea.com/careers'?careers+'<a href="https://other.example/jobs">Apply Today</a>':injected.fetchText(url)})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readSourceObservationEvidence(jobs,'delinea')?.observedVacancyCount,1)
})

// Synthetic counterpart of the published UK dual-worksite shape.
const ukDualWorksite = () => {
  const record = fixture({ id: 'synthetic-uk-dual', country: 'United Kingdom', location: 'Home Office (United Kingdom)' })
  const primary = { addressLocality: 'Bracknell', addressRegion: 'Berkshire', addressCountry: 'United Kingdom' }
  const secondary = { addressLocality: 'Belfast', addressCountry: 'United Kingdom' }
  record.feed.address = { postalAddress: primary }
  record.feed.secondaryLocations = [{ location: 'Home Office (Belfast)', address: { postalAddress: secondary } }]
  record.brief.secondaryLocations = [{ locationName: 'Home Office (Belfast)' }]
  record.posting.secondaryLocationNames = ['Home Office (Belfast)']
  record.schema.jobLocation = [{ address: primary }, { address: secondary }]
  return record
}

test('synthetic UK dual-worksite schema accepts every published address matching the native feed', async () => {
  let audit
  const jobs = await run({ ...transport([ukDualWorksite()]), onNativeAudit: value => { audit = value } })
  assert.equal(audit.fullyHealthyCount, 1)
  assert.equal(audit.rows[0].nativeLocations.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('synthetic UK dual-worksite schema may omit a native secondary address', async () => {
  const record = ukDualWorksite()
  record.schema.jobLocation = [record.schema.jobLocation[0]]
  let audit
  const jobs = await run({ ...transport([record]), onNativeAudit: value => { audit = value } })
  assert.equal(audit.fullyHealthyCount, 1)
  assert.equal(audit.rows[0].nativeLocations[1].addressLocality, 'Belfast')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('synthetic contradictory published secondary locality rejects that detail and retains healthy India rows', async () => {
  const record = ukDualWorksite()
  record.schema.jobLocation[1] = { address: { addressLocality: 'Contradictory Secondary Locality', addressCountry: 'United Kingdom' } }
  let audit
  const jobs = await run({ ...transport([record, fixture()]), onNativeAudit: value => { audit = value } })
  assert.equal(audit.fullyHealthyCount, 1)
  assert.deepEqual(audit.rows.map(row => row.jobId), ['synthetic-india'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'synthetic-india')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('synthetic native text keeps inline punctuation, decodes once and omits hidden criteria', () => {
  assert.equal(visibleText('<p><strong>Identity</strong>-<em>safe</em> text<a href="https://example.com">here</a>, &amp;lt;literal&amp;gt;.</p><p hidden>ignore</p><!-- ignore -->'), 'Identity-safe texthere, &lt;literal&gt;.')
})

test('synthetic positive: registered extraction keeps native description, employer, posting ID, dates and criteria', async () => {
  const io = transport()
  const jobs = await run(io)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.company, 'Delinea')
  assert.equal(job.jobId, 'synthetic-india')
  assert.equal(job.requisitionId, null)
  assert.equal(job.postingDate, '2026-10-20T12:34:56.789+00:00')
  assert.equal(job.closingDate, '2026-11-30T23:59:00.000Z')
  assert.equal(job.country, 'India')
  assert.equal(job.descriptionHtml, description)
  assert.equal(job.jobDescription, 'Requirements 5+ years building identity systems. Use C++ & preserve &lt;literal&gt; text. Preferred qualifications A relevant degree. Published compensation policy.')
  assert.match(job.minimumQualification, /5\+ years/)
  assert.match(job.preferredQualification, /A relevant degree/)
  assert.equal(job.nativeFields.compensationPhilosophyHtml, '<p>Published compensation policy.</p>')
  assert.equal(job.sourceListingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(io.calls.filter(x => x === 'https://jobs.ashbyhq.com/delinea').length, 2)
})

test('synthetic zero India requires complete foreign details and reconciled closing inventory', async () => {
  const jobs = await run(transport([fixture({ id: 'synthetic-foreign', country: 'United States', location: 'U.S. Remote' })]))
  assert.equal(jobs.length, 0)
  assert.deepEqual(readInventoryEvidence(jobs), { status: 'complete-inventory', surface: 'https://jobs.ashbyhq.com/delinea', firstParty: true, listingComplete: true, pagesFetched: 7, reportedTotal: 1, indiaFacetCount: 0, verifiedAt: '2026-10-27T09:00:00.000Z', reason: 'native-board-feed-all-details-and-closing-inventory-reconciled' })
})

test('synthetic Ashby plain-text link expansion does not replace full native visible criteria', async () => {
  const record = fixture()
  record.feed.descriptionHtml = record.posting.descriptionHtml = '<h2>Requirements</h2><p>Read <a href="https://example.com/reference">the specification</a> carefully.</p>'
  record.feed.descriptionPlain = 'Requirements Read the specification https://example.com/reference carefully.'
  const jobs = await run(transport([record]))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, 'Requirements Read the specification carefully. Published compensation policy.')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('synthetic changed inventory preserves confirmed India rows and suppresses whole-source totals', async () => {
  const jobs = await run(transport([fixture()], { closingRecords: [] }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('synthetic foreign/unknown country, changed description and wrong employer cannot count as healthy', async () => {
  for (const mutateDetail of [r => { r.schema.hiringOrganization.name = 'Other'; return r }, r => { r.schema.jobLocation.address.addressCountry = 'United States'; return r }, r => { r.posting.descriptionHtml = '<p>Truncated</p>'; return r }]) {
    const jobs = await run(transport([fixture()], { mutateDetail }))
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
  const unknown = fixture({ country: '', location: 'Remote' })
  assert.equal(readInventoryEvidence(await run(transport([unknown]))).listingComplete, false)
})

test('synthetic matching APAC country fields cannot certify known foreign geography or India absence', async () => {
  let audit
  const jobs = await run({ ...transport([fixture({ country: 'APAC', location: 'APAC Remote' })]), onNativeAudit: a => { audit = a } })
  assert.equal(audit.fullyHealthyCount, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('synthetic additional hiring handoff prevents a complete-inventory claim', async () => {
  const jobs = await run(transport([fixture()], { closingCareers: careers + '<a href="https://example.com/jobs">Apply Today (FR)</a>' }))
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('synthetic localized careers channels are checked again on closing', async () => {
  const io = transport(); let localeReads = 0
  const fetchText = async url => {
    if (url === 'https://delinea.com/fr/careers') return ++localeReads === 1 ? careers : '<a href="https://example.com/jobs">Apply Today</a>'
    const body = await io.fetchText(url)
    return url === 'https://delinea.com/careers' ? body + '<a href="https://delinea.com/fr/careers">Français</a>' : body
  }
  const jobs = await run({ ...io, fetchText })
  assert.equal(jobs.length, 1)
  assert.equal(localeReads, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('synthetic translated Workday handoff is retained as an unresolved current hiring channel', async () => {
  const io = transport(); const workday = 'https://centrify.wd1.myworkdayjobs.com/en-US/External/'; let checks = 0; let audit
  const fetchText = async url => {
    if (url === workday) { checks++; return JSON.stringify({ widget: 'redirect', url: '/en-US/External/', externalSpa: true }) }
    if (url === 'https://delinea.com/fr/careers') return `<a href="${workday}">CONSULTER LES POSTES VACANTS</a>`
    const body = await io.fetchText(url)
    return url === 'https://delinea.com/careers' ? body + '<a href="https://delinea.com/fr/careers">Français</a>' : body
  }
  const jobs = await run({ ...io, fetchText, onNativeAudit: a => { audit = a } })
  assert.equal(jobs.length, 1)
  assert.equal(checks, 2)
  assert.deepEqual(audit.advertisedChannels, ['https://centrify.wd1.myworkdayjobs.com/en-US/External/', 'https://jobs.ashbyhq.com/delinea'])
  assert.equal(audit.additionalChannelChecks[0].outcome, 'self-redirect-without-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('synthetic output cap never limits native enumeration or reports complete cleanup evidence', async () => {
  const io = transport([fixture(), fixture({ id: 'synthetic-second' })])
  const jobs = await run({ ...io, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.ok(io.calls.includes('https://jobs.ashbyhq.com/delinea/synthetic-second'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('synthetic denial stops immediately with no closing requests', async () => {
  const denial = Object.assign(new Error('HTTP 429'), { status: 429 })
  const io = transport([fixture(), fixture({ id: 'synthetic-second' })], { failDetail: denial })
  await assert.rejects(run(io), /429/)
  assert.equal(io.calls.at(-1), 'https://jobs.ashbyhq.com/delinea/synthetic-india')
})
