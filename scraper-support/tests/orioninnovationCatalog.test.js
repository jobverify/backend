import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Orion Innovation as a verified blocked-route sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'orioninnovation')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Orion Innovation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.orioninnovation.com/careers/life-at-orion/')
  assert.equal(provider.openJobsPageUrl, 'https://www.orioninnovation.com/careers/job/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-blocked-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-cloudflare-403-careers-routes-return-empty',
  )
  assert.equal(provider.companyDomain, 'orioninnovation.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /life-at-orion/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\/job/i)
  assert.match(provider.verifiedSurfaceSummary, /gh_jid/i)
  assert.match(provider.modulePath, /orioninnovation[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Orion Innovation without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'orioninnovation')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'orioninnovation')
  assert.match(scraper.dryRunFile, /orioninnovation[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Orion Innovation,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Orion Innovation', 'orioninnovation', 'Orion Innovation']],
  )
})
