import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Trimble Eightfold apiPortal provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'trimble')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'Trimble Inc')
  assert.equal(provider.companyCareerPage, 'https://www.trimble.com/en/careers')
  assert.equal(provider.companyDomain, 'trimble.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-limit')
  assert.equal(provider.extractionStrategy, 'api+detail')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://trimblecareers.trimble.com/api/pcsx/search',
  )
  assert.equal(provider.config.request.query.domain, 'trimble.com')
  assert.equal(provider.config.request.query.location, 'India')
  assert.equal(provider.config.mapping.title, 'name')
  assert.deepEqual(provider.config.mapping.location, {strategy:'eightfold-location'})
  assert.deepEqual(provider.config.mapping.country, {strategy:'eightfold-country'})
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://trimblecareers.trimble.com/api/pcsx/position_details?position_id={{jobId}}&domain=trimble.com&hl=en',
  )
  assert.match(provider.config.resultFilter.include[0].pattern, /india/i)
})

test('buildScrapers and company coverage resolve Trimble Inc to a runnable apiPortal source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'trimble')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /trimble[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'trimble')

  const report = generateCompanyCoverageReport({
    csvText: 'Trimble Inc,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Trimble Inc', 'trimble', 'Trimble Inc']],
  )
})
