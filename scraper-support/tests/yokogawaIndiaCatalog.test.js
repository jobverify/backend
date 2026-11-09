import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Yokogawa India on the official careers page with a Workday handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yokogawaindia')

  assert.ok(provider, 'Expected Yokogawa India provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Yokogawa India Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.yokogawa.com/in/about/currentopenings/')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-page-plus-workday-jobs-api')
  assert.equal(provider.extractionStrategy, 'verified-workday-board+workday-jobs-api+workday-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'yokogawa.com')
  assert.equal(
    provider.workdayBoardUrl,
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://wd3.myworkdaysite.com/wday/cxs/yokogawa/yokogawa-career-site/jobs',
  )
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 81)
  assert.equal(provider.verifiedIndiaJobCount, 81)
  assert.match(provider.modulePath, /yokogawaindia\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Yokogawa India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'yokogawaindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Yokogawa India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yokogawaindia')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /yokogawaindia.workday[\\/]jobs\.json$/i)
})
