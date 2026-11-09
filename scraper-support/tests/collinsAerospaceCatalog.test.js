import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Collins Aerospace Phenom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const collinsAerospace = catalog.find((provider) => provider.source === 'collinsaerospace')

  assert.ok(collinsAerospace)
  assert.equal(collinsAerospace.adapter, 'script')
  assert.equal(collinsAerospace.atsPlatform, 'phenom')
  assert.match(collinsAerospace.companyCareerPage, /careers\.rtx\.com\/global\/en\/collins-aerospace/i)
  assert.equal(collinsAerospace.companyDomain, 'careers.rtx.com')
  assert.match(collinsAerospace.modulePath, /collinsaerospace[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Collins Aerospace scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const collinsAerospace = scrapers.find((scraper) => scraper.name === 'collinsaerospace')

  assert.ok(collinsAerospace)
  assert.equal(typeof collinsAerospace.run, 'function')
  assert.match(collinsAerospace.dryRunFile, /collinsaerospace[\\/]jobs\.json$/)
  assert.equal(collinsAerospace.provider.source, 'collinsaerospace')
  assert.equal(collinsAerospace.provider.atsPlatform, 'phenom')
})
