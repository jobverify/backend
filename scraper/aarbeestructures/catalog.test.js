import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Aarbee Structures is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aarbeestructures')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Aarbee Structures Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://aarbeestructures.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-application-intake')
  assert.equal(provider.companyDomain, 'aarbeestructures.com')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-client-and-handoff+native-context-retention+executable-script-structure+unknown-inventory+bounded-caller-observer',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.modulePath, /aarbeestructures[\\/]script\.js$/i)
})

test('Aarbee Structures is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'aarbeestructures')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /aarbeestructures[\\/]jobs\.json$/)
})
