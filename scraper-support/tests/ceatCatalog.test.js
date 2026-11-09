import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CEAT with its official careers page metadata', () => {
  const catalog = getScraperCatalog()
  const ceat = catalog.find((provider) => provider.source === 'ceat')

  assert.ok(ceat)
  assert.equal(ceat.adapter, 'script')
  assert.equal(ceat.atsPlatform, 'turbohire')
  assert.equal(ceat.companyCareerPage, 'https://www.ceat.com/career-landing.html')
  assert.equal(ceat.companyDomain, 'ceat.com')
  assert.equal(ceat.parser, 'custom-script')
  assert.match(ceat.modulePath, /ceat[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CEAT script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const ceat = scrapers.find((scraper) => scraper.name === 'ceat')

  assert.ok(ceat)
  assert.equal(typeof ceat.run, 'function')
  assert.equal(ceat.provider.adapter, 'script')
  assert.equal(ceat.provider.parser, 'custom-script')
  assert.equal(ceat.provider.companyCareerPage, 'https://www.ceat.com/career-landing.html')
})
