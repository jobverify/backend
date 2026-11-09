import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Noise is registered with its first-party Freshteam careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'noise')
  assert.ok(provider)
  assert.equal(provider.companyName, 'Noise')
  assert.equal(provider.companyCareerPage, 'https://gonoise.freshteam.com/jobs')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.companyDomain, 'gonoise.com')
})

test('Noise resolves to a runnable script provider', () => {
  const scraper = buildScrapers().find((item) => item.name === 'noise')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /noise[\\/]jobs\.json$/i)
})
