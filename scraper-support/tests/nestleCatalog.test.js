import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Nestle SuccessFactors script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const nestle = catalog.find((provider) => provider.source === 'nestle')

  assert.ok(nestle)
  assert.equal(nestle.adapter, 'script')
  assert.equal(nestle.atsPlatform, 'successfactors')
  assert.match(nestle.companyCareerPage, /jobdetails\.nestle\.com\/search\/\?/i)
  assert.match(nestle.companyCareerPage, /optionsFacetsDD_country=IN/i)
  assert.equal(nestle.companyDomain, 'jobdetails.nestle.com')
  assert.equal(nestle.parser, 'custom-script')
  assert.match(nestle.modulePath, /nestle[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Nestle script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const nestle = scrapers.find((scraper) => scraper.name === 'nestle')

  assert.ok(nestle)
  assert.equal(typeof nestle.run, 'function')
  assert.equal(nestle.provider.adapter, 'script')
  assert.equal(nestle.provider.atsPlatform, 'successfactors')
  assert.match(nestle.dryRunFile, /nestle[\\/]jobs\.json$/)
})
