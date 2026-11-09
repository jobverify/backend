import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tekion as an Ashby apiPortal provider linked from the official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tekion')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyCareerPage, 'https://www.tekion.com/job-openings')
  assert.equal(provider.companyDomain, 'tekion.com')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/tekion')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/tekion')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://api.ashbyhq.com/posting-api/job-board/tekion')
})

test('buildScrapers exposes a runnable Tekion apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tekion')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tekion[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tekion')
  assert.equal(scraper.provider.atsPlatform, 'ashby')
})
