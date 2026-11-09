import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Aadyah Aerospace is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aadyahaerospace')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Aadyah Aerospace Pvt.Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.aadyah.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-public-cms-incomplete')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.companyDomain, 'aadyah.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /aadyahaerospace[\\/]script\.js$/i)
})

test('Aadyah Aerospace is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'aadyahaerospace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /aadyahaerospace[\\/]jobs\.json$/)
})
