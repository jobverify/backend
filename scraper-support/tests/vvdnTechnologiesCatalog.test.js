import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes VVDN Technologies as an official apply-only zero-jobs scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vvdntechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'VVDN Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.vvdntech.com/careers/')
  assert.equal(provider.companyDomain, 'vvdntech.com')
  assert.match(provider.modulePath, /vvdntechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable VVDN Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'vvdntechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vvdntechnologies')
  assert.equal(scraper.provider.companyName, 'VVDN Technologies')
  assert.match(scraper.dryRunFile, /vvdntechnologies[\\/]jobs\.json$/i)
})
