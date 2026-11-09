import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog registers MoEngage with its current official public Kula board', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'moengage')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'kula-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.moengage.com/careers/')
  assert.equal(provider.companyDomain, 'moengage.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /moengage[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable MoEngage scraper', () => {
  const provider = buildScrapers().find((scraper) => scraper.name === 'moengage')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.moengage.com/careers/')
})
