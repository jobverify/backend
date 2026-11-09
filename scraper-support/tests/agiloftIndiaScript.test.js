import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch = () => { throw new Error('Agiloft India tests prohibit network before imports') }
const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const agiloft = await import('../../scraper/agiloftindia/script.js')
const { futureJob, futureBoard, futureCareers, futureDetail } = await import('../../scraper/agiloftindia/fixtures/synthetic.js')

const registered = () => createCatalogScraper(getScraperCatalog().find(p => p.source === 'agiloftindia'))
const syntheticRun = async ({ opening = [futureJob()], closing = opening, maxJobs, schema = {}, transform = body => body, response, clock = () => '2026-10-27T09:00:00.000Z' } = {}) => {
  const requests = []; let jsonCalls = 0; let boards = 0; let audit
  const jobs = await registered().run({
    now: clock, maxJobs,
    onNativeAudit: value => { audit = value },
    fetchJson: async url => { requests.push(url); return structuredClone(jsonCalls++ ? closing : opening) },
    fetchPage: async url => {
      requests.push(url)
      if (response) { const override = response(url, requests); if (override) return override }
      const html = url === agiloft.CAREERS_URL ? futureCareers : url === agiloft.LEVER_BOARD_URL ? futureBoard(boards++ ? closing : opening) : transform(futureDetail(opening.find(j => j.hostedUrl === url), schema))
      return { status: 200, url, html }
    },
  })
  return { jobs, audit, requests, evidence: readInventoryEvidence(jobs) }
}

test('Agiloft India synthetic future India role is complete only after all native and closing checks', async () => {
  const { jobs, audit, evidence, requests } = await syntheticRun()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '11111111-1111-4111-8111-111111111111')
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].company, 'Agiloft')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].jobDescription, 'Build contract systems.\n\nResponsibilities\nDesign secure services.\n\nEqual opportunity employer.\n\nSynthetic visible AI recruiting notice.')
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].allowSourceCleanup, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(audit.complete, true)
  assert.equal(requests.length, 7)
})

test('Agiloft India synthetic future secondary India location is retained alongside the primary country', async () => {
  const job = futureJob({ country: 'US', categories: { location: 'United States', allLocations: ['United States', 'India'], commitment: 'Full-time', department: 'Product', team: 'Engineering' } })
  const { jobs, audit } = await syntheticRun({ opening: [job] })
  assert.equal(audit.complete, true)
  assert.deepEqual(jobs[0].workCountries, ['India', 'United States'])
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].primaryLocation, 'United States')
})

test('Agiloft India synthetic future country outside historical board locations can complete', async () => {
  const job = futureJob({ country: 'DE', categories: { location: 'Germany', allLocations: ['Germany'], commitment: 'Full-time' } })
  const { jobs, audit } = await syntheticRun({ opening: [job] })
  assert.deepEqual(jobs, [])
  assert.equal(audit.complete, true)
  assert.deepEqual(audit.rows[0].workCountries, ['Germany'])
})

test('Agiloft India synthetic output cap follows full inventory and suppresses whole-source completion', async () => {
  const second = futureJob({ id: '22222222-2222-4222-8222-222222222222' })
  const { jobs, audit, evidence, requests } = await syntheticRun({ opening: [futureJob(), second], maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(audit.fullDetailCount, 2)
  assert.equal(requests.length, 8)
  assert.equal(audit.complete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(jobs[0].allowSourceCleanup, false)
  assert.equal(jobs[0].sourceReportedTotal, null)
})

test('Agiloft India synthetic closing detail or secondary country changes withhold the changed role', async () => {
  const opening = [futureJob()]
  const closing = structuredClone(opening)
  closing[0].categories.allLocations.push('Canada')
  const { jobs, audit, evidence } = await syntheticRun({ opening, closing })
  assert.deepEqual(jobs, [])
  assert.equal(audit.complete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(audit.allowSourceCleanup, false)
})

test('Agiloft India synthetic expired and withdrawn native postings remain ineligible', async () => {
  for (const job of [futureJob({ status: 'withdrawn' }), futureJob({ validThrough: '2026-10-26' })]) {
    const { jobs, audit } = await syntheticRun({ opening: [job] })
    assert.deepEqual(jobs, [])
    assert.equal(audit.complete, true)
    assert.equal(audit.fullDetailCount, 1)
    assert.equal(audit.fullyHealthyCount, 0)
  }
  const expiredSchema = await syntheticRun({ schema: { validThrough: '2026-10-26' } })
  assert.deepEqual(expiredSchema.jobs, [])
})

test('Agiloft India synthetic role that expires during the closing check is ineligible at completion', async () => {
  let ticks = 0
  const { jobs } = await syntheticRun({ opening: [futureJob({ validThrough: '2026-10-27T09:00:30.000Z' })],
    clock: () => ticks++ ? '2026-10-27T09:01:00.000Z' : '2026-10-27T09:00:00.000Z' })
  assert.deepEqual(jobs, [])
})

test('Agiloft India synthetic unresolved secondary geography prevents completion and India eligibility', async () => {
  const job = futureJob()
  job.categories.allLocations.push('Unspecified global offices')
  const { jobs, audit, evidence } = await syntheticRun({ opening: [job] })
  assert.deepEqual(jobs, [])
  assert.equal(audit.complete, false)
  assert.equal(evidence.reportedTotal, null)
})

test('Agiloft India synthetic generic posting identifier is not fabricated into a requisition', async () => {
  const { jobs } = await syntheticRun({ schema: { identifier: { name: 'Posting ID', value: 'native-posting-only' } } })
  assert.equal(jobs[0].requisitionId, null)
})

test('Agiloft India synthetic hidden and inert descriptions do not become visible job content', async () => {
  const { jobs } = await syntheticRun({ transform: html => html.replace('Build contract systems.', 'Build contract systems.<span hidden>Hidden bait</span><template>Template bait</template>') })
  assert.equal(jobs.length, 1)
  assert.doesNotMatch(jobs[0].jobDescription, /bait/)
})

test('Agiloft India synthetic encoded text remains text after exactly one entity decode', async () => {
  const job = futureJob({ description: '<p>Use &lt;script&gt; as literal text &amp; keep &#x1F4DD;.</p>' })
  const { jobs } = await syntheticRun({ opening: [job] })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /Use <script> as literal text & keep 📝\./)
})

test('Agiloft India immediately stops on the first denied public response at any stage', async () => {
  for (const status of [401, 403, 429]) for (const at of [1, 2, 3, 4, 5, 6, 7]) {
    let calls = 0
    const opening = [futureJob()]
    await assert.rejects(registered().run({
      fetchPage: async url => {
        calls++
        if (calls === at) return { status, url, html: 'Denied' }
        return { status: 200, url, html: url === agiloft.CAREERS_URL ? futureCareers : url === agiloft.LEVER_BOARD_URL ? futureBoard(opening) : futureDetail(opening[0]) }
      },
      fetchJson: async () => { calls++; if (calls === at) throw Object.assign(new Error(`HTTP ${status}`), { status }); return opening },
    }), /access denied|HTTP (401|403|429)/i)
    assert.equal(calls, at)
  }
})

test('Agiloft India synthetic primary native country code is sufficient without inferring a city country', async () => {
  const job = futureJob({ categories: { location: 'Bengaluru', allLocations: ['Bengaluru'], commitment: 'Full-time' } })
  const { jobs, audit } = await syntheticRun({ opening: [job] })
  assert.equal(audit.complete, true)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, null)
})

test('Agiloft India synthetic closing corporate redirect prevents complete first-party proof', async () => {
  let corporateCalls = 0
  const { audit, evidence } = await syntheticRun({ response: url => url === agiloft.CAREERS_URL && ++corporateCalls === 2 ? { status: 200, url: 'https://unrelated.invalid/careers', html: futureCareers } : null })
  assert.equal(audit.complete, false)
  assert.equal(evidence.reportedTotal, null)
})

test('Agiloft India stops at a bot gate in an HTTP 200 native detail', async () => {
  let calls = 0
  await assert.rejects(registered().run({
    fetchPage: async url => { calls++; return { status: 200, url, html: url === agiloft.CAREERS_URL ? futureCareers : url === agiloft.LEVER_BOARD_URL ? futureBoard([futureJob()]) : '<h1>Access Denied</h1>' } },
    fetchJson: async () => { calls++; return [futureJob()] },
  }), /access denied/i)
  assert.equal(calls, 4)
})

test('Agiloft India immediately stops on an explicit bot gate in a successful HTTP response', async () => {
  let calls = 0
  await assert.rejects(registered().run({ fetchPage: async url => { calls++; return { status: 200, url, html: '<title>Just a moment</title><p>Verify you are human</p>' } } }), /access denied/i)
  assert.equal(calls, 1)
})
