import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const byjusModulePath = path.resolve(currentDir, '../../scraper/byjus/script.js')

const loadByjusCatalog = async () => {
  try {
    return await import('../../scraper/byjus/catalog.js')
  } catch {
    assert.fail("Expected BYJU'S catalog module at ../../scraper/byjus/catalog.js")
  }
}

const loadByjusModule = async () => {
  try {
    return await import('../../scraper/byjus/script.js')
  } catch {
    assert.fail("Expected BYJU'S scraper module at ../../scraper/byjus/script.js")
  }
}

test("BYJU'S local catalog captures the verified first-party careers landing page and the broken public jobs routes", async () => {
  const { BYJUS_CATALOG } = await loadByjusCatalog()
  const byjus = await loadByjusModule()

  assert.equal(BYJUS_CATALOG.source, 'byjus')
  assert.equal(BYJUS_CATALOG.companyName, "BYJU'S")
  assert.equal(BYJUS_CATALOG.officialBrandName, "BYJU'S")
  assert.equal(BYJUS_CATALOG.adapter, 'script')
  assert.equal(BYJUS_CATALOG.homepageUrl, 'https://byjus.com/')
  assert.equal(BYJUS_CATALOG.companyCareerPage, 'https://byjus.com/careers-at-byjus/')
  assert.equal(BYJUS_CATALOG.careerPageUrl, 'https://byjus.com/careers-at-byjus/')
  assert.equal(BYJUS_CATALOG.salesCategoryRouteUrl, 'https://byjus.com/careers/all-openings/job-category/sales/')
  assert.equal(BYJUS_CATALOG.salesApplyUrl, 'https://byjus.com/sales-apply/')
  assert.equal(BYJUS_CATALOG.misdirectedTechRouteUrl, 'https://byjus.com/careers/all-openings/job-category/tech/')
  assert.equal(BYJUS_CATALOG.misdirectedTechFinalUrl, 'https://byjus.com/chemistry/technetium/')
  assert.equal(BYJUS_CATALOG.sitemapUrl, 'https://byjus.com/sitemap.xml')
  assert.deepEqual(BYJUS_CATALOG.checkedMissingRouteUrls, [
    'https://byjus.com/jobs/',
    'https://byjus.com/careers/all-openings/',
    'https://byjus.com/careers/all-openings/job-category/academics/',
  ])
  assert.equal(BYJUS_CATALOG.companyDomain, 'byjus.com')
  assert.equal(BYJUS_CATALOG.atsPlatform, 'official-company-careers-broken-routes')
  assert.equal(BYJUS_CATALOG.countryFilter, 'India')
  assert.equal(
    BYJUS_CATALOG.paginationStrategy,
    'current-declared-category-and-public-intake-routes+closing-careers-links',
  )
  assert.equal(
    BYJUS_CATALOG.extractionStrategy,
    'current-careers-identity+declared-route-status+raw-public-role-campaign-criteria;unknown-vacancy-inventory',
  )
  assert.equal(BYJUS_CATALOG.parser, 'custom-script')
  assert.equal(BYJUS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(BYJUS_CATALOG.verifiedOn, null)
  assert.equal(BYJUS_CATALOG.dryRunFile, 'byjus/jobs.json')
  assert.match(BYJUS_CATALOG.verifiedSurfaceSummary, /13 category routes/i)
  assert.match(BYJUS_CATALOG.verifiedSurfaceSummary, /unknown|unresolved/i)
  assert.doesNotMatch(BYJUS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(BYJUS_CATALOG.modulePath, byjusModulePath)

  assert.equal(byjus.PROVIDER_METADATA.source, BYJUS_CATALOG.source)
  assert.equal(byjus.PROVIDER_METADATA.companyName, BYJUS_CATALOG.companyName)
  assert.equal(byjus.PROVIDER_METADATA.careerPageUrl, BYJUS_CATALOG.careerPageUrl)
  assert.equal(byjus.PROVIDER_METADATA.salesApplyUrl, BYJUS_CATALOG.salesApplyUrl)
})

test("BYJU'S backlog row hydrates locally without requiring a shared alias entry", async () => {
  const { BYJUS_CATALOG } = await loadByjusCatalog()
  const provider = hydrateProviderCatalogEntry(BYJUS_CATALOG)

  assert.equal(provider.companyName, "BYJU'S")
  assert.equal(provider.companyDomain, 'byjus.com')
  assert.match(provider.modulePath, /byjus[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /byjus[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, "BYJU'S"), false)

  const report = generateCompanyCoverageReport({
    csvText: "BYJU'S\n",
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [["BYJU'S", 'byjus', "BYJU'S"]],
  )
})
