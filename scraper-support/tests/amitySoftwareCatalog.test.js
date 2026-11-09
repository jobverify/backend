import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const amitySoftwareModulePath = path.resolve(currentDir, '../../scraper/amitysoftware/script.js')

const loadAmitySoftwareCatalog = async () => {
  try {
    return await import('../../scraper/amitysoftware/catalog.js')
  } catch {
    assert.fail('Expected Amity Software catalog module at ../../scraper/amitysoftware/catalog.js')
  }
}

const loadAmitySoftwareModule = async () => {
  try {
    return await import('../../scraper/amitysoftware/script.js')
  } catch {
    assert.fail('Expected Amity Software scraper module at ../../scraper/amitysoftware/script.js')
  }
}

test('Amity Software local catalog captures the verified first-party homepage, careers page, and current opening URLs', async () => {
  const { AMITY_SOFTWARE_CATALOG } = await loadAmitySoftwareCatalog()
  const amitySoftware = await loadAmitySoftwareModule()

  assert.equal(AMITY_SOFTWARE_CATALOG.source, 'amitysoftware')
  assert.equal(AMITY_SOFTWARE_CATALOG.companyName, 'Amity Software')
  assert.equal(AMITY_SOFTWARE_CATALOG.officialBrandName, 'Amity Software')
  assert.equal(AMITY_SOFTWARE_CATALOG.adapter, 'script')
  assert.equal(AMITY_SOFTWARE_CATALOG.homepageUrl, 'https://www.amitysoftware.com/')
  assert.equal(AMITY_SOFTWARE_CATALOG.companyCareerPage, 'https://www.amitysoftware.com/careers/')
  assert.equal(AMITY_SOFTWARE_CATALOG.sitemapUrl, 'https://www.amitysoftware.com/sitemap_index.xml')
  assert.deepEqual(AMITY_SOFTWARE_CATALOG.jobDetailUrls, [
    'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
    'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
    'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
    'https://www.amitysoftware.com/database-architect-financial-systems/',
    'https://www.amitysoftware.com/product-owner-banking-domain/',
    'https://www.amitysoftware.com/subject-matter-expert-insurance-domain/',
    'https://www.amitysoftware.com/senior-expert-software-developer-dot-net/',
    'https://www.amitysoftware.com/front-end-developer-angular/',
  ])
  assert.equal(AMITY_SOFTWARE_CATALOG.companyDomain, 'amitysoftware.com')
  assert.equal(AMITY_SOFTWARE_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(AMITY_SOFTWARE_CATALOG.countryFilter, 'India')
  assert.equal(
    AMITY_SOFTWARE_CATALOG.paginationStrategy,
    'single-first-party-careers-page-with-current-opening-cards',
  )
  assert.equal(
    AMITY_SOFTWARE_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+first-party-opening-cards+first-party-detail-pages-with-embedded-apply-form',
  )
  assert.equal(AMITY_SOFTWARE_CATALOG.parser, 'custom-script')
  assert.equal(AMITY_SOFTWARE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AMITY_SOFTWARE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AMITY_SOFTWARE_CATALOG.dryRunFile, 'amitysoftware/jobs.json')
  assert.match(AMITY_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.amitysoftware\.com\//i)
  assert.match(AMITY_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.amitysoftware\.com\/careers\//i)
  assert.match(
    AMITY_SOFTWARE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.amitysoftware\.com\/associate-project-manager-scrum-master-banking-domain\//i,
  )
  assert.match(
    AMITY_SOFTWARE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.amitysoftware\.com\/front-end-developer-angular\//i,
  )
  assert.equal(AMITY_SOFTWARE_CATALOG.modulePath, amitySoftwareModulePath)

  assert.equal(amitySoftware.PROVIDER_METADATA.source, AMITY_SOFTWARE_CATALOG.source)
  assert.equal(amitySoftware.PROVIDER_METADATA.companyName, AMITY_SOFTWARE_CATALOG.companyName)
  assert.deepEqual(amitySoftware.PROVIDER_METADATA.jobDetailUrls, AMITY_SOFTWARE_CATALOG.jobDetailUrls)
})

test('Amity Software backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { AMITY_SOFTWARE_CATALOG } = await loadAmitySoftwareCatalog()
  const provider = hydrateProviderCatalogEntry(AMITY_SOFTWARE_CATALOG)

  assert.equal(provider.companyName, 'Amity Software')
  assert.equal(provider.companyDomain, 'amitysoftware.com')
  assert.match(provider.modulePath, /amitysoftware[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /amitysoftware[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amity Software'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Amity Software\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amity Software', 'amitysoftware', 'Amity Software']],
  )
})

test('buildScrapers and company coverage resolve Amity Software from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amitysoftware')
  const scraper = buildScrapers().find((item) => item.name === 'amitysoftware')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amity Software')
  assert.equal(provider.companyCareerPage, 'https://www.amitysoftware.com/careers/')
  assert.match(scraper.dryRunFile, /amitysoftware[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amity Software\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amity Software', 'amitysoftware', 'Amity Software']],
  )
})
