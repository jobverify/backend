import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Mehta Hitech Industries Ltd. is registered as a first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mehtahitechindustriesltd')

  assert.ok(provider, 'Expected Mehta Hitech Industries Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mehta Hitech Industries Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.mehtahitech.com/jobs.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-inline-job-section-and-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mehtahitech.com')
  assert.match(provider.modulePath, /mehtahitechindustriesltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mehta Hitech Industries Ltd.'), false)
})

test('Mehta Hitech Industries Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mehta Hitech Industries Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mehta Hitech Industries Ltd.', 'mehtahitechindustriesltd', 'Mehta Hitech Industries Ltd.']],
  )
})

test('Mehta Hitech Industries Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mehtahitechindustriesltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Mehta Hitech Industries Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mehtahitechindustriesltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.mehtahitech.com/jobs.html')
  assert.match(scraper.dryRunFile, /mehtahitechindustriesltd[\\/]jobs\.json$/i)
})
