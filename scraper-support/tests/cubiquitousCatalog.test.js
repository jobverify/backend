import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Cubiquitous is registered as an official-site zero-job scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cubiquitous')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Cubiquitous Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.cubiquitous.in/')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyDomain, 'cubiquitous.in')
  assert.equal(companyAliases.Cubiquitous, 'cubiquitous')
})

test('Cubiquitous is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cubiquitous')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cubiquitous[\\/]jobs\.json$/)
})
