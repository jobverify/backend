import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Securin India Pvt Ltd as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'securinindiapvtltd')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Securin India Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.securin.io/')
  assert.equal(provider.companyDomain, 'securin.io')
  assert.match(provider.modulePath, /securinindiapvtltd[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Securin India Pvt Ltd scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'securinindiapvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'securinindiapvtltd')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /securinindiapvtltd[\\/]jobs\.json$/i)
})
