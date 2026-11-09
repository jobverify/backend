import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('McMenon Engineering Services is registered as a verified first-party empty-vacancy scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mcmenonengineeringservices')

  assert.ok(provider, 'Expected McMenon Engineering Services provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'McMenon Engineering Services Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.mcmenon.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-vacancy-section-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-vacancy-section-explicit-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mcmenon.com')
  assert.match(provider.modulePath, /mcmenonengineeringservices[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'McMenon Engineering Services Ltd.'), false)
})

test('McMenon Engineering Services is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mcmenonengineeringservices')

  assert.ok(scraper, 'Expected buildScrapers() to return the McMenon Engineering Services scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mcmenonengineeringservices')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.mcmenon.com/careers/')
  assert.match(scraper.dryRunFile, /mcmenonengineeringservices[\\/]jobs\.json$/i)
})
