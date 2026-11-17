import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Contlo as an official successor-domain zero-job scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'contlo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'outrely')
  assert.equal(provider.paginationStrategy, 'declared-native-workspace-full-inventory-own-role-and-application-model-opening-closing-reconciliation')
  assert.equal(provider.extractionStrategy, 'current-first-party-careers+whole-declared-Outrely-native-client+full-own-role-schema-criteria-form-and-hydration')
  assert.equal(provider.companyCareerPage, 'https://contlo.com/careers')
  assert.equal(provider.companyDomain, 'contlo.com')
  assert.match(provider.modulePath, /contlo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Contlo scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'contlo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})
