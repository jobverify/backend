import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Innova Solutions as a WorkLLama empty-feed scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innovasolutions')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Innova Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workllama')
  assert.equal(provider.companyCareerPage, 'https://innovasolutions.com/careers/')
  assert.equal(provider.companyDomain, 'innovaindia.workllama.com')
  assert.equal(provider.paginationStrategy, 'anonymous-job-posting-page-number')
  assert.equal(provider.extractionStrategy, 'official-careers-page+workllama-anon-job-posting-empty-feed')
  assert.match(provider.modulePath, /innovasolutions[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Innova Solutions scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'innovasolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'workllama')
  assert.match(scraper.dryRunFile, /innovasolutions[\\/]jobs\.json$/i)
})
