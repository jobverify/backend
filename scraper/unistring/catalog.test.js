import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Unistring is registered against the verified first-party careers section', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'unistring')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Unistring Tech Solutions')
  assert.equal(provider.companyCareerPage, 'https://unistring.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-current-openings-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+current-openings-job-cards+apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'unistring.com')
  assert.match(provider.modulePath, /unistring[\\/]script\.js$/i)
})

test('Unistring matches company coverage directly from provider metadata and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Unistring\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Unistring', 'unistring', 'Unistring Tech Solutions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'unistring')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'unistring')
  assert.equal(scraper.provider.companyCareerPage, 'https://unistring.com/career/')
  assert.match(scraper.dryRunFile, /unistring[\\/]jobs\.json$/i)
})
