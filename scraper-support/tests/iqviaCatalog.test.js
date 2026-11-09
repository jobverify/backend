import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes IQVIA as an official Workday-branded script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iqvia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday-branded-site')
  assert.equal(provider.companyName, 'IQVIA')
  assert.equal(provider.companyCareerPage, 'https://jobs.iqvia.com/en/jobs')
  assert.equal(provider.companyDomain, 'jobs.iqvia.com')
  assert.match(provider.modulePath, /iqvia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IQVIA scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iqvia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iqvia')
  assert.equal(scraper.provider.atsPlatform, 'workday-branded-site')
  assert.match(scraper.dryRunFile, /iqvia[\\/]jobs\.json$/)
})
