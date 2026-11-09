import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Linde India is registered as a verified PeopleStrong-backed scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lindeindia')

  assert.ok(provider, 'Expected Linde India provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Linde India')
  assert.equal(provider.companyCareerPage, 'https://www.lindecareers.com/en/job-locations')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-official-job-locations-validation-plus-offset-limit-api')
  assert.equal(
    provider.extractionStrategy,
    'official-india-homepage-plus-official-job-locations-india-handoff-plus-peoplestrong-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'linde.in')
  assert.match(provider.modulePath, /lindeindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Linde India'), false)
})

test('Linde India matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Linde India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Linde India', 'lindeindia', 'Linde India']],
  )
})

test('Linde India is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lindeindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Linde India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lindeindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.lindecareers.com/en/job-locations')
  assert.match(scraper.dryRunFile, /lindeindia[\\/]jobs\.json$/i)
})
