import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Gensol as an official-site placeholder scraper', () => {
  const catalog = getScraperCatalog()
  const gensol = catalog.find((provider) => provider.source === 'gensol')

  assert.ok(gensol)
  assert.equal(gensol.adapter, 'script')
  assert.equal(gensol.atsPlatform, 'official-company-site')
  assert.equal(gensol.companyName, 'Gensol')
  assert.equal(gensol.companyCareerPage, 'https://www.gensol.in/')
  assert.equal(gensol.companyDomain, 'gensol.in')
  assert.equal(gensol.parser, 'custom-script')
  assert.match(gensol.modulePath, /gensol[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gensol scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const gensol = scrapers.find((scraper) => scraper.name === 'gensol')

  assert.ok(gensol)
  assert.equal(typeof gensol.run, 'function')
  assert.equal(gensol.provider.adapter, 'script')
  assert.equal(gensol.provider.parser, 'custom-script')
  assert.equal(gensol.provider.companyCareerPage, 'https://www.gensol.in/')
})
