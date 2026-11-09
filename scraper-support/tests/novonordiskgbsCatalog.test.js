import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Novo Nordisk Global Business Services as a SuccessFactors-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'novonordiskgbs')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Novo Nordisk Global Business Services')
  assert.equal(provider.companyCareerPage, 'https://careers.novonordisk.com/search/')
  assert.equal(provider.companyDomain, 'careers.novonordisk.com')
  assert.match(provider.modulePath, /novonordiskgbs[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Novo Nordisk GBS scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'novonordiskgbs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /novonordiskgbs[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'novonordiskgbs')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
})
