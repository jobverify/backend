import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Uptiq.ai as a verified first-party role-card script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'uptiqai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Uptiq.ai')
  assert.equal(provider.companyCareerPage, 'https://www.uptiq.ai/careers')
  assert.equal(provider.companyDomain, 'uptiq.ai')
  assert.match(provider.modulePath, /uptiqai[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Uptiq.ai scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'uptiqai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'uptiqai')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /uptiqai[\\/]jobs\.json$/i)
})
