import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Logic Fruit Technologies as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'logicfruittechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Logic Fruit Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.logic-fruit.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-public-json-feed-count-validation')
  assert.equal(provider.extractionStrategy, 'official-app-shell+verified-careers-bundle+published-first-party-jobs-api+detail-page-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'logic-fruit.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /seven published India jobs/i)
  assert.match(provider.modulePath, /logicfruittechnologies[\\/]script\.js$/i)
})

test('Logic Fruit Technologies alias coverage matches the exact CSV variants tied to the same official careers surface', () => {
  assert.equal(companyAliases['Logic-Fruit Technologies'], 'logicfruittechnologies')

  const scraper = buildScrapers().find((item) => item.name === 'logicfruittechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /logicfruittechnologies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'logicfruittechnologies')

  const report = generateCompanyCoverageReport({
    csvText: [
      'Logic Fruit Technologies,',
      'Logic-Fruit Technologies,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Logic Fruit Technologies', 'logicfruittechnologies', 'Logic Fruit Technologies'],
      ['Logic-Fruit Technologies', 'logicfruittechnologies', 'Logic Fruit Technologies'],
    ],
  )
})
