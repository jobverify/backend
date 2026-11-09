import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Aeroin SpaceTech is registered against its official site', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aeroinspacetech')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Aeroin SpaceTech')
  assert.equal(provider.companyCareerPage, 'https://www.aeroin.space/')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.paginationStrategy, 'single-public-homepage')
  assert.equal(provider.extractionStrategy, 'official-site-no-public-job-listings')
  assert.equal(provider.companyDomain, 'aeroin.space')
  assert.match(provider.modulePath, /aeroinspacetech[\\/]script\.js$/i)
})

test('Aeroin SpaceTech is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'aeroinspacetech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /aeroinspacetech[\\/]jobs\.json$/)
})
