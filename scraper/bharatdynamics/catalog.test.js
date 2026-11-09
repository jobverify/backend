import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Bharat Dynamics is registered against the verified official recruitment table', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatdynamics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Bharat Dynamics')
  assert.equal(provider.homepageUrl, 'https://bdl-india.in/')
  assert.equal(provider.companyCareerPage, 'https://bdl-india.in/recruitments')
  assert.equal(provider.pageTwoUrl, 'https://bdl-india.in/recruitments?page=1')
  assert.equal(provider.atsPlatform, 'official-recruitment-table')
  assert.equal(provider.paginationStrategy, 'official-recruitments-root-plus-page-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-recruitment-handoff+paginated-official-recruitment-table+conservative-actionable-notice-filter',
  )
  assert.equal(provider.companyDomain, 'bdl-india.in')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 1)
  assert.equal(
    provider.verifiedSampleJobTitle,
    'Notification – Recruitment for the posts of Contract Engineer (Field Firing) on Contractual basis in BDL',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://www.bdl-india.in/sites/default/files/Nofification-Recruitment_contract-Engineer%28field-firing%29.pdf',
  )
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.modulePath, /bharatdynamics[\\/]script\.js$/i)
})

test('Bharat Dynamics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatdynamics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bharatdynamics')
  assert.match(scraper.dryRunFile, /bharatdynamics[\\/]jobs\.json$/i)
})
