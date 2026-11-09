import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kaizen Institute is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kaizeninstitute')

  assert.ok(provider, 'Expected Kaizen Institute provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kaizen Institute')
  assert.equal(provider.companyCareerPage, 'https://kaizen.com/in/careers-in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-email-only-careers-page-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kaizen.com')
  assert.match(provider.modulePath, /kaizeninstitute[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kaizen Institute'), false)
})

test('Kaizen Institute matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kaizen Institute,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kaizen Institute', 'kaizeninstitute', 'Kaizen Institute']],
  )
})

test('Kaizen Institute is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kaizeninstitute')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kaizen Institute scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kaizeninstitute')
  assert.equal(scraper.provider.companyCareerPage, 'https://kaizen.com/in/careers-in/')
  assert.match(scraper.dryRunFile, /kaizeninstitute[\\/]jobs\.json$/i)
})
