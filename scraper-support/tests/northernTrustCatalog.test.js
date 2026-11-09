import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Northern Trust on the official Northern Trust careers page backed by Workday', () => {
  const catalog = getScraperCatalog()
  const northernTrust = catalog.find((provider) => provider.source === 'northerntrust')

  assert.ok(northernTrust)
  assert.equal(northernTrust.adapter, 'workday')
  assert.equal(northernTrust.atsPlatform, 'workday')
  assert.match(northernTrust.companyCareerPage, /northerntrust\.com\/united-states\/about-us\/careers/i)
  assert.equal(northernTrust.companyDomain, 'northerntrust.com')
  assert.match(northernTrust.baseUrl, /ntrs\.wd1\.myworkdayjobs\.com\/northerntrust/i)
})

test('buildScrapers exposes a runnable Northern Trust Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const northernTrust = scrapers.find((scraper) => scraper.name === 'northerntrust')

  assert.ok(northernTrust)
  assert.equal(typeof northernTrust.run, 'function')
  assert.match(northernTrust.dryRunFile, /northerntrust.workday[\\/]jobs\.json$/)
  assert.equal(northernTrust.provider.source, 'northerntrust')
  assert.equal(northernTrust.provider.atsPlatform, 'workday')
})
