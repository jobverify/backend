import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes BorgWarner with its India-filtered careers metadata', () => {
  const catalog = getScraperCatalog()
  const borgwarner = catalog.find((provider) => provider.source === 'borgwarner')

  assert.ok(borgwarner)
  assert.equal(borgwarner.adapter, 'script')
  assert.equal(borgwarner.atsPlatform, 'borgwarner-sitefinity-job-search')
  assert.equal(borgwarner.companyCareerPage, 'https://www.borgwarner.com/careers/job-search?country=india')
  assert.equal(borgwarner.companyDomain, 'borgwarner.com')
})

test('buildScrapers exposes a runnable BorgWarner scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const borgwarner = scrapers.find((scraper) => scraper.name === 'borgwarner')

  assert.ok(borgwarner)
  assert.equal(typeof borgwarner.run, 'function')
  assert.match(borgwarner.dryRunFile, /borgwarner[\\/]jobs\.json$/)
  assert.equal(borgwarner.provider.source, 'borgwarner')
  assert.equal(borgwarner.provider.adapter, 'script')
})
