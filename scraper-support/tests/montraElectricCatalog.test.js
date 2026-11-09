import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MONTRA ELECTRIC is registered as a verified first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'montraelectric')

  assert.ok(provider, 'Expected MONTRA ELECTRIC provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MONTRA ELECTRIC')
  assert.equal(provider.companyCareerPage, 'https://www.montraelectric.com/life-montra')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-inline-job-cards-and-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'montraelectric.com')
  assert.match(provider.modulePath, /montraelectric[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MONTRA ELECTRIC'), false)
})

test('MONTRA ELECTRIC is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'montraelectric')

  assert.ok(scraper, 'Expected buildScrapers() to return the MONTRA ELECTRIC scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'montraelectric')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.montraelectric.com/life-montra')
  assert.match(scraper.dryRunFile, /montraelectric[\\/]jobs\.json$/i)
})
