import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { createCatalogScraper, hydrateProviderCatalogEntry } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Grow with Soroco</title>
  </head>
  <body>
    <a href="/all-job-openings/">View Career Opportunities</a>
    <div id="job-title">
      <span class="elementor-heading-title">Account Based Marketing Manager</span>
      <span class="elementor-heading-title">Bangalore</span>
      <a href="#" target="_blank">Apply</a>
    </div>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/soroco/catalog.js')
  } catch {
    assert.fail('Expected Soroco catalog module at ../../scraper/soroco/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/soroco/script.js')
  } catch {
    assert.fail('Expected Soroco scraper module at ../../scraper/soroco/script.js')
  }
}

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/soroco/test-data/current-native-20261114.json.gz', import.meta.url))))
const transport = (change = () => {}) => {
  const calls = []
  return { calls, fetchImpl: async (url, init = {}) => {
    const row = structuredClone(fixture.captures.find(packet => packet.requestUrl === url))
    assert.ok(row, 'Unexpected original public request ' + url)
    change(row)
    calls.push({ url, method: init.method || 'GET' })
    const response = new Response(Buffer.from(row.bodyBase64, 'base64'), { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.finalUrl })
    return response
  } }
}
const registered = async () => createCatalogScraper(hydrateProviderCatalogEntry((await loadCatalogModule()).SOROCO_CATALOG))

test('Soroco local catalog identifies its current declared own native full-role contract', async () => {
  const { SOROCO_CATALOG } = await loadCatalogModule()
  const soroco = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SOROCO_CATALOG)

  assert.equal(provider.source, 'soroco')
  assert.equal(provider.companyName, 'Soroco')
  assert.equal(provider.companyCareerPage, 'https://soroco.com/careers/')
  assert.equal(provider.allOpeningsUrl, 'https://soroco.com/all-job-openings/')
  assert.equal(provider.embeddedGreenhouseApiUrl, 'https://boards-api.greenhouse.io/v1/boards/soroco/jobs?content=true')
  assert.equal(provider.verifiedPublicJobCount, 2)
  assert.equal(provider.verifiedIndiaJobCount, 2)
  assert.match(provider.verifiedSurfaceSummary, /complete original rich criteria/i)
  assert.match(provider.verifiedSurfaceSummary, /August Date_Opened values are retained/i)
  assert.match(provider.verifiedSurfaceSummary, /cleanup held/i)
  assert.equal(soroco.PROVIDER_METADATA.source, provider.source)
})

test('Soroco exact backlog row resolves from the local catalog object', async () => {
  const { SOROCO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Soroco\n',
    catalog: [hydrateProviderCatalogEntry(SOROCO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('registered Soroco maps only complete own native India criteria with original dates and cleanup holds', async () => {
  const wire = transport(), jobs = await (await registered()).run({ fetchImpl: wire.fetchImpl, now: () => fixture.capturedAt })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'soroco')
  assert.equal(jobs[0].title, 'General Counsel')
  assert.equal(jobs[0].company, 'Soroco')
  assert.equal(jobs[0].city, 'Bangalore South')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, '836634000001765193')
  assert.equal(jobs[0].link, 'https://soroco.zohorecruit.com/jobs/Careers/836634000001765193/General-Counsel?source=CareerSite')
  assert.equal(jobs[0].sourceDescription, jobs[0].sourceNativeDetailRecord.Job_Description)
  assert.ok(jobs[0].sourceDescription.length > 10000)
  assert.equal(jobs[0].sourceNativeDetailRecord.Zip_Code, '560078')
  assert.deepEqual(jobs.map(job => job.postingDate), ['2026-08-17', '2026-08-26'])
  assert.ok(jobs.every(job => job.sourceClosingReconciled && job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false && job.activationVerified === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(wire.calls.length, 24)
  assert.ok(wire.calls.every(call => call.method === 'GET'))
})

test('Soroco legacy city-only brief remains a discovery record and body-only input rejects before I/O', async () => {
  const soroco = await loadScraperModule(), legacy = soroco.extractSorocoJobs(CAREERS_HTML)
  assert.equal(legacy.length, 1)
  assert.equal(legacy[0].title, 'Account Based Marketing Manager')
  assert.equal(legacy[0].city, 'Bangalore')
  assert.equal(legacy[0].country, null)
  assert.equal(legacy[0].jobDescription, null)
  assert.equal(legacy[0].sourceDetailComplete, false)
  let calls = 0
  await assert.rejects((await registered()).run({ fetchText: async () => { calls++; return CAREERS_HTML } }), /Original HTTP metadata is required/)
  assert.equal(calls, 0)
})

test('registered Soroco retains exact current first-party authority before reading native roles', async () => {
  const wire = transport(row => {
    if (row.requestUrl === 'https://soroco.com/careers') row.bodyBase64 = Buffer.concat([Buffer.from(row.bodyBase64, 'base64'), Buffer.from('<p>Changed publisher</p>')]).toString('base64')
  })
  await assert.rejects((await registered()).run({ fetchImpl: wire.fetchImpl }), /corporate document original entity changed/)
  assert.equal(wire.calls.length, 2)
  assert.ok(wire.calls.every(call => new URL(call.url).hostname === 'soroco.com'))
})

test('registered Soroco cannot replace a missing literal native country with Bangalore', async () => {
  const wire = transport(row => {
    if (row.requestUrl.includes('/Job_Openings?')) {
      const payload = JSON.parse(Buffer.from(row.bodyBase64, 'base64'))
      delete payload.data[0].Country
      row.bodyBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
    }
  })
  await assert.rejects((await registered()).run({ fetchImpl: wire.fetchImpl }), /Native listing role schema changed/)
  assert.ok(wire.calls.every(call => !call.url.includes('/jobs/Careers/')))
})
