import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, buildScrapers } from '../providers/index.js'

test('Pixis remains bound to the exact first-party company and dedicated scraper', () => {
  const provider = getScraperCatalog().find(item => item.source === 'pixis')
  assert.equal(provider.companyName, 'Pixis')
  assert.equal(provider.companyDomain, 'pixis.ai')
  assert.equal(provider.countryFilter, 'India')
  assert.match(provider.modulePath, /pixis[\\/]script\.js$/)
  assert.equal(typeof buildScrapers().find(item => item.name === 'pixis').run, 'function')
})
