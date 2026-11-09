import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes FEV India Pvt Ltd as a LinkedIn company-post script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'fevindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'FEV India Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://in.linkedin.com/company/fev-india')
  assert.equal(provider.atsPlatform, 'linkedin-company-posts')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-company-page')
  assert.equal(provider.extractionStrategy, 'linkedin-company-posts+email-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'fev.com')
  assert.match(provider.modulePath, /fevindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable FEV India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'fevindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.equal(scraper.provider.companyCareerPage, 'https://in.linkedin.com/company/fev-india')
})
