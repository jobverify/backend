import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Revolt is registered against its verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'revolt')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Revolt')
  assert.equal(provider.companyCareerPage, 'https://www.revoltmotors.com/career-with-us')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage+verified-first-party-careers-page+inline-job-cards')
  assert.equal(provider.companyDomain, 'revoltmotors.com')
  assert.equal(companyAliases.Revolt, 'revolt')
  assert.match(provider.modulePath, /revolt[\\/]script\.js$/i)
})

test('Revolt is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'revolt')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /revolt[\\/]jobs\.json$/i)
})
