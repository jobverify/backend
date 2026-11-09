import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Apollo Tyres scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const apollo = catalog.find((provider) => provider.source === 'apollo')

  assert.ok(apollo)
  assert.equal(apollo.adapter, 'script')
  assert.equal(apollo.atsPlatform, 'cornerstone-csod')
  assert.match(apollo.companyCareerPage, /apollotyres\.csod\.com\/ux\/ats\/careersite\/1\/home/i)
  assert.equal(apollo.companyDomain, 'apollotyres.csod.com')
  assert.equal(apollo.paginationStrategy, 'anonymous-native-unfiltered-search+closing-corporate-tenant-client-inventory-proof')
})

test('buildScrapers exposes a runnable Apollo Tyres scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const apollo = scrapers.find((scraper) => scraper.name === 'apollo')

  assert.ok(apollo)
  assert.equal(typeof apollo.run, 'function')
  assert.match(apollo.dryRunFile, /apollo[\\/]jobs\.json$/)
  assert.equal(apollo.provider.source, 'apollo')
  assert.equal(apollo.provider.atsPlatform, 'cornerstone-csod')
})
