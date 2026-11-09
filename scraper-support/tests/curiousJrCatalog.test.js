import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/curiousjr/catalog.js')
  } catch {
    assert.fail('Expected CuriousJr catalog module at ../../scraper/curiousjr/catalog.js')
  }
}

const loadCuriousJrModule = async () => {
  try {
    return await import('../../scraper/curiousjr/script.js')
  } catch {
    assert.fail('Expected CuriousJr scraper module at ../../scraper/curiousjr/script.js')
  }
}

test('getScraperCatalog includes CuriousJr as a verified parent-handoff sentinel', async () => {
  const curiousJrCatalog = await loadCatalogModule()
  const curiousJr = await loadCuriousJrModule()
  const provider = getScraperCatalog().find((item) => item.source === 'curiousjr')

  assert.ok(provider)
  assert.equal(provider.source, 'curiousjr')
  assert.equal(provider.companyName, 'CuriousJr')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.curiousjr.com/')
  assert.equal(provider.companyDomain, 'curiousjr.com')
  assert.equal(provider.atsPlatform, 'official-brand-site-plus-parent-company-careers-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-brand-surface-plus-parent-company-careers-handoff-and-common-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-curiousjr-brand-surface+verified-parent-company-pw-careers-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /curiousjr[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /curiousjr[\\/]jobs\.json$/i)

  assert.equal(curiousJrCatalog.CURIOUS_JR_CATALOG.source, provider.source)
  assert.equal(curiousJrCatalog.CURIOUS_JR_CATALOG.companyName, provider.companyName)
  assert.equal(curiousJrCatalog.CURIOUS_JR_CATALOG.companyCareerPage, provider.companyCareerPage)
  assert.equal(curiousJrCatalog.CURIOUS_JR_CATALOG.companyDomain, provider.companyDomain)
  assert.equal(curiousJr.SOURCE, provider.source)
  assert.equal(curiousJr.COMPANY, provider.companyName)
  assert.equal(curiousJr.BRAND_HOME_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve CuriousJr from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'curiousjr')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'curiousjr')
  assert.match(scraper.dryRunFile, /curiousjr[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'CuriousJr,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CuriousJr', 'curiousjr', 'CuriousJr']],
  )
})
