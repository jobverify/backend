import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadJPMorganChaseModule = async () => {
  try {
    return await import('../../scraper/jpmorganchase/script.js')
  } catch {
    assert.fail('Expected JPMorgan Chase scraper module at ../../scraper/jpmorganchase/script.js')
  }
}

test('getScraperCatalog includes JPMorgan Chase as a verified Oracle Cloud script provider', async () => {
  const jpmorganChase = await loadJPMorganChaseModule()
  const provider = getScraperCatalog().find((item) => item.source === jpmorganChase.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'jpmorganchase')
  assert.equal(provider.companyName, 'JPMorgan Chase')
  assert.equal(provider.officialBrandName, 'Chase India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jpmorganchase.com/careers')
  assert.equal(provider.companyDomain, 'jpmorganchase.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-jpmorganchase-careers-page+verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.workspaceDomain, 'jpmc.fa.oraclecloud.com')
  assert.match(provider.modulePath, /jpmorganchase[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /jpmorganchase[\\/]jobs\.json$/i)

  assert.equal(jpmorganChase.SOURCE, provider.source)
  assert.equal(jpmorganChase.COMPANY, provider.companyName)
  assert.equal(jpmorganChase.OFFICIAL_BRAND_NAME, provider.officialBrandName)
  assert.equal(jpmorganChase.CAREERS_URL, provider.companyCareerPage)
  assert.equal(jpmorganChase.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(jpmorganChase.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(jpmorganChase.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(jpmorganChase.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(jpmorganChase.PARSER, provider.parser)
  assert.equal(jpmorganChase.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(jpmorganChase.WORKSPACE_DOMAIN, provider.workspaceDomain)
  assert.equal(jpmorganChase.CAREERS_URL, 'https://www.jpmorganchase.com/careers')
  assert.equal(typeof jpmorganChase.createJPMorganChaseScraper, 'function')
})

test('buildScrapers and company coverage resolve JPMorgan Chase from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jpmorganchase')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jpmorganchase')
  assert.match(scraper.dryRunFile, /jpmorganchase[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'JPMorgan Chase,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JPMorgan Chase', 'jpmorganchase', 'JPMorgan Chase']],
  )
})
