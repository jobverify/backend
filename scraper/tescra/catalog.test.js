import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'tescra'
const COMPANY = 'TESCRA'
const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/tescra'

test('TESCRA is registered as a LinkedIn company-posts scraper with verified public-company metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected TESCRA provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, LINKEDIN_COMPANY_URL)
  assert.equal(provider.atsPlatform, 'linkedin-company-posts')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-company-page')
  assert.equal(provider.extractionStrategy, 'official-homepage+linkedin-company-posts+external-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tescra.com')
  assert.match(provider.modulePath, /tescra[\\/]script\.js$/i)
})

test('TESCRA resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'TESCRA,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TESCRA', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the TESCRA scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, LINKEDIN_COMPANY_URL)
  assert.match(scraper.dryRunFile, /tescra[\\/]jobs\.json$/i)
})
