import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Botminds embedded careers provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const botminds = catalog.find((provider) => provider.source === 'botminds')

  assert.ok(botminds)
  assert.equal(botminds.adapter, 'script')
  assert.equal(botminds.atsPlatform, 'official-company-careers')
  assert.match(botminds.companyCareerPage, /botminds\.ai\/careers/i)
  assert.equal(botminds.companyDomain, 'botminds.ai')
  assert.equal(botminds.paginationStrategy, 'complete-declared-public-API-plus-two-native-role-passes-and-closing-feed')
})

test('buildScrapers exposes a runnable Botminds scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const botminds = scrapers.find((scraper) => scraper.name === 'botminds')

  assert.ok(botminds)
  assert.equal(typeof botminds.run, 'function')
  assert.match(botminds.dryRunFile, /botminds[\\/]jobs\.json$/)
  assert.equal(botminds.provider.source, 'botminds')
  assert.equal(botminds.provider.atsPlatform, 'official-company-careers')
})
