import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AstraZeneca as an Eightfold apiPortal provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'astrazeneca')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'AstraZeneca')
  assert.equal(provider.companyCareerPage, 'https://careers.astrazeneca.com/')
  assert.equal(provider.companyDomain, 'astrazeneca.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-limit')
  assert.equal(provider.extractionStrategy, 'api+detail')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://astrazeneca.eightfold.ai/api/pcsx/search',
  )
  assert.equal(provider.config.request.query.domain, 'astrazeneca.com')
  assert.equal(provider.config.request.query.location, 'India')
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://astrazeneca.eightfold.ai/api/pcsx/position_details?position_id={{jobId}}&domain=astrazeneca.com&hl=en',
  )
  assert.match(provider.config.resultFilter.include[0].pattern, /india/i)
})

test('buildScrapers and company coverage resolve AstraZeneca to a runnable apiPortal source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'astrazeneca')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /astrazeneca[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'astrazeneca')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')

  const report = generateCompanyCoverageReport({
    csvText: 'AstraZeneca,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AstraZeneca', 'astrazeneca', 'AstraZeneca']],
  )
})
