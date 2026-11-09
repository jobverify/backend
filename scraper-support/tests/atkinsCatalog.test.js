import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AtkinsRealis scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const atkinsrealis = catalog.find((provider) => provider.source === 'atkinsrealis')

  assert.ok(atkinsrealis)
  assert.equal(atkinsrealis.adapter, 'apiPortal')
  assert.equal(atkinsrealis.atsPlatform, 'connectid-jobs-api')
  assert.match(atkinsrealis.companyCareerPage, /careers\.atkinsrealis\.com\/en\/jobs/i)
  assert.equal(atkinsrealis.companyDomain, 'careers.atkinsrealis.com')
})

test('buildScrapers exposes a runnable AtkinsRealis scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const atkinsrealis = scrapers.find((scraper) => scraper.name === 'atkinsrealis')

  assert.ok(atkinsrealis)
  assert.equal(typeof atkinsrealis.run, 'function')
  assert.match(atkinsrealis.dryRunFile, /atkinsrealis[\\/]jobs\.json$/)
  assert.equal(atkinsrealis.provider.source, 'atkinsrealis')
  assert.equal(atkinsrealis.provider.adapter, 'apiPortal')
})
