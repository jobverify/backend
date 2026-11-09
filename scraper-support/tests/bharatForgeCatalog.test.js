import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bharat Forge as an official-site resume-form scraper', () => {
  const catalog = getScraperCatalog()
  const bharatForge = catalog.find((provider) => provider.source === 'bharatforge')

  assert.ok(bharatForge)
  assert.equal(bharatForge.adapter, 'script')
  assert.equal(bharatForge.atsPlatform, 'official-company-careers')
  assert.match(bharatForge.companyCareerPage, /bharatforge\.com\/careers\/careers\/?$/i)
  assert.equal(bharatForge.companyDomain, 'bharatforge.com')
  assert.match(bharatForge.modulePath, /bharatforge[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Bharat Forge scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bharatForge = scrapers.find((scraper) => scraper.name === 'bharatforge')

  assert.ok(bharatForge)
  assert.equal(typeof bharatForge.run, 'function')
  assert.match(bharatForge.dryRunFile, /bharatforge[\\/]jobs\.json$/)
  assert.equal(bharatForge.provider.source, 'bharatforge')
  assert.equal(bharatForge.provider.atsPlatform, 'official-company-careers')
})
