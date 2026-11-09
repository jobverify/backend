import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sahaj AI with its current verified Greenhouse feed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sahajai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(provider.companyName, 'Sahaj AI')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://sahaj.ai/careers/')
  assert.equal(provider.companyDomain, 'sahaj.ai')
  assert.equal(provider.boardToken, 'sahajsoftware')
  assert.equal(provider.runtimeInventoryVerification.mode, 'role-links-exact')
})

test('buildScrapers exposes a runnable Sahaj AI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sahajai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sahajai')
  assert.match(scraper.dryRunFile, /sahajai[\\/]jobs\.json$/i)
})
