import test from 'node:test'
import assert from 'node:assert/strict'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Abans selects the native group reader without asserting exhaustive Holdings scope or publication counts', () => {
  const catalog = getScraperCatalog(), matches = catalog.filter(row => row.source === 'abansholdings')
  assert.equal(matches.length, 1)
  const [provider] = matches
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.currentNativePublisher, 'ABANS GROUP')
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.modulePath, /abansholdings\.workday[\\/]script\.js$/)
})
