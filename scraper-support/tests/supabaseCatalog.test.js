import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Supabase as a first-party-verified Ashby script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'supabase')

  assert.ok(provider, 'Expected Supabase provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Supabase')
  assert.equal(provider.officialBrandName, 'Supabase')
  assert.equal(provider.companyCareerPage, 'https://supabase.com/careers')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/supabase')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/supabase')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-ashby-job-board-get')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+ashby-handoff+public-ashby-get-feed+india-location-filter',
  )
  assert.equal(provider.companyDomain, 'supabase.com')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.modulePath, /supabase[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /supabase[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/supabase\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/supabase/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/supabase/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager - Marketplace/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Solution Architect \(AMER\)/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)
})

test('buildScrapers exposes a runnable Supabase scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'supabase')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /supabase[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'supabase')
  assert.equal(scraper.provider.atsPlatform, 'ashby')
})
