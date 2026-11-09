import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, buildScrapers } from '../providers/index.js'

test('Katalon remains an exact company dedicated script with India filtering', () => {
  const provider = getScraperCatalog().find(item => item.source === 'katalon')
  assert.equal(provider.companyName, 'Katalon')
  assert.equal(provider.companyDomain, 'katalon.com')
  assert.equal(provider.countryFilter, 'India')
  assert.match(provider.modulePath, /katalon[\\/]script\.js$/)
  assert.equal(typeof buildScrapers().find(item => item.name === 'katalon').run, 'function')
})
