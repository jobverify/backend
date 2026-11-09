import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes NielsenIQ as a SmartRecruiters apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nielseniq')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.companyCareerPage, 'https://nielseniq.com/global/en/jobs/')
  assert.equal(provider.companyDomain, 'nielseniq.com')
  assert.match(provider.config.discovery.listingApiUrl, /api\.smartrecruiters\.com\/v1\/companies\/NielsenIQ\/postings/i)
  assert.match(provider.config.detail.urlTemplate, /api\.smartrecruiters\.com\/v1\/companies\/NielsenIQ\/postings\/\{\{jobId\}\}/i)
  assert.equal(companyAliases.NIQ, 'nielseniq')
  assert.equal(companyAliases.NielsenlQ, 'nielseniq')
})

test('buildScrapers exposes a runnable NielsenIQ apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nielseniq')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nielseniq[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'nielseniq')
  assert.equal(scraper.provider.atsPlatform, 'smartrecruiters')
})
