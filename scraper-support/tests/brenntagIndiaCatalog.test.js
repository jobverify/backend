import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Brenntag India on the official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brenntagindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Brenntag India')
  assert.equal(provider.companyCareerPage, 'https://www.brenntag.com/en-in/career/')
  assert.equal(provider.companyDomain, 'brenntag.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.baseUrl, 'https://brenntag.wd3.myworkdayjobs.com/brenntag_jobs')
})

test('buildScrapers exposes a runnable Brenntag India Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'brenntagindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /brenntagindia.workday[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'brenntagindia')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})
