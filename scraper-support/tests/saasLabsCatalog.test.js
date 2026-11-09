import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('SaaS Labs is registered against its first-party Kula careers handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'saaslabs')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SaaS Labs')
  assert.equal(provider.companyCareerPage, 'https://careers.kula.ai/saas-labs')
  assert.equal(provider.atsPlatform, 'kula')
  assert.equal(provider.companyDomain, 'saaslabs.co')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /saaslabs[\\/]script\.js$/i)
})

test('SaaS Labs is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'saaslabs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /saaslabs[\\/]jobs\.json$/)
})

