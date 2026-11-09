import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Talent Battle as a verified zero-job placement-board sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'talentbattle')

  assert.ok(provider, 'Expected Talent Battle provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Talent Battle')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://talentbattle.in/Jobs')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-placement-board-shell-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-placement-board-shell+verified-missing-careers-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'talentbattle.in')
  assert.match(provider.modulePath, /talentbattle[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Talent Battle'), false)
})

test('buildScrapers and company coverage resolve the exact CSV name Talent Battle without a new alias', () => {
  const scraper = buildScrapers().find((item) => item.name === 'talentbattle')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'talentbattle')
  assert.match(scraper.dryRunFile, /talentbattle[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Talent Battle,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Talent Battle', 'talentbattle', 'Talent Battle']],
  )
})
