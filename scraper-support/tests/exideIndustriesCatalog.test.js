import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const exideIndustriesModulePath = path.resolve(currentDir, '../../scraper/exideindustries/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/exideindustries/catalog.js')
  } catch {
    assert.fail('Expected Exide Industries catalog module at ../../scraper/exideindustries/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/exideindustries/script.js')
  } catch {
    assert.fail('Expected Exide Industries scraper module at ../../scraper/exideindustries/script.js')
  }
}

test('Exide Industries local catalog captures the verified first-party no-public-jobs handoff contract', async () => {
  const { EXIDE_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const exideIndustries = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(EXIDE_INDUSTRIES_CATALOG)

  assert.equal(provider.source, 'exideindustries')
  assert.equal(provider.companyName, 'Exide Industries')
  assert.equal(provider.officialBrandName, 'Exide Industries Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.exideindustries.com/')
  assert.equal(provider.officialCareerLandingUrl, 'https://careers.exideindustries.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.exideindustries.com/current-vacancy.aspx')
  assert.equal(provider.currentVacancyUrl, 'https://careers.exideindustries.com/current-vacancy.aspx')
  assert.equal(provider.dropCvUrl, 'https://careers.exideindustries.com/drop-cv.aspx')
  assert.equal(provider.externalJobsHost, 'www.naukri.com')
  assert.equal(provider.companyDomain, 'exideindustries.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-careers-shell-plus-contradictory-current-vacancy-handoff',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-shell+verified-contradictory-current-vacancy-naukri-handoff+verified-drop-cv-form+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, exideIndustriesModulePath)
  assert.match(provider.dryRunFile, /exideindustries[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.exideindustries\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.exideindustries\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.exideindustries\.com\/current-vacancy\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.exideindustries\.com\/drop-cv\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /www\.naukri\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /We could not find you any jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(exideIndustries.PROVIDER_METADATA.source, provider.source)
  assert.equal(exideIndustries.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(exideIndustries.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Exide Industries exact backlog row matches directly from the local provider contract', async () => {
  const { EXIDE_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Exide Industries\n',
    catalog: [hydrateProviderCatalogEntry(EXIDE_INDUSTRIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Exide Industries', 'exideindustries', 'Exide Industries']],
  )
})
