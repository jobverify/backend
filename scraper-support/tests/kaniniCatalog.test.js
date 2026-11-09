import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('KANINI is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kanini')

  assert.ok(provider, 'Expected KANINI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KANINI SOFTWARE SOLUTIONS')
  assert.equal(provider.companyCareerPage, 'https://kanini.com/careers/open-positions/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-open-positions-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+verified-open-positions-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kanini.com')
  assert.match(provider.modulePath, /kanini[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'KANINI SOFTWARE SOLUTIONS'), false)
})

test('KANINI matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'KANINI SOFTWARE SOLUTIONS,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KANINI SOFTWARE SOLUTIONS', 'kanini', 'KANINI SOFTWARE SOLUTIONS']],
  )
})

test('KANINI is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kanini')

  assert.ok(scraper, 'Expected buildScrapers() to return the KANINI scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kanini')
  assert.equal(scraper.provider.companyCareerPage, 'https://kanini.com/careers/open-positions/')
  assert.match(scraper.dryRunFile, /kanini[\\/]jobs\.json$/i)
})
