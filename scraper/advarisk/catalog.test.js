import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('AdvaRisk is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'advarisk')

  assert.ok(provider)
  assert.equal(provider.companyName, 'AdvaRisk')
  assert.equal(provider.companyCareerPage, 'https://advarisk.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-unresolved-controls')
  assert.equal(provider.paginationStrategy, 'current-public-hiring-entry-and-closing-model-with-unknown-vacancy-inventory')
  assert.equal(
    provider.extractionStrategy,
    'active-first-party-identity+hiring-signals+unsupported-role-discovery-retention+unknown-inventory+caller-bounded-audit',
  )
  assert.equal(provider.companyDomain, 'advarisk.com')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.modulePath, /advarisk[\\/]script\.js$/i)
})

test('AdvaRisk is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'advarisk')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /advarisk[\\/]jobs\.json$/)
})
