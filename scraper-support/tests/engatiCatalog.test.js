import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Engati as an official careers empty-state scraper', () => {
  const catalog = getScraperCatalog()
  const engati = catalog.find((provider) => provider.source === 'engati')

  assert.ok(engati)
  assert.equal(engati.adapter, 'script')
  assert.equal(engati.atsPlatform, 'official-company-careers')
  assert.match(engati.companyCareerPage, /engati\.ai\/careers/i)
  assert.equal(engati.companyDomain, 'engati.ai')
  assert.equal(engati.parser, 'custom-script')
})

test('buildScrapers exposes a runnable Engati script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const engati = scrapers.find((scraper) => scraper.name === 'engati')

  assert.ok(engati)
  assert.equal(typeof engati.run, 'function')
  assert.equal(engati.provider.adapter, 'script')
  assert.equal(engati.provider.parser, 'custom-script')
  assert.match(engati.provider.companyCareerPage, /engati\.ai\/careers/i)
})
