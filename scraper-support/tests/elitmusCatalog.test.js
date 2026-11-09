import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes eLitmus as a first-party HTML jobs script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'elitmus')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-elitmus-jobs')
  assert.equal(provider.companyName, 'eLitmus Evaluation Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.elitmus.com/jobs?experience_category=all')
  assert.equal(provider.companyDomain, 'elitmus.com')
  assert.match(provider.modulePath, /elitmus[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable eLitmus scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'elitmus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /elitmus[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'elitmus')
  assert.equal(scraper.provider.atsPlatform, 'official-elitmus-jobs')
})
