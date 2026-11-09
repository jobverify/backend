import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Marut Air is registered against the verified first-party brand page and Odoo jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'marutair')

  assert.ok(provider, 'Expected Marut Air provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Marut Air')
  assert.equal(provider.companyCareerPage, 'https://crm.marutair.com/jobs')
  assert.equal(provider.officialHomepageUrl, 'https://marutair.com/about-us/')
  assert.equal(provider.officialJobsPageUrl, 'https://crm.marutair.com/jobs')
  assert.equal(provider.sampleJobUrl, 'https://crm.marutair.com/jobs/sales-engineer-trainee-22')
  assert.equal(provider.applicationUrlPattern, 'https://crm.marutair.com/jobs/apply/{slug}-{id}')
  assert.equal(provider.atsPlatform, 'first-party-odoo-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-odoo-jobs-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-brand-page+verified-first-party-odoo-jobs-board+detail-pages+first-party-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'marutair.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /crm\.marutair\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no-open-job-opportunities/i)
  assert.match(provider.modulePath, /marutair[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Marut Air scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'marutair')

  assert.ok(scraper, 'Expected buildScrapers() to return the Marut Air scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'marutair')
  assert.equal(scraper.provider.companyCareerPage, 'https://crm.marutair.com/jobs')
})
