import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Clarity Benefit Solutions is registered against its official Paylocity careers portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clarity')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Clarity Benefit Solutions')
  assert.equal(
    provider.companyCareerPage,
    'https://recruiting.paylocity.com/recruiting/jobs/All/2ae5a3ce-3398-4774-8bea-215d1adff90f/Clarity-Benefit-Solutions',
  )
  assert.equal(provider.atsPlatform, 'paylocity')
  assert.equal(provider.companyDomain, 'recruiting.paylocity.com')
})

test('Clarity Benefit Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clarity')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /clarity[\\/]jobs\.json$/)
})
