import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the ZoomRx Darwinbox script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const zoomrx = catalog.find((provider) => provider.source === 'zoomrx')

  assert.ok(zoomrx)
  assert.equal(zoomrx.adapter, 'script')
  assert.equal(zoomrx.atsPlatform, 'darwinbox')
  assert.match(zoomrx.companyCareerPage, /careers\.zoomrx\.com\/explore-roles\/?$/i)
  assert.equal(zoomrx.companyDomain, 'careers.zoomrx.com')
  assert.equal(zoomrx.parser, 'custom-script')
  assert.match(zoomrx.modulePath, /zoomrx[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ZoomRx script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const zoomrx = scrapers.find((scraper) => scraper.name === 'zoomrx')

  assert.ok(zoomrx)
  assert.equal(typeof zoomrx.run, 'function')
  assert.equal(zoomrx.provider.adapter, 'script')
  assert.equal(zoomrx.provider.atsPlatform, 'darwinbox')
  assert.match(zoomrx.dryRunFile, /zoomrx[\\/]jobs\.json$/)
})
