import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BSE India as a verified Angular careers page with a Darwinbox application link', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bseindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BSE India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-angular-shell')
  assert.equal(provider.companyCareerPage, 'https://www.bseindia.com/static/about/careers')
  assert.equal(provider.companyDomain, 'bseindia.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-shell-plus-sitemap-and-lazy-route-bundle-validation')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell+verified-sitemap-routes+verified-angular-static-about-careers-bundle+hiring-posts+official-darwinbox-apply-link')
  assert.match(provider.modulePath, /bseindia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BSE India without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bseindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bseindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bseindia')

  const report = generateCompanyCoverageReport({
    csvText: 'BSE India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
