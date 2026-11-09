import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Chemfab Alkalis Limited as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chemfabalkalislimited')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Chemfab Alkalis Limited')
  assert.equal(provider.companyCareerPage, 'https://chemfabalkalis.com/careers/')
  assert.equal(provider.companyDomain, 'chemfabalkalis.com')
  assert.match(provider.modulePath, /chemfabalkalislimited[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Chemfab Alkalis Limited scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chemfabalkalislimited')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chemfabalkalislimited')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /chemfabalkalislimited[\\/]jobs\.json$/i)
})
