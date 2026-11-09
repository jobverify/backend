import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Celette as a verified blocked first-party zero-openings scraper', () => {
  const catalog = getScraperCatalog()
  const celette = catalog.find((provider) => provider.source === 'celette')

  assert.ok(celette)
  assert.equal(celette.adapter, 'script')
  assert.equal(celette.officialBrandName, 'Celette')
  assert.equal(celette.homepageUrl, 'https://www.celette.com/')
  assert.equal(celette.companyCareerPage, 'https://www.celette.com/')
  assert.equal(celette.contactUsUrl, 'https://www.celette.com/contact-us/')
  assert.deepEqual(celette.checkedBlockedRouteUrls, [
    'https://www.celette.com/',
    'https://www.celette.com/contact-us/',
    'https://www.celette.com/careers/',
    'https://www.celette.com/jobs/',
  ])
  assert.equal(celette.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.equal(celette.paginationStrategy, 'verified-first-party-routes-cloudflare-challenge-validation')
  assert.equal(celette.extractionStrategy, 'verified-cloudflare-403-homepage+contact+careers-routes-return-empty')
  assert.equal(celette.companyDomain, 'celette.com')
  assert.equal(celette.verifiedOn, '2026-08-15')
  assert.equal(celette.verifiedPublicJobCount, 0)
  assert.equal(celette.verifiedIndiaJobCount, 0)
  assert.match(celette.verifiedSurfaceSummary, /Just a moment/i)
  assert.equal(celette.parser, 'custom-script')
  assert.match(celette.modulePath, /celette[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Celette script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const celette = scrapers.find((scraper) => scraper.name === 'celette')

  assert.ok(celette)
  assert.equal(typeof celette.run, 'function')
  assert.equal(celette.provider.adapter, 'script')
  assert.equal(celette.provider.parser, 'custom-script')
  assert.equal(celette.provider.companyCareerPage, 'https://www.celette.com/')
  assert.equal(celette.provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
})
