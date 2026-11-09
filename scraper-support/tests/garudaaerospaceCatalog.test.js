import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Garuda Aerospace as a custom careers API-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'garudaaerospace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'custom-careers-api')
  assert.equal(provider.companyName, 'Garuda Aerospace')
  assert.equal(provider.companyCareerPage, 'https://www.garudaaerospace.com/company/careers')
  assert.equal(provider.companyDomain, 'garudaaerospace.com')
  assert.match(provider.modulePath, /garudaaerospace[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Garuda Aerospace scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'garudaaerospace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /garudaaerospace[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'garudaaerospace')
  assert.equal(scraper.provider.atsPlatform, 'custom-careers-api')
})
