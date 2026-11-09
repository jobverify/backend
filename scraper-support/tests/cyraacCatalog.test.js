import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('CyRAACS is registered as an official company careers scraper with its CSV aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cyraac')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CYRAAC Services Private Limited')
  assert.equal(provider.companyCareerPage, 'https://cyraacs.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'cyraacs.com')
  assert.equal(companyAliases.CyRAACS, 'cyraac')
  assert.equal(companyAliases.CyRaacs, 'cyraac')
})

test('CyRAACS is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cyraac')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cyraac[\\/]jobs\.json$/)
})
