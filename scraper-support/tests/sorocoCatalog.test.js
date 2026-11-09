import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

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

test('Soroco local catalog captures the visible first-party careers role-card contract', async () => {
  const { SOROCO_CATALOG } = await loadCatalogModule()
  const soroco = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SOROCO_CATALOG)

  assert.equal(provider.source, 'soroco')
  assert.equal(provider.companyName, 'Soroco')
  assert.equal(provider.companyCareerPage, 'https://soroco.com/careers/')
  assert.equal(provider.allOpeningsUrl, 'https://soroco.com/all-job-openings/')
  assert.equal(provider.embeddedGreenhouseApiUrl, 'https://boards-api.greenhouse.io/v1/boards/soroco/jobs?content=true')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /Account Based Marketing Manager/i)
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

test('Soroco scraper validates the first-party careers page and maps visible role cards into shared job fields', async () => {
  const soroco = await loadScraperModule()

  assert.equal(soroco.hasOfficialSorocoCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(soroco.extractSorocoJobs(CAREERS_HTML), [
    {
      title: 'Account Based Marketing Manager',
      company: 'Soroco',
      department: null,
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'account-based-marketing-manager-bangalore',
      requisitionId: null,
      sourceUrl: 'https://soroco.com/all-job-openings/',
      applyUrl: 'https://soroco.com/all-job-openings/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Account Based Marketing Manager - Bangalore',
      remoteStatus: null,
    },
  ])

  const jobs = await soroco.createSorocoScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => CAREERS_HTML,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'soroco')
  assert.equal(jobs[0].link, 'https://soroco.com/all-job-openings/')
})
