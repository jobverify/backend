import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Techmaghi is registered against its verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'techmaghi')

  assert.ok(provider, 'Expected Techmaghi provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Techmaghi')
  assert.equal(provider.companyCareerPage, 'https://techmaghi.com/career-2/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-role-cards+same-page-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'techmaghi.com')
  assert.match(provider.modulePath, /techmaghi[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Techmaghi'), false)
})

test('Techmaghi matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Techmaghi,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Techmaghi', 'techmaghi', 'Techmaghi']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'techmaghi')

  assert.ok(scraper, 'Expected buildScrapers() to return the Techmaghi scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'techmaghi')
  assert.equal(scraper.provider.companyCareerPage, 'https://techmaghi.com/career-2/')
  assert.match(scraper.dryRunFile, /techmaghi[\\/]jobs\.json$/i)
})
