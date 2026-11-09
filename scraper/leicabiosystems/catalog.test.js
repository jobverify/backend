import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Leica Biosystems is registered against its official Danaher careers landing page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'leicabiosystems')

  assert.ok(provider, 'Expected Leica Biosystems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Leica Biosystems')
  assert.equal(provider.companyCareerPage, 'https://jobs.danaher.com/global/en/leica-biosystems')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'keyword-search-pagination-until-india-matches')
  assert.equal(provider.extractionStrategy, 'official-leica-site-handoff+danaher-phenom-search+opco-filter+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.danaher.com')
  assert.match(provider.modulePath, /leicabiosystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Leica Biosystems'), false)
})

test('Leica Biosystems is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'leicabiosystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the Leica Biosystems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'leicabiosystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://jobs.danaher.com/global/en/leica-biosystems')
  assert.match(scraper.dryRunFile, /leicabiosystems[\\/]jobs\.json$/i)
})
