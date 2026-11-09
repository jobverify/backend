import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Grafana Labs is registered against its verified first-party careers page and Greenhouse feed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'grafanalabs')

  assert.ok(provider, 'Expected Grafana Labs provider to be registered in apiPortalProviders.json')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.companyName, 'Grafana Labs')
  assert.equal(provider.companyCareerPage, 'https://grafana.com/careers/')
  assert.equal(provider.companyDomain, 'grafana.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'api')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.verifiedSurfaceSummary,
    'Verified on Saturday, July 25, 2026 that https://grafana.com/careers/ is the live first-party Grafana Labs careers page, that it visibly promotes "Explore open roles", and that it hands candidates to the official Greenhouse board at https://job-boards.greenhouse.io/grafanalabs. The public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/grafanalabs/jobs?content=true was reachable and returned 131 live Grafana Labs openings on the verified date, but none matched India location signals; the only APAC listings observed were Japan (Remote) and Singapore (Remote). This provider therefore uses the trusted first-party Greenhouse feed and currently returns a verified zero-openings result for India.',
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Grafana Labs'), false)
})

test('Grafana Labs matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Grafana Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Grafana Labs', 'grafanalabs', 'Grafana Labs']],
  )
})

test('Grafana Labs is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'grafanalabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the Grafana Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'grafanalabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://grafana.com/careers/')
  assert.match(scraper.dryRunFile, /grafanalabs[\\/]jobs\.json$/i)
})
