import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadGeniusAdvisorCatalog = async () => {
  try {
    return await import('../../scraper/geniusadvisor/catalog.js')
  } catch {
    assert.fail('Expected Genius Advisor catalog module at ../../scraper/geniusadvisor/catalog.js')
  }
}

test('Genius Advisor catalog metadata captures the verified first-party brochure surface with no trustworthy public jobs board', async () => {
  const { GENIUS_ADVISOR_CATALOG } = await loadGeniusAdvisorCatalog()
  const provider = hydrateProviderCatalogEntry(GENIUS_ADVISOR_CATALOG)

  assert.equal(provider.source, 'geniusadvisor')
  assert.equal(provider.companyName, 'Genius Advisor')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.thegeniusadvisor.in/')
  assert.equal(provider.homepageUrl, 'https://www.thegeniusadvisor.in/')
  assert.equal(provider.aboutUsUrl, 'https://www.thegeniusadvisor.in/about.html')
  assert.equal(provider.contactUsUrl, 'https://www.thegeniusadvisor.in/contact.html')
  assert.equal(provider.officialBrandName, 'The Genius Advisors')
  assert.equal(provider.founderName, 'Jai M Bihani')
  assert.equal(provider.businessEmail, 'hello@thegeniusadvisor.com')
  assert.equal(provider.businessPhone, '+91 96862 04879')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-verified-brochure-pages-plus-brochure-fallback-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-about-and-contact-pages+adjacent-exact-name-careers-routes-brochure-fallback-or-timeout-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'thegeniusadvisor.in')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.deepEqual(provider.firstPartyCareerRoutes, [
    'https://www.thegeniusadvisor.in/careers',
    'https://www.thegeniusadvisor.in/jobs',
    'https://www.thegeniusadvisor.in/join-us',
    'https://www.thegeniusadvisor.in/work-with-us',
    'https://www.thegeniusadvisor.in/openings',
  ])
  assert.match(provider.modulePath, /geniusadvisor[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /geniusadvisor[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.thegeniusadvisor\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.thegeniusadvisor\.in\/about\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.thegeniusadvisor\.in\/contact\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /Jai M Bihani/i)
  assert.match(provider.verifiedSurfaceSummary, /hello@thegeniusadvisor\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Genius Advisor matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { GENIUS_ADVISOR_CATALOG } = await loadGeniusAdvisorCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Genius Advisor\n',
    catalog: [hydrateProviderCatalogEntry(GENIUS_ADVISOR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Genius Advisor', 'geniusadvisor', 'Genius Advisor']],
  )
})
