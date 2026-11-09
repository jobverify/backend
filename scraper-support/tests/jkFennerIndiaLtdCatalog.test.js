import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('J.K.Fenner India Ltd is registered as a verified first-party careers-table scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jkfennerindialtd')

  assert.ok(provider, 'Expected J.K.Fenner India Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'J.K.Fenner India Ltd')
  assert.equal(provider.companyCareerPage, 'https://jkfenner.com/career-list/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage+first-party-careers-table+apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jkfenner.com')
  assert.match(provider.modulePath, /jkfennerindialtd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'J.K.Fenner India Ltd'), false)
})

test('J.K.Fenner India Ltd matches coverage directly and is runnable through buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: '"J.K.Fenner India Ltd"\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['J.K.Fenner India Ltd', 'jkfennerindialtd', 'J.K.Fenner India Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'jkfennerindialtd')

  assert.ok(scraper, 'Expected buildScrapers() to return the J.K.Fenner India Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jkfennerindialtd')
  assert.equal(scraper.provider.companyCareerPage, 'https://jkfenner.com/career-list/')
  assert.match(scraper.dryRunFile, /jkfennerindialtd[\\/]jobs\.json$/i)
})
