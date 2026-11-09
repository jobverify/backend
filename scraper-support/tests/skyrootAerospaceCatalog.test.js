import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Skyroot Aerospace as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'skyrootaerospace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Skyroot Aerospace')
  assert.equal(provider.companyCareerPage, 'https://www.skyroot.in/careers')
  assert.equal(provider.companyDomain, 'skyroot.in')
  assert.match(provider.modulePath, /skyrootaerospace[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Skyroot Aerospace scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'skyrootaerospace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'skyrootaerospace')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /skyrootaerospace[\\/]jobs\.json$/i)
})
