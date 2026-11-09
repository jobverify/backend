import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GitBook as an Ashby-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gitbook')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyName, 'GitBook')
  assert.equal(provider.companyCareerPage, 'https://www.gitbook.com/careers')
  assert.equal(provider.companyDomain, 'gitbook.com')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/GitBook')
  assert.equal(
    provider.ashbyJobBoardUrl,
    'https://api.ashbyhq.com/posting-api/job-board/GitBook',
  )
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gitbook\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/GitBook/i)
  assert.match(provider.modulePath, /gitbook[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GitBook scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gitbook')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /gitbook[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'gitbook')
  assert.equal(scraper.provider.atsPlatform, 'ashby')
})
