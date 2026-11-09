import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Josh Technology Group is registered against the official first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'joshtechnologygroup')

  assert.ok(provider, 'Expected Josh Technology Group provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Josh Technology Group')
  assert.equal(provider.companyCareerPage, 'https://www.joshtechnologygroup.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+detail-pages+onsite-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'joshtechnologygroup.com')
  assert.match(provider.modulePath, /joshtechnologygroup[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Josh Technology Group'), false)
})

test('Josh Technology Group matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Josh Technology Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Josh Technology Group', 'joshtechnologygroup', 'Josh Technology Group']],
  )
})

test('Josh Technology Group is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'joshtechnologygroup')

  assert.ok(scraper, 'Expected buildScrapers() to return the Josh Technology Group scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'joshtechnologygroup')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.joshtechnologygroup.com/careers/')
  assert.match(scraper.dryRunFile, /joshtechnologygroup[\\/]jobs\.json$/i)
})
