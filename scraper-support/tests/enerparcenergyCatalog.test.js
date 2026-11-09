import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Enerparc Energy as an official careers no-public-listings scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'enerparcenergy')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://enerparc.in/apply-now/')
  assert.equal(provider.companyDomain, 'enerparc.in')
  assert.match(provider.modulePath, /enerparcenergy[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Enerparc Energy scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'enerparcenergy')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /enerparcenergy[\\/]jobs\.json$/)
})
