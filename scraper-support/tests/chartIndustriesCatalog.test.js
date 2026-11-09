import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Chart Industries on the official India jobs surface with the Howden alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chartindustries')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Chart Industries')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://jobs.chartindustries.com/search/?q=&locationsearch=India')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query')
  assert.equal(provider.extractionStrategy, 'official-search-page+detail-pages+talentcommunity-apply-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.chartindustries.com')
  assert.match(provider.modulePath, /chartindustries[\\/]script\.js$/i)
  assert.equal(companyAliases['Howden, a Chart Industries Company'], 'chartindustries')
})

test('buildScrapers and company coverage resolve the Howden CSV row to the Chart Industries source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chartindustries')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /chartindustries[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'chartindustries')

  const report = generateCompanyCoverageReport({
    csvText: 'Howden, a Chart Industries Company,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Howden, a Chart Industries Company', 'chartindustries', 'Chart Industries']],
  )
})
