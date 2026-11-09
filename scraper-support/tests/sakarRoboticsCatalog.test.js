import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sakar Robotics as an official Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sakarrobotics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Sakar Robotics')
  assert.equal(provider.companyCareerPage, 'https://www.sakarrobotics.com/company/careers')
  assert.equal(provider.companyDomain, 'sakarrobotics.com')
  assert.match(provider.modulePath, /sakarrobotics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sakar Robotics scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sakarrobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sakarrobotics')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /sakarrobotics[\\/]jobs\.json$/i)
})
