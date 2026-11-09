import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes embedUR as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'embedur')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'embedUR')
  assert.equal(provider.companyCareerPage, 'https://embedur.zohorecruit.in/jobs/Careers')
  assert.equal(provider.companyDomain, 'embedur.zohorecruit.in')
  assert.match(provider.modulePath, /embedur[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable embedUR scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'embedur')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'embedur')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /embedur[\\/]jobs\.json$/)
})
