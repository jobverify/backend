import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('JM Baxi Heavy is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jmbaxiheavy')

  assert.ok(provider, 'Expected JM Baxi Heavy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'JM Baxi Heavy')
  assert.equal(provider.companyCareerPage, 'https://www.jmbaxi.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-shell-plus-joblist-postback')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-job-search-shell+verified-empty-joblist-postback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jmbaxi.com')
  assert.match(provider.modulePath, /jmbaxiheavy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'JM Baxi Heavy'), false)
})

test('JM Baxi Heavy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jmbaxiheavy')

  assert.ok(scraper, 'Expected buildScrapers() to return the JM Baxi Heavy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jmbaxiheavy')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.jmbaxi.com/career/')
  assert.match(scraper.dryRunFile, /jmbaxiheavy[\\/]jobs\.json$/i)
})
