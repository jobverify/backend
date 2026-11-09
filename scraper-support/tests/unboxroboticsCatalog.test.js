import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Unbox Robotics as a Keka-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'unboxrobotics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.companyName, 'Unbox Robotics')
  assert.equal(provider.companyCareerPage, 'https://unboxrobotics.keka.com/careers')
  assert.equal(provider.companyDomain, 'unboxrobotics.com')
  assert.match(provider.modulePath, /unboxrobotics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Unbox Robotics scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'unboxrobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'unboxrobotics')
  assert.equal(scraper.provider.atsPlatform, 'keka-embed-api')
  assert.match(scraper.dryRunFile, /unboxrobotics[\\/]jobs\.json$/)
})
