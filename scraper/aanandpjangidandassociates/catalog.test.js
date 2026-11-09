import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Aanand P Jangid and Associates is registered against its official careers page', () => {
  const provider = getScraperCatalog().find(
    (item) => item.source === 'aanandpjangidandassociates',
  )

  assert.ok(provider)
  assert.equal(provider.companyName, 'Aanand P Jangid and Associates LLP')
  assert.equal(provider.companyCareerPage, 'https://www.ajafirm.com/career.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.extractionStrategy, 'current-openings-job-cards')
  assert.equal(provider.companyDomain, 'ajafirm.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /aanandpjangidandassociates[\\/]script\.js$/i)
})

test('Aanand P Jangid and Associates is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find(
    (item) => item.name === 'aanandpjangidandassociates',
  )

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /aanandpjangidandassociates[\\/]jobs\.json$/)
})
