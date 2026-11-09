import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ittiam Systems is registered against its official careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ittiamsystems')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ittiam Systems')
  assert.equal(provider.companyCareerPage, 'https://www.ittiam.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-wp-json-page')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-page+wp-json-shortcode-current-opportunities')
  assert.equal(provider.companyDomain, 'ittiam.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /ittiamsystems[\\/]script\.js$/i)
})

test('Ittiam Systems is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ittiamsystems')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ittiamsystems')
  assert.equal(scraper.provider.companyDomain, 'ittiam.com')
  assert.match(scraper.dryRunFile, /ittiamsystems[\\/]jobs\.json$/i)
})
