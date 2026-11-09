import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Juniper script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const juniper = catalog.find((provider) => provider.source === 'juniper')

  assert.ok(juniper)
  assert.equal(juniper.adapter, 'script')
  assert.equal(juniper.atsPlatform, 'phenom')
  assert.equal(juniper.companyCareerPage, 'https://careers.hpe.com/juniper')
  assert.equal(juniper.companyDomain, 'careers.hpe.com')
  assert.equal(juniper.targetedJobsLandingKey, 'l-hpe-juniper-networking')
  assert.equal(juniper.countryFilter, 'India')
})

test('buildScrapers exposes a runnable Juniper script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const juniper = scrapers.find((scraper) => scraper.name === 'juniper')

  assert.ok(juniper)
  assert.equal(typeof juniper.run, 'function')
  assert.match(juniper.dryRunFile, /juniper[\\/]jobs\.json$/)
  assert.equal(juniper.provider.source, 'juniper')
  assert.equal(juniper.provider.atsPlatform, 'phenom')
})
