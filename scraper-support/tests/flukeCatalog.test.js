import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Fluke as an Eightfold apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'fluke')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'Fluke')
  assert.equal(provider.companyDomain, 'fortive.eightfold.ai')
  assert.match(provider.companyCareerPage, /fortive\.eightfold\.ai\/careers/i)
  assert.match(provider.config.discovery.listingApiUrl, /fortive\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'fortive.com')
  assert.equal(provider.config.request.query.location, 'India')
  assert.equal(provider.config.request.query.sort_by, 'relevance')
  assert.equal(provider.config.request.query.filter_operating_company, 'fluke')
  assert.equal(companyAliases['Fluke IDC'], 'fluke')
})

test('buildScrapers exposes a runnable Fluke apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'fluke')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /fluke[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'fluke')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})
