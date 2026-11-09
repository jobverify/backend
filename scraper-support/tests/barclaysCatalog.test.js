import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Barclays India scraper with TalentBrew metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'barclays')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.match(provider.companyCareerPage, /search\.jobs\.barclays\/search-jobs\/india/i)
})

test('buildScrapers exposes a runnable Barclays scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'barclays')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /barclays[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'barclays')
})
