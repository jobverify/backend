import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Blue Star Infotech as a verified redirect-shell no-public-jobs sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bluestarinfotech')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Blue Star Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.bsil.com/careers')
  assert.equal(provider.companyDomain, 'bsil.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-jobs-and-lander-redirect-validation')
  assert.equal(provider.extractionStrategy, 'verified-redirect-shell+verified-parked-lander-redirect-or-all-routes-unreachable+no-public-jobs-return-empty')
  assert.match(provider.modulePath, /bluestarinfotech[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Blue Star Infotech without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bluestarinfotech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bluestarinfotech[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bluestarinfotech')

  const report = generateCompanyCoverageReport({
    csvText: 'Blue Star Infotech,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
