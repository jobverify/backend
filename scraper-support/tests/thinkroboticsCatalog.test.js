import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ThinkRobotics as an official Zoho careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'thinkrobotics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyName, 'Atlantis Robotics Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://jobs.thinkrobotics.com/jobs/Careers')
  assert.equal(provider.companyDomain, 'thinkrobotics.com')
  assert.match(provider.modulePath, /thinkrobotics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ThinkRobotics scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'thinkrobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'thinkrobotics')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /thinkrobotics[\\/]jobs\.json$/i)
})
