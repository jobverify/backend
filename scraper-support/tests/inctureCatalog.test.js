import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Incture as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'incture')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Incture')
  assert.equal(provider.companyCareerPage, 'https://incture.zohorecruit.com/jobs/Careers')
  assert.equal(provider.companyDomain, 'incture.zohorecruit.com')
  assert.match(provider.modulePath, /incture[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Incture scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'incture')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'incture')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /incture[\\/]jobs\.json$/)
})
