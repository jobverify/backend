import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Skanray Technologies as a first-party script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'skanraytechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Skanray Technologies')
  assert.equal(provider.companyCareerPage, 'https://skanray.com/forms/')
  assert.equal(provider.companyDomain, 'skanray.com')
  assert.match(provider.modulePath, /skanraytechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Skanray Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'skanraytechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'skanraytechnologies')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /skanraytechnologies[\\/]jobs\.json$/i)
})
