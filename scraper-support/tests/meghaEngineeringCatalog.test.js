import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Megha Engineering is registered against the verified first-party homepage and careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'meghaengineering')

  assert.ok(provider, 'Expected Megha Engineering provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Megha Engineering')
  assert.equal(provider.companyCareerPage, 'https://meil.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+no-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'meil.in')
  assert.match(provider.modulePath, /meghaengineering[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Megha Engineering'), false)
})

test('Megha Engineering is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'meghaengineering')

  assert.ok(scraper, 'Expected buildScrapers() to return the Megha Engineering scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'meghaengineering')
  assert.equal(scraper.provider.companyCareerPage, 'https://meil.in/careers')
  assert.match(scraper.dryRunFile, /meghaengineering[\\/]jobs\.json$/i)
})
