import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cloudera as a Workday provider wired to its public careers page', () => {
  const catalog = getScraperCatalog()
  const cloudera = catalog.find((provider) => provider.source === 'cloudera')

  assert.ok(cloudera)
  assert.equal(cloudera.adapter, 'script')
  assert.equal(cloudera.atsPlatform, 'workday')
  assert.match(cloudera.companyCareerPage, /cloudera\.com\/careers\.html/i)
  assert.equal(cloudera.companyDomain, 'cloudera.com')
  assert.match(cloudera.baseUrl, /cloudera\.wd5\.myworkdayjobs\.com\/External_Career/i)
})

test('buildScrapers exposes a runnable Cloudera Workday scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cloudera = scrapers.find((scraper) => scraper.name === 'cloudera')

  assert.ok(cloudera)
  assert.equal(typeof cloudera.run, 'function')
  assert.match(cloudera.dryRunFile, /cloudera.workday[\\/]jobs\.json$/)
  assert.equal(cloudera.provider.source, 'cloudera')
  assert.equal(cloudera.provider.companyDomain, 'cloudera.com')
})
