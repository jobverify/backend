import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Allstate on the official job-search page backed by the public JSONP API', () => {
  const catalog = getScraperCatalog()
  const allstate = catalog.find((provider) => provider.source === 'allstate')

  assert.ok(allstate)
  assert.equal(allstate.adapter, 'script')
  assert.equal(allstate.atsPlatform, 'official-company-careers-json-api')
  assert.match(allstate.companyCareerPage, /allstate\.jobs\/job-search-results/i)
  assert.equal(allstate.companyDomain, 'allstate.jobs')
  assert.match(allstate.baseUrl, /allstate\.wd5\.myworkdayjobs\.com\/allstate_careers/i)
  assert.match(allstate.modulePath, /allstate\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Allstate first-party API scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const allstate = scrapers.find((scraper) => scraper.name === 'allstate')

  assert.ok(allstate)
  assert.equal(typeof allstate.run, 'function')
  assert.match(allstate.dryRunFile, /allstate.workday[\\/]jobs\.json$/)
  assert.equal(allstate.provider.source, 'allstate')
  assert.equal(allstate.provider.atsPlatform, 'official-company-careers-json-api')
})
