import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Central Electronics Limited as a first-party recruitment-table scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'centralelectronicslimited')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Central Electronics Limited')
  assert.equal(provider.companyCareerPage, 'https://www.celindia.co.in/career-opportunity')
  assert.equal(provider.atsPlatform, 'official-recruitment-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-recruitment-table')
  assert.equal(provider.extractionStrategy, 'table-rows+download-link+optional-applyonline-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'celindia.co.in')
  assert.match(provider.modulePath, /centralelectronicslimited[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Central Electronics Limited scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'centralelectronicslimited')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'centralelectronicslimited')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.dryRunFile, /centralelectronicslimited[\\/]jobs\.json$/i)
})
