import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('OpenStack is registered as a fail-closed exact-name provider against the verified community project surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'openstack')

  assert.ok(provider)
  assert.equal(provider.companyName, 'OpenStack')
  assert.equal(provider.homepageUrl, 'https://www.openstack.org/')
  assert.equal(provider.companyCareerPage, 'https://www.openstack.org/community/jobs')
  assert.equal(provider.communityJobsBoardUrl, 'https://www.openstack.org/community/jobs')
  assert.equal(provider.companyDomain, 'openstack.org')
  assert.equal(provider.atsPlatform, 'community-project-jobs-board-not-exact-employer')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-open-source-project-homepage+verified-community-jobs-board-not-exact-employer+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /openstack[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /openstack[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /The Most Widely Deployed Open Source Cloud Software in the World/i)
  assert.match(provider.verifiedSurfaceSummary, /developed by the community/i)
  assert.match(provider.verifiedSurfaceSummary, /OpenStack Job Board/i)
  assert.match(provider.verifiedSurfaceSummary, /OpenStack-related jobs board/i)
  assert.match(provider.verifiedSurfaceSummary, /returns no jobs/i)
})

test('OpenStack resolves directly from exact-name provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nOpenStack\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OpenStack', 'openstack', 'OpenStack']],
  )
})

test('OpenStack is runnable through the central scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'openstack')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'openstack')
  assert.match(scraper.dryRunFile, /openstack[\\/]jobs\.json$/i)
})
