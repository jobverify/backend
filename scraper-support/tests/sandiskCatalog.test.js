import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Sandisk as a SmartRecruiters apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sandisk')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.companyCareerPage, 'https://www.sandisk.com/careers/jobs-at-sandisk')
  assert.equal(provider.companyDomain, 'sandisk.com')
  assert.match(provider.config.discovery.listingApiUrl, /api\.smartrecruiters\.com\/v1\/companies\/Sandisk\/postings/i)
  assert.match(provider.config.detail.urlTemplate, /api\.smartrecruiters\.com\/v1\/companies\/Sandisk\/postings\/\{\{jobId\}\}/i)
  assert.equal(provider.config.request.query.country, 'in')
  assert.equal(companyAliases.SanDisk, 'sandisk')
  assert.equal(companyAliases['Western Digital (SanDisk)'], 'sandisk')
})

test('buildScrapers exposes a runnable Sandisk apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sandisk')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sandisk[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'sandisk')
  assert.equal(scraper.provider.atsPlatform, 'smartrecruiters')
})
