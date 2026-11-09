import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/topcoderindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/topcoderindia/catalog.js')
  } catch {
    assert.fail('Expected Topcoder India catalog module at ../../scraper/topcoderindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/topcoderindia/script.js')
  } catch {
    assert.fail('Expected Topcoder India scraper module at ../../scraper/topcoderindia/script.js')
  }
}

test('Topcoder India local catalog captures the verified gig-marketplace sentinel without an exact-name employer feed', async () => {
  const { TOPCODER_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const topcoderIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TOPCODER_INDIA_CATALOG)

  assert.equal(defaultCatalog, TOPCODER_INDIA_CATALOG)
  assert.equal(provider.source, 'topcoderindia')
  assert.equal(provider.companyName, 'Topcoder India')
  assert.equal(provider.officialBrandName, 'Topcoder')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.topcoder.com/community/tcgigs')
  assert.equal(provider.homepageUrl, 'https://www.topcoder.com/')
  assert.equal(provider.gigProgramUrl, 'https://www.topcoder.com/community/member-programs/gigs')
  assert.equal(provider.gigResourcesUrl, 'https://www.topcoder.com/community/gig-resources')
  assert.equal(provider.companyDomain, 'topcoder.com')
  assert.equal(provider.atsPlatform, 'first-party-gig-marketplace-no-exact-name-employer-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-gig-pages-without-exact-name-topcoder-india-employer-feed',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+gig-work-landing+gig-program+gig-transfer-update-without-exact-name-employer-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /topcoderindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.topcoder\.com\/community\/tcgigs/i)
  assert.match(provider.verifiedSurfaceSummary, /location does not matter/i)
  assert.match(provider.verifiedSurfaceSummary, /full time, freelance position/i)
  assert.match(provider.verifiedSurfaceSummary, /Wipro/i)
  assert.match(provider.verifiedSurfaceSummary, /talent\.topcoder@wipro\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy exact-name Topcoder India employer jobs surface/i)

  assert.equal(topcoderIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(topcoderIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(topcoderIndia.CAREERS_URL, provider.companyCareerPage)
})

test('Topcoder India exact backlog row matches directly from the local provider metadata', async () => {
  const { TOPCODER_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Topcoder India\n',
    catalog: [hydrateProviderCatalogEntry(TOPCODER_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Topcoder India', 'topcoderindia', 'Topcoder India']],
  )
})
