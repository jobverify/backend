import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Crompton as an official careers-page scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'crompton')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'shopify-careers-page')
  assert.equal(provider.companyCareerPage, 'https://www.crompton.co.in/pages/careers')
  assert.equal(provider.companyDomain, 'crompton.co.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /crompton[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Crompton scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'crompton')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyName, 'Crompton Greaves Consumer Electricals Limited')
})
