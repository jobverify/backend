import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'zonescorporatesolutionspvtltd'
const COMPANY = 'Zones Corporate Solutions Pvt Ltd'
const COMPANY_PAGE_URL = 'https://in.linkedin.com/company/zonesindia'

test('Zones Corporate Solutions Pvt Ltd is registered as a LinkedIn guest-search scraper pinned to the official India legal entity', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Zones Corporate Solutions Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-site-legal-entity-validation-plus-single-linkedin-india-search-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-homepage+verified-privacy-legal-entity+verified-linkedin-company-page+public-linkedin-guest-search+detail-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'in.zones.com')
  assert.match(provider.modulePath, /zonescorporatesolutionspvtltd[\\/]script\.js$/i)
})

test('Zones Corporate Solutions Pvt Ltd resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Zones Corporate Solutions Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Zones Corporate Solutions Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.match(scraper.dryRunFile, /zonescorporatesolutionspvtltd[\\/]jobs\.json$/i)
})
