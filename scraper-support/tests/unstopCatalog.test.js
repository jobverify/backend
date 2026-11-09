import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Unstop is registered as a script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'unstop')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Unstop')
  assert.equal(provider.companyCareerPage, 'https://unstop.com/about/unstop-careers/amp')
  assert.equal(provider.companyDomain, 'unstop.com')
  assert.match(provider.modulePath, /unstop[\\/]script\.js$/i)
  assert.ok(buildScrapers().some((scraper) => scraper.name === 'unstop'))
})

