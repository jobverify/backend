import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Optum as a custom script provider with validated metadata and narrow aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'optum')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Optum')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy+oracle-taleo')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.unitedhealthgroup.com/location/india-jobs/34088/1269750/2',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'next-link+page-count')
  assert.equal(
    provider.extractionStrategy,
    'official-india-listing+detail-pages+taleo-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.unitedhealthgroup.com')
  assert.match(provider.modulePath, /optum[\\/]script\.js$/i)
  assert.equal(companyAliases.Optum, 'optum')
  assert.equal(companyAliases['Optum India'], 'optum')
  assert.equal(companyAliases['Optum Global Advantage'], 'optum')
  assert.equal(companyAliases.OptumInsight, 'optum')
  assert.equal(companyAliases['Optum Technology'], 'optum')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'UnitedHealth Group'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'UnitedHealthcare'), false)
})

test('buildScrapers exposes a runnable Optum scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'optum')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /optum[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'optum')
  assert.equal(scraper.provider.atsPlatform, 'talentbrew-radancy+oracle-taleo')
})
