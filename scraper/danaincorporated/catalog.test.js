import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Dana Incorporated is registered against its official public jobs page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'danaincorporated')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Dana Incorporated')
  assert.equal(provider.companyCareerPage, 'https://jobs.dana.com/go/View-All-Jobs/9152900/')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyDomain, 'jobs.dana.com')
  assert.equal(companyAliases.Dana, 'danaincorporated')
})

test('Dana Incorporated is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'danaincorporated')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /danaincorporated[\\/]jobs\.json$/)
})
