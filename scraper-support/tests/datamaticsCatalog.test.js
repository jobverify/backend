import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Datamatics with official careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datamatics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.datamatics.com/human-resources/job-openings')
  assert.equal(provider.companyDomain, 'datamatics.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /datamatics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Datamatics scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datamatics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyName, 'Datamatics Global Services Limited')
})
