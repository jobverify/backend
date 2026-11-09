import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Baxter India scraper with TalentBrew metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'baxter')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.match(provider.companyCareerPage, /jobs\.baxter\.com\/en\/search-jobs\/india/i)
})

test('buildScrapers exposes a runnable Baxter scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'baxter')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /baxter[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'baxter')
})
