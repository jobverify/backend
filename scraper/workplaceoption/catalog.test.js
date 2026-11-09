import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Workplace Options is registered against the verified first-party careers page and JazzHR board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'workplaceoption')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Workplace Options')
  assert.equal(provider.companyCareerPage, 'https://www.workplaceoptions.com/careers/')
  assert.equal(provider.atsPlatform, 'jazzhr')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-plus-jazzhr-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+official-jazzhr-board+deduplicated-india-job-cards',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'workplaceoptions.com')
  assert.match(provider.modulePath, /workplaceoption[\\/]script\.js$/i)
  assert.equal(companyAliases['Workplace Option'], 'workplaceoption')
})

test('Workplace Option resolves through the exact backlog alias and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Workplace Option\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Workplace Option', 'workplaceoption', 'Workplace Options']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'workplaceoption')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'workplaceoption')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.workplaceoptions.com/careers/')
  assert.match(scraper.dryRunFile, /workplaceoption[\\/]jobs\.json$/i)
})
