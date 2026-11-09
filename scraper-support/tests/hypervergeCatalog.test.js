import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('HyperVerge is registered as an official company careers scraper with exact aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hyperverge')

  assert.ok(provider)
  assert.equal(provider.companyName, 'HyperVerge')
  assert.equal(provider.companyCareerPage, 'https://hyperverge.co/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'hyperverge.co')
  assert.equal(companyAliases.HyperVerge, 'hyperverge')
  assert.equal(companyAliases.Hyperverge, 'hyperverge')
})

test('HyperVerge is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hyperverge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /hyperverge[\\/]jobs\.json$/)
})
