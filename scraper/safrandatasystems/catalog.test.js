import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { INDIA_VERIFIED_ON } from './script.js'

const SOURCE = 'safrandatasystems'
const COMPANY = 'Safran Data Systems'
const SEARCH_URL =
  'https://careers.safran-group.com/offre-de-emploi/liste-offres.aspx?lcid=1036&facet_Country=81'
const COMPANY_PAGE_URL = 'https://www.safran-group.com/fr/societes/safran-data-systems'
const RSS_URL =
  'https://careers.safran-group.com/handlers/offerRss.ashx?lcid=1036&Rss_Country=81'

test('Safran Data Systems registers the native India country search with partial company coverage and stable identity', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Safran Data Systems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, SEARCH_URL)
  assert.equal(provider.officialCompanyPageUrl, COMPANY_PAGE_URL)
  assert.equal(provider.officialJobsRssUrl, RSS_URL)
  assert.equal(provider.atsPlatform, 'official-first-party-country-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'counted-group-india-pages-with-identity-and-snapshot-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'published-india-country-search+exact-native-sds-india-employer+full-native-details+partial-company-evidence',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.safran-group.com')
  assert.equal(provider.verifiedOn, INDIA_VERIFIED_ON)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.indiaInventoryTotal, null)
  assert.equal(provider.verifiedObservedIndiaSubsetCount, 6)
  assert.equal(provider.verifiedGroupIndiaListingRowCount, 176)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.verifiedInventoryStatus, 'coverage-gap')
  assert.equal(provider.verificationDisposition, 'verified-native-india-employer-subset-global-inventory-unverified')
  assert.match(provider.verifiedSurfaceSummary, /company global and India.*unknown/i)
  assert.match(provider.verifiedSurfaceSummary, /No India-zero or expiry claim/i)
  assert.match(provider.modulePath, /safrandatasystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Safran Data Systems matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: COMPANY + ',\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('Safran Data Systems is runnable through the current India provider catalog without claiming complete company inventory', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Safran Data Systems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, SEARCH_URL)
  assert.equal(scraper.provider.sourceListingComplete, false)
  assert.equal(scraper.provider.verifiedPublicJobCount, null)
  assert.match(scraper.dryRunFile, /safrandatasystems[\\/]jobs\.json$/i)
})
