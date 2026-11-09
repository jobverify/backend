import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Suyati Technologies is registered as a strict retired-brand zero-job sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'suyatitechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Suyati Technologies')
  assert.equal(provider.companyCareerPage, 'https://suyati.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-redirect-plus-acquisition-history-plus-parent-careers-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-suyati-domain-redirect+verified-milestone-acquisition-history+verified-parent-careers-without-brand-specific-openings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'suyati.com')
  assert.match(provider.modulePath, /suyatitechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Suyati Technologies'), false)
})

test('Suyati Technologies is runnable through the provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'suyatitechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'suyatitechnologies')
  assert.match(scraper.dryRunFile, /suyatitechnologies[\\/]jobs\.json$/i)
})
