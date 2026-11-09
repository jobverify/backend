import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/giva/catalog.js')
  } catch {
    assert.fail('Expected GIVA catalog module at ../../scraper/giva/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/giva/script.js')
  } catch {
    assert.fail('Expected GIVA scraper module at ../../scraper/giva/script.js')
  }
}

test('GIVA local catalog captures the verified first-party careers shell and no-public-jobs contract', async () => {
  const { GIVA_CATALOG } = await loadCatalogModule()
  const giva = await loadScriptModule()

  assert.equal(GIVA_CATALOG.source, 'giva')
  assert.equal(GIVA_CATALOG.companyName, 'GIVA')
  assert.equal(GIVA_CATALOG.officialBrandName, 'GIVA Jewellery')
  assert.equal(GIVA_CATALOG.adapter, 'script')
  assert.equal(GIVA_CATALOG.homepageUrl, 'https://www.giva.co/')
  assert.equal(GIVA_CATALOG.companyCareerPage, 'https://www.giva.co/pages/careers')
  assert.equal(GIVA_CATALOG.companyDomain, 'giva.co')
  assert.equal(GIVA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GIVA_CATALOG.countryFilter, 'India')
  assert.equal(
    GIVA_CATALOG.paginationStrategy,
    'verified-homepage-plus-careers-shell-validation',
  )
  assert.equal(
    GIVA_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-shell-without-public-listings-return-empty',
  )
  assert.equal(GIVA_CATALOG.parser, 'custom-script')
  assert.equal(GIVA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GIVA_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GIVA_CATALOG.verifiedSurfaceSummary, /Join Us/i)
  assert.match(GIVA_CATALOG.verifiedSurfaceSummary, /Indiejewel Fashions Private Limited/i)
  assert.match(GIVA_CATALOG.modulePath, /giva[\\/]script\.js$/i)
  assert.match(GIVA_CATALOG.dryRunFile, /giva[\\/]jobs\.json$/i)

  assert.equal(giva.SOURCE, GIVA_CATALOG.source)
  assert.equal(giva.COMPANY, GIVA_CATALOG.companyName)
  assert.equal(giva.OFFICIAL_BRAND_NAME, GIVA_CATALOG.officialBrandName)
  assert.equal(giva.HOMEPAGE_URL, GIVA_CATALOG.homepageUrl)
  assert.equal(giva.CAREERS_URL, GIVA_CATALOG.companyCareerPage)
  assert.equal(giva.COMPANY_DOMAIN, GIVA_CATALOG.companyDomain)
})

test('GIVA exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { GIVA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'GIVA\n',
    catalog: [GIVA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GIVA', 'giva', 'GIVA']],
  )
})

test('getScraperCatalog includes GIVA as a verified empty-board script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'giva')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GIVA')
  assert.equal(provider.companyCareerPage, 'https://www.giva.co/pages/careers')
  assert.equal(provider.companyDomain, 'giva.co')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /giva[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GIVA scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'giva')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'giva')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /giva[\\/]jobs\.json$/i)
})
