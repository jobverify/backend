import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('AgNext catalog retains its exact official source and runnable dedicated scraper', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'agnext')
  assert.equal(provider.companyName, 'AgNext')
  assert.equal(provider.companyDomain, 'agnext.com')
  assert.equal(provider.countryFilter, 'India')
  assert.match(provider.modulePath, /agnext[\\/]script\.js$/)
  const scraper = buildScrapers().find(entry => entry.name === 'agnext')
  assert.equal(typeof scraper.run, 'function')
})
