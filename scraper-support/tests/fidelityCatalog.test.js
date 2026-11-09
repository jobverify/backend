import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Fidelity as an official careers feed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'fidelity')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://jobs.fidelity.com/in/jobs/')
  assert.equal(provider.companyDomain, 'fidelity.com')
  assert.match(provider.modulePath, /fidelity[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Fidelity scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'fidelity')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /fidelity[\\/]jobs\.json$/)
})
