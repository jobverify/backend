import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry, getScraperCatalog, buildScrapers } from '../providers/index.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../runner.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/kumaransystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kumaransystems/catalog.js')
  } catch {
    assert.fail('Expected Kumaran Systems catalog module at ../../scraper/kumaransystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kumaransystems/script.js')
  } catch {
    assert.fail('Expected Kumaran Systems scraper module at ../../scraper/kumaransystems/script.js')
  }
}

test('Kumaran Systems local catalog captures the verified first-party careers page and public jobs API', async () => {
  const { KUMARAN_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const kumaran = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KUMARAN_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, KUMARAN_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'kumaransystems')
  assert.equal(provider.companyName, 'Kumaran Systems')
  assert.equal(provider.officialBrandName, 'Kumaran Systems Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://kumaran.com/')
  assert.equal(provider.companyCareerPage, 'https://kumaran.com/careers/')
  assert.equal(
    provider.jobsApiUrl,
    'https://careers.kumaran.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-public-zoho-recruit-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-api-request')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-zoho-recruit-api+india-country-filter',
  )
  assert.equal(provider.companyDomain, 'kumaran.com')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /careers\.kumaran\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Astro careers component/i)
  assert.match(provider.verifiedSurfaceSummary, /published India openings/i)
  assert.equal(kumaran.JOBS_API_URL, provider.jobsApiUrl)
})

test('Kumaran Systems exact backlog row resolves from the local catalog without aliases', async () => {
  const { KUMARAN_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Kumaran Systems\n',
    catalog: [hydrateProviderCatalogEntry(KUMARAN_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

// Local and central descriptors retain separate historical observations.
test('Kumaran local and effective catalog dates do not certify a fresh zero inventory', async () => {
  const { KUMARAN_SYSTEMS_CATALOG } = await loadCatalogModule()
  const effective = getScraperCatalog().find(item => item.source === 'kumaransystems')
  const scraper = buildScrapers().find(item => item.name === 'kumaransystems')
  assert.equal(KUMARAN_SYSTEMS_CATALOG.verifiedOn, '2026-09-13')
  assert.equal(effective.verifiedOn, '2026-07-18')
  assert.notEqual(KUMARAN_SYSTEMS_CATALOG.verifiedOn, effective.verifiedOn)
  assert.equal(effective.jobsApiUrl, 'https://careers.kumaran.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite')
  assert.equal(effective.companyCareerPage, 'https://kumaran.com/careers/')
  assert.equal(effective.modulePath, modulePath)
  assert.equal(effective.zeroResultPolicy, 'evidence-required')
  assert.equal(effective.verifiedAt ?? null, null)
  const jobs = []
  assert.equal(readInventoryEvidence(jobs), null)
  assert.equal(resolveZeroJobOutcome(scraper, jobs, jobs), 'unverified-zero')
  assert.equal(buildCoverageGapResult(scraper.name, 'unverified-zero').success, false)
  assert.deepEqual(inventoryCleanupOptions({ success: true, zeroJobEvidence: 'unverified-zero', inventoryEvidence: null }), { replaceExisting: false })
})
