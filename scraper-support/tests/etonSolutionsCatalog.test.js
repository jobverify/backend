import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const etonSolutionsModulePath = path.resolve(currentDir, '../../scraper/etonsolutions/script.js')

const loadEtonSolutionsCatalog = async () => {
  try {
    return await import('../../scraper/etonsolutions/catalog.js')
  } catch {
    assert.fail('Expected Eton Solutions catalog module at ../../scraper/etonsolutions/catalog.js')
  }
}

const loadEtonSolutionsModule = async () => {
  try {
    return await import('../../scraper/etonsolutions/script.js')
  } catch {
    assert.fail('Expected Eton Solutions scraper module at ../../scraper/etonsolutions/script.js')
  }
}

test('Eton Solutions local catalog captures the verified exact-name homepage and no-public-jobs contract', async () => {
  const { ETON_SOLUTIONS_CATALOG } = await loadEtonSolutionsCatalog()
  const etonSolutions = await loadEtonSolutionsModule()

  assert.equal(ETON_SOLUTIONS_CATALOG.source, 'etonsolutions')
  assert.equal(ETON_SOLUTIONS_CATALOG.companyName, 'Eton Solutions')
  assert.equal(ETON_SOLUTIONS_CATALOG.officialBrandName, 'ETON Solutions')
  assert.equal(ETON_SOLUTIONS_CATALOG.adapter, 'script')
  assert.equal(ETON_SOLUTIONS_CATALOG.homepageUrl, 'https://etonsolutions.com/')
  assert.equal(ETON_SOLUTIONS_CATALOG.companyCareerPage, 'https://etonsolutions.com/careers')
  assert.equal(ETON_SOLUTIONS_CATALOG.careerPageUrl, 'https://etonsolutions.com/careers')
  assert.equal(ETON_SOLUTIONS_CATALOG.robotsTxtUrl, 'https://etonsolutions.com/robots.txt')
  assert.equal(ETON_SOLUTIONS_CATALOG.wpSitemapUrl, 'https://etonsolutions.com/wp-sitemap.xml')
  assert.deepEqual(ETON_SOLUTIONS_CATALOG.checked404RouteUrls, [
    'https://etonsolutions.com/careers',
    'https://etonsolutions.com/career',
    'https://etonsolutions.com/jobs',
    'https://etonsolutions.com/join-us',
    'https://etonsolutions.com/work-with-us',
    'https://etonsolutions.com/openings',
  ])
  assert.equal(ETON_SOLUTIONS_CATALOG.companyDomain, 'etonsolutions.com')
  assert.equal(ETON_SOLUTIONS_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(ETON_SOLUTIONS_CATALOG.countryFilter, 'India')
  assert.equal(
    ETON_SOLUTIONS_CATALOG.paginationStrategy,
    'validated-homepage-plus-missing-robots-and-wp-sitemap-plus-common-404-careers-routes',
  )
  assert.equal(
    ETON_SOLUTIONS_CATALOG.extractionStrategy,
    'verified-homepage-without-careers-hrefs+verified-missing-robots-and-wp-sitemap+verified-common-careers-routes-return-404+return-empty',
  )
  assert.equal(ETON_SOLUTIONS_CATALOG.parser, 'custom-script')
  assert.equal(ETON_SOLUTIONS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ETON_SOLUTIONS_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ETON_SOLUTIONS_CATALOG.dryRunFile, 'etonsolutions/jobs.json')
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /https:\/\/etonsolutions\.com\/$/i)
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /https:\/\/etonsolutions\.com\/robots\.txt/i)
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /https:\/\/etonsolutions\.com\/wp-sitemap\.xml/i)
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /https:\/\/etonsolutions\.com\/careers/i)
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(ETON_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(ETON_SOLUTIONS_CATALOG.modulePath, etonSolutionsModulePath)

  assert.equal(etonSolutions.PROVIDER_METADATA.source, ETON_SOLUTIONS_CATALOG.source)
  assert.equal(etonSolutions.PROVIDER_METADATA.companyName, ETON_SOLUTIONS_CATALOG.companyName)
  assert.equal(etonSolutions.PROVIDER_METADATA.careerPageUrl, ETON_SOLUTIONS_CATALOG.careerPageUrl)
  assert.equal(etonSolutions.PROVIDER_METADATA.wpSitemapUrl, ETON_SOLUTIONS_CATALOG.wpSitemapUrl)
})

test('Eton Solutions backlog row hydrates locally without needing an alias entry', async () => {
  const { ETON_SOLUTIONS_CATALOG } = await loadEtonSolutionsCatalog()
  const provider = hydrateProviderCatalogEntry(ETON_SOLUTIONS_CATALOG)

  assert.equal(provider.companyName, 'Eton Solutions')
  assert.equal(provider.companyDomain, 'etonsolutions.com')
  assert.match(provider.modulePath, /etonsolutions[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /etonsolutions[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Eton Solutions'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Eton Solutions\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eton Solutions', 'etonsolutions', 'Eton Solutions']],
  )
})
