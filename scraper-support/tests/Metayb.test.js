import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/metayb/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Metayb | AI-Native Digital Consultancy for Enterprise Transformation</title>
  </head>
  <body>
    <main>
      <section>
        <h2>Careers</h2>
        <h3>Advance your career as we evolve</h3>
        <p>Come join us on our mission to help organizations transform seamlessly.</p>
        <button>Explore Open Positions</button>
      </section>
      <section>
        <h3>Best-in-class benefits</h3>
        <p>Learning & Development</p>
        <p>Competitive Salary & Bonuses</p>
        <p>Employee Engagement</p>
      </section>
    </main>
  </body>
</html>
`

const driftedHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <section>
        <h2>Careers</h2>
        <h3>Advance your career as we evolve</h3>
        <a href="https://jobs.ashbyhq.com/metayb">Apply Now</a>
      </section>
    </main>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/metayb/catalog.js')
  } catch {
    assert.fail('Expected Metayb catalog module at ../../scraper/metayb/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/metayb/script.js')
  } catch {
    assert.fail('Expected Metayb scraper module at ../../scraper/metayb/script.js')
  }
}

test('Metayb local catalog captures the verified fail-closed careers-copy surface', async () => {
  const { METAYB_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(METAYB_CATALOG)

  assert.equal(defaultCatalog, METAYB_CATALOG)
  assert.equal(provider.source, 'metayb')
  assert.equal(provider.companyName, 'Metayb')
  assert.equal(provider.officialBrandName, 'Metayb')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://metayb.ai/')
  assert.equal(provider.companyCareerPage, 'https://metayb.ai/')
  assert.equal(provider.companyDomain, 'metayb.ai')
  assert.equal(provider.atsPlatform, 'official-careers-copy-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-section-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-section+no-public-job-cards-or-ats-handoff+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Advance your career as we evolve/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job cards/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Metayb\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Metayb returns [] while the verified first-party careers copy exposes no trustworthy public jobs surface', async () => {
  const metayb = await loadScriptModule()

  assert.equal(metayb.SOURCE, 'metayb')
  assert.equal(metayb.COMPANY, 'Metayb')
  assert.equal(metayb.CAREERS_URL, 'https://metayb.ai/')
  assert.equal(metayb.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(metayb.hasPublicJobsSignal(careersHtml), false)

  const jobs = await metayb.createMetaybScraper().run({
    fetchText: async (url) => {
      assert.equal(url, metayb.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Metayb fails closed when the verified no-public-jobs contract drifts', async () => {
  const metayb = await loadScriptModule()

  await assert.rejects(
    metayb.createMetaybScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified metayb careers section/i,
  )

  await assert.rejects(
    metayb.createMetaybScraper().run({
      fetchText: async () => driftedHtml,
    }),
    /public jobs surface/i,
  )
})
