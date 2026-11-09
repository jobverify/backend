import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes BCE Global Tech as a Zoho Recruit API-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bceglobaltech')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zoho-recruit-api')
  assert.equal(provider.companyName, 'BCE Global Tech')
  assert.equal(provider.companyCareerPage, 'https://bceglobaltech.com/career')
  assert.equal(provider.companyDomain, 'bceglobaltech.com')
  assert.match(provider.modulePath, /bceglobaltech[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable BCE Global Tech scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bceglobaltech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bceglobaltech[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bceglobaltech')
  assert.equal(scraper.provider.atsPlatform, 'zoho-recruit-api')
})
