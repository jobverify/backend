import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Indium Software as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indiumsoftware')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Indium Software')
  assert.equal(provider.companyCareerPage, 'https://indiumsoft.zohorecruit.com/jobs/Careers')
  assert.equal(provider.companyDomain, 'indiumsoft.zohorecruit.com')
  assert.match(provider.modulePath, /indiumsoftware[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Indium Software scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indiumsoftware')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indiumsoftware')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /indiumsoftware[\\/]jobs\.json$/)
})
