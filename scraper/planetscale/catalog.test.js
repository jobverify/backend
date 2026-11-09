import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('PlanetScale is registered against its verified first-party careers page and Greenhouse feed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'planetscale')

  assert.ok(provider, 'Expected PlanetScale provider to be registered in apiPortalProviders.json')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.companyName, 'PlanetScale')
  assert.equal(provider.companyCareerPage, 'https://planetscale.com/careers')
  assert.equal(provider.companyDomain, 'planetscale.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'api')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(
    provider.config?.discovery?.listingApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/planetscale/jobs',
  )
  assert.deepEqual(provider.config?.request?.query, { content: 'true' })
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/planetscale\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Current openings/i)
  assert.match(provider.verifiedSurfaceSummary, /job-boards\.greenhouse\.io\/planetscale/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PlanetScale'), false)
})

test('PlanetScale matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PlanetScale,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PlanetScale', 'planetscale', 'PlanetScale']],
  )
})

test('PlanetScale is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'planetscale')

  assert.ok(scraper, 'Expected buildScrapers() to return the PlanetScale scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'planetscale')
  assert.equal(scraper.provider.companyCareerPage, 'https://planetscale.com/careers')
  assert.match(scraper.dryRunFile, /planetscale[\\/]jobs\.json$/i)
})
