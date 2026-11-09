import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Rareminds as an official no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rareminds')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyName, 'Rareminds')
  assert.equal(provider.companyCareerPage, 'https://www.rareminds.in/')
  assert.equal(provider.companyDomain, 'rareminds.in')
  assert.match(provider.modulePath, /rareminds[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Rareminds scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rareminds')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rareminds')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /rareminds[\\/]jobs\.json$/)
})
