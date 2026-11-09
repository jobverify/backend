import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('GoLive Games Studios is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'golivegamesstudios')

  assert.ok(provider, 'Expected GoLive Games Studios provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GoLive Games Studios')
  assert.equal(provider.companyCareerPage, 'https://www.golive.games/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'golive.games')
  assert.match(provider.modulePath, /golivegamesstudios[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GoLive Games Studios'), false)
})

test('GoLive Games Studios matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GoLive Games Studios,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GoLive Games Studios', 'golivegamesstudios', 'GoLive Games Studios']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'golivegamesstudios')

  assert.ok(scraper, 'Expected buildScrapers() to return the GoLive Games Studios scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'golivegamesstudios')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.golive.games/')
  assert.match(scraper.dryRunFile, /golivegamesstudios[\\/]jobs\.json$/i)
})
