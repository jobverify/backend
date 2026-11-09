import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Spaulding Ridge is registered against the verified Cloudflare-blocked first-party routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'spauldingridge')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Spaulding Ridge')
  assert.equal(provider.companyCareerPage, 'https://spauldingridge.com/about-us/careers')
  assert.equal(provider.blockedOpenPositionsPageUrl, 'https://spauldingridge.com/about-us/open-positions')
  assert.equal(provider.atsPlatform, 'official-company-careers-blocked-by-cloudflare')
  assert.equal(provider.paginationStrategy, 'verified-cloudflare-blocked-careers-and-open-positions-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-cloudflare-blocked-careers-route+verified-cloudflare-blocked-open-positions-route-return-empty',
  )
  assert.equal(provider.companyDomain, 'spauldingridge.com')
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(provider.verifiedSurfaceSummary, /blocked/i)
}
)

test('Spaulding Ridge exact backlog row still resolves through the provider catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'spauldingridge')
  const report = generateCompanyCoverageReport({
    csvText: 'Spaulding Ridge\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Spaulding Ridge is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'spauldingridge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /spauldingridge[\\/]jobs\.json$/)
})
