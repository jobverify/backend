import test from 'node:test'
import assert from 'node:assert/strict'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Aavas selects the bounded first-party native reader without invented publication or whole-company counts', () => {
  const matches = getScraperCatalog().filter(row => row.source === 'aavasfinanciers')
  assert.equal(matches.length, 1)
  const [provider] = matches
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'first-party-native-careers')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.modulePath, /aavasfinanciers\.workday[\\/]script\.js$/)
})
