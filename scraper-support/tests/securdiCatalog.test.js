import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SecurDI as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'securdi')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'SecurDI')
  assert.equal(provider.companyCareerPage, 'https://securdi.com/careers/')
  assert.equal(provider.companyDomain, 'securdi.com')
  assert.match(provider.modulePath, /securdi[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable SecurDI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'securdi')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'securdi')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /securdi[\\/]jobs\.json$/i)
})
