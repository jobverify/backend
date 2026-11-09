import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Mikuni India Private Limited is registered against its official first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mikuniindia')

  assert.ok(provider, 'Expected Mikuni India Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mikuni India Private Limited')
  assert.equal(provider.companyCareerPage, 'https://mikuni.co.in/open-positions-linked-with-naukri-portal/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-application-form-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-application-form-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mikuni.co.in')
  assert.match(provider.modulePath, /mikuniindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mikuni India Pvt Ltd'), false)
})

test('Mikuni India is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mikuniindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Mikuni India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mikuniindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://mikuni.co.in/open-positions-linked-with-naukri-portal/')
  assert.match(scraper.dryRunFile, /mikuniindia[\\/]jobs\.json$/i)
})
