import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Indegene as an official SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indegene')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Indegene')
  assert.equal(provider.companyCareerPage, 'https://careers.indegene.com/')
  assert.equal(provider.companyDomain, 'careers.indegene.com')
  assert.match(provider.modulePath, /indegene[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Indegene scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indegene')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indegene')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
  assert.match(scraper.dryRunFile, /indegene[\\/]jobs\.json$/)
})
