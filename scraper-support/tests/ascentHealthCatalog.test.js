import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ascentHealthModulePath = path.resolve(currentDir, '../../scraper/ascenthealth/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ascenthealth/catalog.js')
  } catch {
    assert.fail('Expected Ascent Health catalog module at ../../scraper/ascenthealth/catalog.js')
  }
}

const loadAscentHealthModule = async () => {
  try {
    return await import('../../scraper/ascenthealth/script.js')
  } catch {
    assert.fail('Expected Ascent Health scraper module at ../../scraper/ascenthealth/script.js')
  }
}

test('Ascent Health local catalog keeps current hiring entries separate from vacancy inventory', async () => {
  const { ASCENT_HEALTH_CATALOG } = await loadCatalogModule()
  const ascentHealth = await loadAscentHealthModule()

  assert.equal(ASCENT_HEALTH_CATALOG.source, 'ascenthealth')
  assert.equal(ASCENT_HEALTH_CATALOG.companyName, 'Ascent Health')
  assert.equal(ASCENT_HEALTH_CATALOG.officialBrandName, 'Ascent Health')
  assert.equal(ASCENT_HEALTH_CATALOG.legalEntityName, 'Ascent Health Solutions Inc.')
  assert.equal(ASCENT_HEALTH_CATALOG.adapter, 'script')
  assert.equal(ASCENT_HEALTH_CATALOG.companyCareerPage, 'https://www.ascenthealthcare.com/careers/')
  assert.equal(ASCENT_HEALTH_CATALOG.homepageUrl, 'https://www.ascenthealthcare.com/')
  assert.equal(ASCENT_HEALTH_CATALOG.careersPageUrl, 'https://www.ascenthealthcare.com/careers/')
  assert.equal(ASCENT_HEALTH_CATALOG.sitemapIndexUrl, 'https://www.ascenthealthcare.com/sitemap_index.xml')
  assert.equal(ASCENT_HEALTH_CATALOG.pageSitemapUrl, 'https://www.ascenthealthcare.com/page-sitemap.xml')
  assert.deepEqual(ASCENT_HEALTH_CATALOG.sitemapCareerRouteUrls, [
    'https://www.ascenthealthcare.com/jobs/',
    'https://www.ascenthealthcare.com/job-openings/',
    'https://www.ascenthealthcare.com/careers/',
  ])
  assert.deepEqual(ASCENT_HEALTH_CATALOG.careerAliasRouteUrls, [
    'https://www.ascenthealthcare.com/jobs/',
    'https://www.ascenthealthcare.com/job-openings/',
    'https://www.ascenthealthcare.com/careers/jobs/',
  ])
  assert.deepEqual(ASCENT_HEALTH_CATALOG.noPublicJobRouteUrls, [
    'https://www.ascenthealthcare.com/current-openings/',
    'https://www.ascenthealthcare.com/open-positions/',
    'https://www.ascenthealthcare.com/careers/openings/',
  ])
  assert.equal(ASCENT_HEALTH_CATALOG.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(ASCENT_HEALTH_CATALOG.countryFilter, 'India')
  assert.equal(
    ASCENT_HEALTH_CATALOG.paginationStrategy,
    'current-corporate-careers-and-closing-hiring-entry',
  )
  assert.equal(
    ASCENT_HEALTH_CATALOG.extractionStrategy,
    'current-first-party-resume-entry+closing-comparison+unknown-vacancy-inventory',
  )
  assert.equal(ASCENT_HEALTH_CATALOG.parser, 'custom-script')
  assert.equal(ASCENT_HEALTH_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ASCENT_HEALTH_CATALOG.companyDomain, 'ascenthealthcare.com')
  assert.equal(ASCENT_HEALTH_CATALOG.verifiedOn, null)
  assert.match(ASCENT_HEALTH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ascenthealthcare\.com\//i)
  assert.match(ASCENT_HEALTH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ascenthealthcare\.com\/careers\//i)
  assert.match(ASCENT_HEALTH_CATALOG.verifiedSurfaceSummary, /careers@ascent-group\.com/i)
  assert.match(ASCENT_HEALTH_CATALOG.verifiedSurfaceSummary, /unknown vacancy and India totals/i)
  assert.equal(ASCENT_HEALTH_CATALOG.modulePath, ascentHealthModulePath)

  assert.equal(ascentHealth.PROVIDER_METADATA.source, ASCENT_HEALTH_CATALOG.source)
  assert.equal(ascentHealth.PROVIDER_METADATA.companyName, ASCENT_HEALTH_CATALOG.companyName)
  assert.equal(ascentHealth.PROVIDER_METADATA.companyCareerPage, ASCENT_HEALTH_CATALOG.companyCareerPage)
  assert.equal(ascentHealth.PROVIDER_METADATA.pageSitemapUrl, ASCENT_HEALTH_CATALOG.pageSitemapUrl)
})

test('Ascent Health coverage resolves the backlog company name without requiring an alias entry', async () => {
  const { ASCENT_HEALTH_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Ascent Health\nAscent Health Solutions\n',
    catalog: [ASCENT_HEALTH_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Ascent Health', 'ascenthealth', 'Ascent Health'],
      ['Ascent Health Solutions', 'ascenthealth', 'Ascent Health'],
    ],
  )
})

test('buildScrapers and company coverage resolve Ascent Health from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ascenthealth')
  const scraper = buildScrapers().find((item) => item.name === 'ascenthealth')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Ascent Health')
  assert.equal(provider.companyCareerPage, 'https://www.ascenthealthcare.com/careers/')
  assert.match(scraper.dryRunFile, /ascenthealth[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Ascent Health\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ascent Health', 'ascenthealth', 'Ascent Health']],
  )
})
