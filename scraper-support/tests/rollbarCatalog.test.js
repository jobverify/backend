import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rollbarModulePath = path.resolve(currentDir, '../../scraper/rollbar/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rollbar/catalog.js')
  } catch {
    assert.fail('Expected Rollbar catalog module at ../../scraper/rollbar/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/rollbar/script.js')
  } catch {
    assert.fail('Expected Rollbar scraper module at ../../scraper/rollbar/script.js')
  }
}

test('Rollbar local catalog captures the verified first-party careers redirect and no-public-jobs sentinel contract', async () => {
  const { ROLLBAR_CATALOG } = await loadCatalogModule()
  const rollbar = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ROLLBAR_CATALOG)

  assert.equal(provider.source, 'rollbar')
  assert.equal(provider.companyName, 'Rollbar')
  assert.equal(provider.officialBrandName, 'Rollbar')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://rollbar.com/')
  assert.equal(provider.companyCareerPage, 'https://rollbar.com/careers')
  assert.equal(provider.aboutPageUrl, 'https://rollbar.com/about-us')
  assert.equal(provider.jobsPageUrl, 'https://rollbar.com/jobs')
  assert.equal(provider.contactPageUrl, 'https://rollbar.com/contact-us')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-footer-careers-anchor-plus-careers-and-jobs-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-footer-careers-anchor+verified-careers-route-about-page-no-public-jobs-return-empty+verified-jobs-route-homepage-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rollbar.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /rollbar[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rollbar\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rollbar\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rollbar\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rollbar\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Every production error, found and fixed\./i)
  assert.match(provider.verifiedSurfaceSummary, /Join the Rollbar Team/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, rollbarModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'rollbar'), false)

  assert.equal(rollbar.PROVIDER_METADATA.source, ROLLBAR_CATALOG.source)
  assert.equal(rollbar.PROVIDER_METADATA.companyName, ROLLBAR_CATALOG.companyName)
  assert.equal(rollbar.PROVIDER_METADATA.aboutPageUrl, ROLLBAR_CATALOG.aboutPageUrl)
})

test('Rollbar backlog row matches directly from the local catalog without alias changes', async () => {
  const { ROLLBAR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rollbar\n',
    catalog: [hydrateProviderCatalogEntry(ROLLBAR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rollbar', 'rollbar', 'Rollbar']],
  )
})

test('getScraperCatalog includes Rollbar as a verified no-public-jobs sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rollbar')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rollbar')
  assert.equal(provider.companyCareerPage, 'https://rollbar.com/careers')
  assert.equal(provider.companyDomain, 'rollbar.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /rollbar[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Rollbar scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rollbar')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rollbar')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /rollbar[\\/]jobs\.json$/i)
})
