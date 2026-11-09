import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const i2cIndiaModulePath = path.resolve(currentDir, '../../scraper/i2cindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/i2cindia/catalog.js')
  } catch {
    assert.fail('Expected i2c India catalog module at ../../scraper/i2cindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/i2cindia/script.js')
  } catch {
    assert.fail('Expected i2c India scraper module at ../../scraper/i2cindia/script.js')
  }
}

test('i2c India local catalog captures the verified no-India slice on the official careers portal without alias churn', async () => {
  const { I2C_INDIA_CATALOG } = await loadCatalogModule()
  const i2cIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(I2C_INDIA_CATALOG)

  assert.equal(provider.source, 'i2cindia')
  assert.equal(provider.companyName, 'i2c India')
  assert.equal(provider.officialBrandName, 'i2c')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.i2cinc.com/careers/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.i2cinc.com/who-we-are/supercharge-your-career/')
  assert.equal(provider.officialJobsListUrl, 'https://careers.i2cinc.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-careers-landing-plus-public-jobs-list-empty-india-sentinel',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-landing-handoff+verified-public-jobs-list-no-india-location-filter-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'i2cinc.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /i2cindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.i2cinc\.com\/who-we-are\/supercharge-your-career\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.i2cinc\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /89 open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /United States/i)
  assert.match(provider.verifiedSurfaceSummary, /Pakistan/i)
  assert.match(provider.verifiedSurfaceSummary, /no India location filter|no India jobs/i)
  assert.equal(provider.modulePath, i2cIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'i2c India'), false)

  assert.equal(i2cIndia.PROVIDER_METADATA.source, I2C_INDIA_CATALOG.source)
  assert.equal(i2cIndia.PROVIDER_METADATA.companyName, I2C_INDIA_CATALOG.companyName)
  assert.equal(
    i2cIndia.PROVIDER_METADATA.officialJobsListUrl,
    I2C_INDIA_CATALOG.officialJobsListUrl,
  )
})

test('i2c India backlog row matches directly from the local catalog without alias changes', async () => {
  const { I2C_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'i2c India\n',
    catalog: [hydrateProviderCatalogEntry(I2C_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['i2c India', 'i2cindia', 'i2c India']],
  )
})

test('getScraperCatalog includes i2c India as a verified empty-India-slice provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'i2cindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'i2c India')
  assert.equal(provider.companyCareerPage, 'https://careers.i2cinc.com/careers/')
  assert.equal(provider.companyDomain, 'i2cinc.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /i2cindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable i2c India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'i2cindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'i2cindia')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /i2cindia[\\/]jobs\.json$/i)
})
