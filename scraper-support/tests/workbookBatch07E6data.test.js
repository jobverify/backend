import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/e6data/script.js')
  } catch {
    assert.fail('Expected e6data scraper module at ../../scraper/e6data/script.js')
  }
}

test('getScraperCatalog includes e6data with the verified October 3, 2026 homepage, careers handoff, and Zoho API contract', async () => {
  const e6data = await loadModule()
  const provider = getScraperCatalog().find((item) => item.source === 'e6data')

  assert.ok(provider)
  assert.equal(provider.source, 'e6data')
  assert.equal(provider.companyName, 'e6data Inc.')
  assert.equal(provider.officialBrandName, 'e6data')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://e6data.com/careers')
  assert.equal(provider.homepageUrl, 'https://e6data.com/')
  assert.equal(provider.careersPortalUrl, 'https://e6data.zohorecruit.in/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://e6data.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.companyDomain, 'e6data.com')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-zohorecruit-portal-plus-public-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-careers-page+zohorecruit-portal+public-job-openings-api+explicit-india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.equal(provider.verifiedIndiaJobCount, 2)
  assert.match(provider.modulePath, /e6data[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /e6data[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/e6data\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/e6data\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /five public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /two explicitly India-scoped jobs/i)

  assert.equal(e6data.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(e6data.CAREERS_PAGE_URL, provider.companyCareerPage)
  assert.equal(e6data.CAREERS_PORTAL_URL, provider.careersPortalUrl)
  assert.equal(e6data.CAREERS_API_URL, provider.careersApiUrl)
})

test('buildScrapers exposes a runnable e6data scraper with the updated provider metadata', () => {
  const scraper = buildScrapers().find((item) => item.name === 'e6data')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'e6data')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /e6data[\\/]jobs\.json$/i)
})
