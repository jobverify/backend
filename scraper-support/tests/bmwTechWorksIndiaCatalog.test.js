import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('BMW TechWorks India metadata pins the verified employer-published PeopleStrong handoff and complete native inventory', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bmwtechworksindia')
  assert.ok(provider)
  assert.equal(provider.companyName, 'BMW TechWorks India')
  assert.equal(provider.homepageUrl, 'https://www.bmwtechworks.in/')
  assert.equal(provider.companyCareerPage, 'https://www.bmwtechworks.in/careers/')
  assert.equal(provider.companyDomain, 'bmwtechworks.in')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.portalOrigin, 'https://careers-bmwtechworks.peoplestrong.com')
  assert.equal(provider.recruitmentHandoffUrl, 'https://bit.ly/45qB9gC')
  assert.equal(provider.recruitmentAuthorityPublishedOn, '2025-07-30')
  assert.match(provider.recruitmentAuthorityUrl, /^https:\/\/www\.linkedin\.com\/posts\/bmw-techworks-india_/)
  assert.equal(provider.publicTenantRealm, 1301)
  assert.equal(provider.jobsApiUrl, provider.portalOrigin + '/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=45')
  assert.equal(provider.verifiedOn, '2026-10-08')
  assert.equal(provider.verifiedPublicJobCount, 116)
  assert.equal(provider.verifiedIndiaJobCount, 116)
  assert.equal(provider.sourceListingComplete, true)
  assert.equal(provider.corporateSurfaceDisposition, 'upstream-tls-chain-blocked')
  assert.match(provider.paginationStrategy, /count-reconciled.*bounded-detail-concurrency/)
  assert.match(provider.extractionStrategy, /strict-all-job-details\+explicit-india-hierarchy/)
  assert.match(provider.verifiedSurfaceSummary, /strict TLS and system CAs/)
  assert.match(provider.verifiedSurfaceSummary, /No historical social-post role is assumed current/)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.pressReleaseUrl, /^https:\/\/www\.press\.bmwgroup\.com\/global\/article\/detail\/T0445452EN\//)
  assert.match(provider.modulePath, /bmwtechworksindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /bmwtechworksindia[\\/]jobs\.json$/i)
})

test('BMW Techworks India preserves exact-name coverage through provider metadata', () => {
  const report = generateCompanyCoverageReport({ csvText: 'company_name\nBMW Techworks India\n', catalog: getScraperCatalog() })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BMW Techworks India', 'bmwtechworksindia', 'BMW TechWorks India']])
})

test('BMW TechWorks India remains runnable through the central provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bmwtechworksindia')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bmwtechworksindia')
  assert.match(scraper.dryRunFile, /bmwtechworksindia[\\/]jobs\.json$/i)
})
