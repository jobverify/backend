import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Techolution custom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const techolution = catalog.find((provider) => provider.source === 'techolution')

  assert.ok(techolution, 'Expected Techolution provider in the scraper catalog')
  assert.equal(techolution.adapter, 'script')
  assert.equal(techolution.atsPlatform, 'techolution-first-party-api')
  assert.equal(techolution.companyCareerPage, 'https://www.techolution.com/careers/')
  assert.equal(techolution.countryFilter, 'India')
  assert.equal(techolution.paginationStrategy, 'single-public-json-feed')
  assert.equal(
    techolution.extractionStrategy,
    'official-careers-api+official-detail-api+hire-subdomain-apply-page',
  )
  assert.equal(techolution.parser, 'custom-script')
  assert.equal(techolution.normalizationProfile, 'engineering-default')
  assert.equal(techolution.companyDomain, 'techolution.com')
  assert.match(techolution.modulePath, /techolution[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Techolution scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const techolution = scrapers.find((scraper) => scraper.name === 'techolution')

  assert.ok(techolution, 'Expected Techolution scraper in the built scraper list')
  assert.equal(typeof techolution.run, 'function')
  assert.match(techolution.dryRunFile, /techolution[\\/]jobs\.json$/)
  assert.equal(techolution.provider.source, 'techolution')
  assert.equal(techolution.provider.atsPlatform, 'techolution-first-party-api')
})
