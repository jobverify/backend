import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadSamcoModule = async () => {
  try {
    return await import('../../scraper/samco/script.js')
  } catch {
    assert.fail('Expected Samco scraper module at ../../scraper/samco/script.js')
  }
}

test('getScraperCatalog includes Samco as a verified first-party careers script provider', async () => {
  const samco = await loadSamcoModule()
  const provider = getScraperCatalog().find((item) => item.source === samco.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'samco')
  assert.equal(provider.companyName, 'Samco')
  assert.equal(provider.officialBrandName, 'SAMCO Securities Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.samco.in/careers')
  assert.equal(provider.companyDomain, 'samco.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-public-department-options')
  assert.equal(
    provider.extractionStrategy,
    'verified-samco-homepage+verified-first-party-careers-page+public-position-select+matching-inline-apply-cards',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /samco[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /samco[\\/]jobs\.json$/i)

  assert.equal(samco.SOURCE, provider.source)
  assert.equal(samco.COMPANY, provider.companyName)
  assert.equal(samco.OFFICIAL_BRAND_NAME, provider.officialBrandName)
  assert.equal(samco.HOMEPAGE_URL, 'https://www.samco.in/')
  assert.equal(samco.CAREERS_URL, provider.companyCareerPage)
  assert.equal(samco.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(samco.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(samco.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(samco.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(samco.PARSER, provider.parser)
  assert.equal(samco.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(typeof samco.createSamcoScraper, 'function')
})

test('buildScrapers and company coverage resolve Samco from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'samco')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'samco')
  assert.match(scraper.dryRunFile, /samco[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Samco,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Samco', 'samco', 'Samco']],
  )
})
