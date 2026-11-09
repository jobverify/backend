import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Ruckus Networks as a SuccessFactors-backed branded script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ruckusnetworks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyName, 'Ruckus Networks')
  assert.equal(provider.companyCareerPage, 'https://jobs.vistancenetworks.com/go/RUCKUS-Jobs/9892600/')
  assert.equal(provider.companyDomain, 'jobs.vistancenetworks.com')
  assert.equal(
    provider.extractionStrategy,
    'successfactors-category-page+tile-more-results+detail-pages',
  )
  assert.match(provider.modulePath, /ruckusnetworks[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ruckus Networks scraper and exact-company aliases map to it', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ruckusnetworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ruckusnetworks[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'ruckusnetworks')
  assert.equal(companyAliases['Ruckus Networks'], 'ruckusnetworks')
  assert.equal(companyAliases['RUCKUS Networks'], 'ruckusnetworks')
})
