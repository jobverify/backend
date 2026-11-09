import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Finolex current native queries without stale verified zero counts', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'finolexindustrieslimited')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'first-party-declared-vacancy-query')
  assert.equal(provider.companyName, 'Finolex Industries Limited')
  assert.equal(provider.companyCareerPage, 'https://www.finolexpipes.com/career/')
  assert.equal(provider.companyDomain, 'finolexpipes.com')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.officialCareersEmail, 'career@finolexind.com')
  assert.match(provider.verifiedSurfaceSummary, /read-only POST Activity=joblist/i)
  assert.match(provider.modulePath, /finolexindustrieslimited[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Finolex Industries Limited scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'finolexindustrieslimited')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'finolexindustrieslimited')
  assert.equal(scraper.provider.atsPlatform, 'first-party-declared-vacancy-query')
  assert.match(scraper.dryRunFile, /finolexindustrieslimited[\\/]jobs\.json$/)
})
