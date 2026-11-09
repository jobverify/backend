import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes R Systems as a public Zwayam script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rsystems')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.companyName, 'R Systems')
  assert.equal(provider.companyCareerPage, 'https://careers.rsystems.com/rsystems/')
  assert.equal(provider.companyDomain, 'careers.rsystems.com')
  assert.match(provider.modulePath, /rsystems[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable R Systems scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rsystems')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rsystems')
  assert.equal(scraper.provider.atsPlatform, 'zwayam')
  assert.match(scraper.dryRunFile, /rsystems[\\/]jobs\.json$/)
})
