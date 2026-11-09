import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'sequellogistics'
const COMPANY = 'Sequel Logistics'
const COMPANY_PAGE_URL = 'https://www.sequelglobal.com/career.html'

test('Sequel Logistics is registered as a verified first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Sequel Logistics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-landing-page-plus-lateral-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-lateral-openings-cards',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sequelglobal.com')
  assert.match(provider.modulePath, /sequellogistics[\\/]script\.js$/i)
})

test('Sequel Logistics resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'sequel logistics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['sequel logistics', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Sequel Logistics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.match(scraper.dryRunFile, /sequellogistics[\\/]jobs\.json$/i)
})
