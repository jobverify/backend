import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deepintent/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deepintent/catalog.js')
  } catch {
    assert.fail('Expected DeepIntent catalog module at ../../scraper/deepintent/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/deepintent/script.js')
  } catch {
    assert.fail('Expected DeepIntent scraper module at ../../scraper/deepintent/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('DeepIntent local catalog captures the verified first-party careers page and no-public-jobs sentinel contract', async () => {
  const { DEEP_INTENT_CATALOG } = await loadCatalogModule()
  const deepIntent = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DEEP_INTENT_CATALOG)

  assert.equal(provider.source, 'deepintent')
  assert.equal(provider.companyName, 'DeepIntent')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://deepintent.com/')
  assert.equal(provider.companyCareerPage, 'https://deepintent.com/careers')
  assert.equal(provider.companyDomain, 'deepintent.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-careers-link-plus-first-party-open-positions-shell-without-public-job-links',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-open-positions-shell-without-public-job-links-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /deepintent[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/deepintent\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/deepintent\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DeepIntent'), false)

  assert.equal(deepIntent.PROVIDER_METADATA.source, provider.source)
  assert.equal(deepIntent.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(deepIntent.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('DeepIntent backlog row matches directly from local provider metadata without alias churn', async () => {
  const { DEEP_INTENT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DeepIntent\n',
    catalog: [buildCatalogReadyProvider(DEEP_INTENT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DeepIntent', 'deepintent', 'DeepIntent']],
  )
})

test('buildScrapers and company coverage resolve DeepIntent from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deepintent')
  const scraper = buildScrapers().find((item) => item.name === 'deepintent')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'DeepIntent')
  assert.equal(provider.companyCareerPage, 'https://deepintent.com/careers')
  assert.match(scraper.dryRunFile, /deepintent[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'DeepIntent\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DeepIntent', 'deepintent', 'DeepIntent']],
  )
})
