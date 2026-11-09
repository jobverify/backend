import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Visteon Darwinbox-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'visteon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Visteon Corporation')
  assert.equal(provider.companyCareerPage, 'https://investors.visteon.com/careers/join-us/default.aspx')
  assert.equal(provider.companyDomain, 'investors.visteon.com')
  assert.match(provider.modulePath, /visteon[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Visteon scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'visteon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /visteon[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'visteon')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
})
