import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes IFB Industries as a first-party GraphQL careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ifbindustries')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IFB Industries')
  assert.equal(provider.companyCareerPage, 'https://www.ifbappliances.com/career-jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-graphql-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+first-party-adobe-graphql-careerlist',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ifbappliances.com')
  assert.match(provider.modulePath, /ifbindustries[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IFB Industries scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ifbindustries')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ifbindustries')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ifbappliances.com/career-jobs')
  assert.match(scraper.dryRunFile, /ifbindustries[\\/]jobs\.json$/i)
})
