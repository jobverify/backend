import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog binds HSBC Technology India to the current public classic portal reader', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hsbctechnologyindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'eightfold-classic')
  assert.equal(provider.companyCareerPage, 'https://www.hsbc.com/careers/find-a-job')
  assert.equal(provider.companyDomain, 'hsbc.com')
  assert.match(provider.modulePath, /hsbctechnologyindia[\\/]script\.js$/)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})

test('buildScrapers exposes a runnable HSBC Technology India source without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hsbctechnologyindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hsbctechnologyindia[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'hsbctechnologyindia')
  assert.equal(scraper.provider.atsPlatform, 'eightfold-classic')
})
