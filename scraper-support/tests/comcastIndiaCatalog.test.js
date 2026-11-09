import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Comcast India as a TalentBrew/Radancy script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'comcastindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Comcast India')
  assert.equal(provider.companyCareerPage, 'https://jobs.comcast.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'html-search-results+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.comcast.com')
  assert.match(provider.modulePath, /comcastindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Comcast India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'comcastindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'comcastindia')
  assert.equal(scraper.provider.atsPlatform, 'talentbrew-radancy')
  assert.match(scraper.dryRunFile, /comcastindia[\\/]jobs\.json$/i)
})
