import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Kissflow provider metadata captures the current two-role first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kissflow')

  assert.ok(provider)
  assert.equal(provider.companyCareerPage, 'https://careers.kissflow.com/')
  assert.equal(provider.companyDomain, 'kissflow.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /2 public role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Solution Advisor/i)
  assert.match(provider.verifiedSurfaceSummary, /Client Director/i)
})

test('Kissflow is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kissflow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /kissflow[\\/]jobs\.json$/)
})
