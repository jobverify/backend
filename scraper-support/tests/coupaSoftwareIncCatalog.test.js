import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/coupasoftwareinc/catalog.js')
  } catch {
    assert.fail('Expected Coupa Software Inc catalog module at ../../scraper/coupasoftwareinc/catalog.js')
  }
}

test('getScraperCatalog includes Coupa Software Inc with the verified August 14 blocked-shell contract', async () => {
  const coupaCatalog = await loadModule()
  const provider = getScraperCatalog().find((item) => item.source === 'coupasoftwareinc')

  assert.ok(provider)
  assert.equal(provider.source, 'coupasoftwareinc')
  assert.equal(provider.companyName, 'Coupa Software Inc')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.coupa.com/en/jobs/')
  assert.equal(provider.companyDomain, 'careers.coupa.com')
  assert.equal(provider.atsPlatform, 'coupa-careers-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-html-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-cloudflare-challenge-empty+preserve-first-party-html-job-card-parser',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(provider.verifiedSurfaceSummary, /Enable JavaScript and cookies to continue/i)
  assert.match(provider.modulePath, /coupasoftwareinc[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /coupasoftwareinc[\\/]jobs\.json$/i)

  assert.equal(
    coupaCatalog.COUPA_SOFTWARE_INC_CATALOG.extractionStrategy,
    'verified-cloudflare-challenge-empty+preserve-first-party-html-job-card-parser',
  )
  assert.equal(coupaCatalog.COUPA_SOFTWARE_INC_CATALOG.verifiedOn, '2026-08-14')
})

test('buildScrapers exposes a runnable Coupa Software Inc scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'coupasoftwareinc')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'coupasoftwareinc')
  assert.match(scraper.dryRunFile, /coupasoftwareinc[\\/]jobs\.json$/i)
})
