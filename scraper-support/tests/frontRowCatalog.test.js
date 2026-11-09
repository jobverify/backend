import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes FrontRow as a verified Medium-blocked no-public-careers sentinel on Thursday, August 13, 2026', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'frontrow')

  assert.ok(provider)
  assert.equal(provider.companyName, 'FrontRow')
  assert.equal(provider.companyCareerPage, 'https://frontrow.co.in/')
  assert.equal(provider.shutdownUpdateUrl, 'https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(provider.verifiedSurfaceSummary, /medium\.com/i)
})

test('buildScrapers exposes a runnable FrontRow sentinel scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'frontrow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyCareerPage, 'https://frontrow.co.in/')
})
