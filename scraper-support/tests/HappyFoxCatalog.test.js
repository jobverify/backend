import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const happyFoxModulePath = path.resolve(currentDir, '../../scraper/happyfox/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/happyfox/catalog.js')
  } catch {
    assert.fail('Expected HappyFox catalog module at ../../scraper/happyfox/catalog.js')
  }
}

const loadHappyFoxModule = async () => {
  try {
    return await import('../../scraper/happyfox/script.js')
  } catch {
    assert.fail('Expected HappyFox scraper module at ../../scraper/happyfox/script.js')
  }
}

test('HappyFox local catalog captures the current Astro jobs hub and native hiring domain without aliases', async () => {
  const { HAPPYFOX_CATALOG } = await loadCatalogModule()
  const happyFox = await loadHappyFoxModule()
  const provider = hydrateProviderCatalogEntry(HAPPYFOX_CATALOG)

  assert.equal(provider.source, 'happyfox')
  assert.equal(provider.companyName, 'HappyFox')
  assert.equal(provider.officialBrandName, 'HappyFox')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.happyfox.com/jobs/')
  assert.equal(provider.officialJobsHubUrl, 'https://www.happyfox.com/jobs/')
  assert.deepEqual(provider.indiaCityPageUrls, [
    'https://www.happyfox.com/jobs/chennai/',
    'https://www.happyfox.com/jobs/bengaluru/',
    'https://www.happyfox.com/jobs/hyderabad/',
  ])
  assert.equal(provider.legacyTrakstarJobsHost, 'https://happyfox.hire.trakstar.com')
  assert.equal(provider.nativeJobsHost, 'https://hiring.happyfox.co')
  assert.equal(provider.atsPlatform, 'first-party-astro-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'regional-job-pages+verified-local-filters+closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'explicit-corporate-country-scope+native-role-identity+full-current-detail-content',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'happyfox.com')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.dryRunFile, /happyfox[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.happyfox\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /hiring\.happyfox\.co/i)
  assert.match(provider.verifiedSurfaceSummary, /original.*dates.*unknown/i)
  assert.equal(provider.modulePath, happyFoxModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HappyFox'), false)

  assert.equal(happyFox.PROVIDER_METADATA.source, HAPPYFOX_CATALOG.source)
  assert.equal(happyFox.PROVIDER_METADATA.companyName, HAPPYFOX_CATALOG.companyName)
  assert.equal(happyFox.PROVIDER_METADATA.nativeJobsHost, HAPPYFOX_CATALOG.nativeJobsHost)
})

test('HappyFox backlog row matches directly from the local catalog without alias churn', async () => {
  const { HAPPYFOX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'HappyFox\n',
    catalog: [hydrateProviderCatalogEntry(HAPPYFOX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HappyFox', 'happyfox', 'HappyFox']],
  )
})

test('getScraperCatalog includes HappyFox as a current first-party Astro careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'happyfox')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HappyFox')
  assert.equal(provider.companyCareerPage, 'https://www.happyfox.com/jobs/')
  assert.equal(provider.companyDomain, 'happyfox.com')
  assert.equal(provider.atsPlatform, 'first-party-astro-careers')
  assert.match(provider.modulePath, /happyfox[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HappyFox scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'happyfox')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'happyfox')
  assert.equal(scraper.provider.atsPlatform, 'first-party-astro-careers')
  assert.match(scraper.dryRunFile, /happyfox[\\/]jobs\.json$/i)
})
