import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes PetroBot on the verified first-party careers page backed by SmartRecruiters', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'petrobot')

  assert.ok(provider, 'Expected PetroBot provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PetroBot')
  assert.equal(provider.companyCareerPage, 'https://petrobot.co.in/company/careers')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-page-plus-smartrecruiters-api')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+smartrecruiters-jobs-api+detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'petrobot.co.in')
  assert.match(provider.modulePath, /petrobot[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable PetroBot scraper and company coverage resolves the exact CSV row without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'petrobot')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'petrobot')
  assert.equal(scraper.provider.atsPlatform, 'smartrecruiters')
  assert.match(scraper.dryRunFile, /petrobot[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'PetroBot,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PetroBot', 'petrobot', 'PetroBot']],
  )
})
