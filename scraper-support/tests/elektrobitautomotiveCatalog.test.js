import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Elektrobit Automotive Jibe-backed scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const elektrobit = catalog.find((provider) => provider.source === 'elektrobitautomotive')

  assert.ok(elektrobit)
  assert.equal(elektrobit.adapter, 'script')
  assert.equal(elektrobit.atsPlatform, 'jibe-public-jobs-api')
  assert.equal(elektrobit.companyCareerPage, 'https://www.elektrobit.com/careers/')
  assert.equal(elektrobit.companyDomain, 'elektrobit.com')
  assert.equal(elektrobit.officialJobsSurfaceUrl, 'https://jobs.elektrobit.com/jobs')
  assert.equal(elektrobit.jobsApiUrl, 'https://jobs.elektrobit.com/api/jobs?country=India')
})

test('buildScrapers exposes a runnable Elektrobit Automotive Jibe-backed scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const elektrobit = scrapers.find((scraper) => scraper.name === 'elektrobitautomotive')

  assert.ok(elektrobit)
  assert.equal(typeof elektrobit.run, 'function')
  assert.match(elektrobit.dryRunFile, /elektrobitautomotive[\\/]jobs\.json$/)
  assert.equal(elektrobit.provider.source, 'elektrobitautomotive')
  assert.equal(elektrobit.provider.atsPlatform, 'jibe-public-jobs-api')
})
