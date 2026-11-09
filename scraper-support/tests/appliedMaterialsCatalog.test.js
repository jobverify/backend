import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Applied Materials Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const appliedMaterials = catalog.find((provider) => provider.source === 'appliedmaterials')

  assert.ok(appliedMaterials)
  assert.equal(appliedMaterials.adapter, 'apiPortal')
  assert.equal(appliedMaterials.atsPlatform, 'eightfold')
  assert.match(appliedMaterials.companyCareerPage, /careers\.appliedmaterials\.com\/careers/i)
  assert.equal(appliedMaterials.companyDomain, 'careers.appliedmaterials.com')
  assert.match(appliedMaterials.config.discovery.listingApiUrl, /careers\.appliedmaterials\.com\/api\/pcsx\/search/i)
})

test('buildScrapers exposes a runnable Applied Materials apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const appliedMaterials = scrapers.find((scraper) => scraper.name === 'appliedmaterials')

  assert.ok(appliedMaterials)
  assert.equal(typeof appliedMaterials.run, 'function')
  assert.match(appliedMaterials.dryRunFile, /appliedmaterials[\\/]jobs\.json$/)
  assert.equal(appliedMaterials.provider.source, 'appliedmaterials')
  assert.equal(appliedMaterials.provider.atsPlatform, 'eightfold')
})
