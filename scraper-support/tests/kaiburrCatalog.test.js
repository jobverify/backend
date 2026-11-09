import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Kaiburr as an official no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kaiburr')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyName, 'Kaiburr')
  assert.equal(provider.companyCareerPage, 'https://kaiburr.com/')
  assert.equal(provider.companyDomain, 'kaiburr.com')
  assert.match(provider.modulePath, /kaiburr[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Kaiburr scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kaiburr')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kaiburr')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /kaiburr[\\/]jobs\.json$/)
})
