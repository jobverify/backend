import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Cyware with its official careers API metadata', () => {
  const cyware = getScraperCatalog().find((provider) => provider.source === 'cyware')

  assert.ok(cyware)
  assert.equal(cyware.adapter, 'script')
  assert.equal(cyware.atsPlatform, 'zohorecruit')
  assert.equal(cyware.companyCareerPage, 'https://www.cyware.com/careers')
  assert.equal(cyware.companyDomain, 'cyware.com')
  assert.equal(cyware.extractionStrategy, 'first-party-careers-api+zoho-application-url')
  assert.match(cyware.modulePath, /cyware[\\/]script\.js$/i)
})

test('buildScrapers exposes Cyware as a runnable script scraper', () => {
  const cyware = buildScrapers().find((scraper) => scraper.name === 'cyware')

  assert.ok(cyware)
  assert.equal(typeof cyware.run, 'function')
  assert.equal(cyware.provider.parser, 'custom-script')
  assert.match(cyware.dryRunFile, /cyware[\\/]jobs\.json$/)
})
