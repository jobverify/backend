import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes BuildNext as an official WordPress job-manager script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'buildnext')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wordpress-job-manager')
  assert.equal(provider.companyName, 'BuildNext Construction Solutions (P) Ltd')
  assert.equal(provider.companyCareerPage, 'https://careers.buildnext.in/jobs/')
  assert.equal(provider.companyDomain, 'careers.buildnext.in')
  assert.match(provider.modulePath, /buildnext[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable BuildNext scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'buildnext')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /buildnext[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'buildnext')
  assert.equal(scraper.provider.atsPlatform, 'wordpress-job-manager')
})
