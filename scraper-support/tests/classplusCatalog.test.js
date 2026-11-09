import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Classplus is registered against its official public jobs surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'classplus')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Classplus')
  assert.equal(provider.companyCareerPage, 'https://classplusapp.com/careers/open-role')
  assert.equal(provider.atsPlatform, 'official-first-party-public-jobs-api')
  assert.equal(provider.paginationStrategy, 'single-public-api-response')
  assert.equal(provider.extractionStrategy, 'official-careers-page+public-jobs-api')
  assert.equal(provider.companyDomain, 'classplusapp.com')
  assert.match(provider.modulePath, /classplus[\\/]script\.js$/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
})

test('Classplus is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'classplus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /classplus[\\/]jobs\.json$/)
})
