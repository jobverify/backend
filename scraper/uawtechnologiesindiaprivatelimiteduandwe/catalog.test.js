import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('UANDWE is registered against the verified first-party careers page and mailto apply contract', () => {
  const provider = getScraperCatalog().find(
    (item) => item.source === 'uawtechnologiesindiaprivatelimiteduandwe',
  )

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'UAW Technologies India Private Limited (UANDWE)')
  assert.equal(provider.companyCareerPage, 'https://uandwe.com/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-inline-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-job-blocks+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'uandwe.com')
  assert.match(provider.modulePath, /uawtechnologiesindiaprivatelimiteduandwe[\\/]script\.js$/i)
})

test('UAW Technologies India Private Limited (UANDWE) matches company coverage directly and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'UAW Technologies India Private Limited (UANDWE)\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'UAW Technologies India Private Limited (UANDWE)',
      'uawtechnologiesindiaprivatelimiteduandwe',
      'UAW Technologies India Private Limited (UANDWE)',
    ]],
  )

  const scraper = buildScrapers().find(
    (item) => item.name === 'uawtechnologiesindiaprivatelimiteduandwe',
  )

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'uawtechnologiesindiaprivatelimiteduandwe')
  assert.equal(scraper.provider.companyCareerPage, 'https://uandwe.com/careers.html')
  assert.match(scraper.dryRunFile, /uawtechnologiesindiaprivatelimiteduandwe[\\/]jobs\.json$/i)
})
