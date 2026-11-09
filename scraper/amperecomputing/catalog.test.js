import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Ampere Computing is registered against its official careers search page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amperecomputing')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ampere Computing')
  assert.equal(provider.homepageUrl, 'https://careers.amperecomputing.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.amperecomputing.com/search/jobs')
  assert.equal(provider.officialIndiaSearchResultsUrl, 'https://careers.amperecomputing.com/search/jobs/in/country/india')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.extractionStrategy, /full-native-json-pagination/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.equal(provider.companyDomain, 'amperecomputing.com')
  assert.equal(companyAliases['Ampere Computing'], 'amperecomputing')
})

test('Ampere Computing is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'amperecomputing')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /amperecomputing[\\/]jobs\.json$/)
})
