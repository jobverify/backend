import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes UiPath as an Ashby-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'uipath')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyName, 'UiPath')
  assert.equal(provider.companyCareerPage, 'https://www.uipath.com/careers/jobs')
  assert.equal(provider.companyDomain, 'uipath.com')
  assert.match(provider.modulePath, /uipath[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable UiPath scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'uipath')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /uipath[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'uipath')
  assert.equal(scraper.provider.atsPlatform, 'ashby')
})
