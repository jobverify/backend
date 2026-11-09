import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'srmgroupofcompanies'
const COMPANY = 'SRM Group of Companies'
const CAREERS_PAGE_URL = 'https://www.srmtech.com/careers/'

test('SRM Group of Companies is registered as a verified SRM Group sentinel that stops on the SRM Technologies-branded public board mismatch', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected SRM Group of Companies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_PAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.srmtech.com/who-we-are/',
    'https://careers.srmtech.com/jobs/Careers',
  ])
  assert.equal(provider.atsPlatform, 'zoho-recruit-exact-brand-mismatch')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'group-surface-plus-public-srm-tech-board-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-srm-group-surface+verified-srm-tech-careers-page+public-srm-tech-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'srmtech.com')
  assert.match(provider.modulePath, /srmgroupofcompanies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('SRM Group of Companies matches company coverage directly from provider metadata and stays runnable through buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SRM Group of Companies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the SRM Group of Companies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_PAGE_URL)
  assert.match(scraper.dryRunFile, /srmgroupofcompanies[\\/]jobs\.json$/i)
})
