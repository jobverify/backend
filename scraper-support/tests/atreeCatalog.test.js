import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const atreeModulePath = path.resolve(currentDir, '../../scraper/atree/script.js')

const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.atree.org/career/executive-assistant-2/',
  'https://www.atree.org/career/jrf-anrf/',
  'https://www.atree.org/career/doctoral-researcher-position-ueb/',
]

const VERIFIED_APPLY_URLS = [
  'https://forms.gle/y2nuF4BbwMEf9bky6',
  'https://mail.google.com/mail/?view=cm&fs=1&to=ashish.kumar@atree.org&cc=radhika.reddy@atree.org&su=Application%20for%20JRF%20%E2%80%93%20Reconstream',
  'https://docs.google.com/forms/d/e/1FAIpQLSdXL1QPZ8w4m0n8B9FUg00THXYjmDQ0M9zSyQdPdMvBc2p-mQ/viewform?usp=sharing&ouid=107152544725028953630',
]

const loadAtreeCatalog = async () => {
  try {
    return await import('../../scraper/atree/catalog.js')
  } catch {
    assert.fail('Expected Atree catalog module at ../../scraper/atree/catalog.js')
  }
}

const loadAtreeModule = async () => {
  try {
    return await import('../../scraper/atree/script.js')
  } catch {
    assert.fail('Expected Atree scraper module at ../../scraper/atree/script.js')
  }
}

test('Atree local catalog captures the verified first-party homepage, careers listing, sitemap, and current detail pages', async () => {
  const { ATREE_CATALOG } = await loadAtreeCatalog()
  const atree = await loadAtreeModule()

  assert.equal(ATREE_CATALOG.source, 'atree')
  assert.equal(ATREE_CATALOG.companyName, 'Atree')
  assert.equal(
    ATREE_CATALOG.officialBrandName,
    'Ashoka Trust for Research in Ecology and the Environment (ATREE)',
  )
  assert.equal(ATREE_CATALOG.adapter, 'script')
  assert.equal(ATREE_CATALOG.homepageUrl, 'https://www.atree.org/')
  assert.equal(ATREE_CATALOG.getInvolvedUrl, 'https://www.atree.org/get-involved/')
  assert.equal(ATREE_CATALOG.companyCareerPage, 'https://www.atree.org/careers/')
  assert.equal(ATREE_CATALOG.legacyCareerPageUrl, 'https://www.atree.org/career/')
  assert.equal(ATREE_CATALOG.workWithUsUrl, 'https://www.atree.org/work-with-us/')
  assert.equal(ATREE_CATALOG.sitemapUrl, 'https://www.atree.org/wp-sitemap.xml')
  assert.equal(
    ATREE_CATALOG.careerPostSitemapUrl,
    'https://www.atree.org/wp-sitemap-posts-career-1.xml',
  )
  assert.deepEqual(ATREE_CATALOG.checkedMissingRouteUrls, [
    'https://www.atree.org/jobs/',
    'https://www.atree.org/openings/',
  ])
  assert.deepEqual(ATREE_CATALOG.verifiedJobDetailUrls, VERIFIED_JOB_DETAIL_URLS)
  assert.deepEqual(ATREE_CATALOG.verifiedApplyUrls, VERIFIED_APPLY_URLS)
  assert.equal(ATREE_CATALOG.companyDomain, 'atree.org')
  assert.equal(ATREE_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(ATREE_CATALOG.countryFilter, 'India')
  assert.equal(
    ATREE_CATALOG.paginationStrategy,
    'single-first-party-careers-list-plus-first-party-detail-pages',
  )
  assert.equal(
    ATREE_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-list+verified-wp-sitemap+verified-career-post-sitemap+verified-career-route-redirect+verified-missing-routes+first-party-detail-pages+mixed-public-apply-handoffs',
  )
  assert.equal(ATREE_CATALOG.parser, 'custom-script')
  assert.equal(ATREE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ATREE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ATREE_CATALOG.dryRunFile, 'atree/jobs.json')
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.atree\.org\//i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.atree\.org\/careers\//i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.atree\.org\/wp-sitemap\.xml/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.atree\.org\/wp-sitemap-posts-career-1\.xml/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /Executive Assistant/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /Junior Research Fellow \(JRF\)/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /Doctoral Researcher Position: Urban Ecology and Biodiversity/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /https:\/\/forms\.gle\/y2nuF4BbwMEf9bky6/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /mail\.google\.com/i)
  assert.match(ATREE_CATALOG.verifiedSurfaceSummary, /docs\.google\.com/i)
  assert.equal(ATREE_CATALOG.modulePath, atreeModulePath)

  assert.equal(atree.PROVIDER_METADATA.source, ATREE_CATALOG.source)
  assert.equal(atree.PROVIDER_METADATA.companyName, ATREE_CATALOG.companyName)
  assert.deepEqual(
    atree.PROVIDER_METADATA.verifiedJobDetailUrls,
    ATREE_CATALOG.verifiedJobDetailUrls,
  )
  assert.deepEqual(
    atree.PROVIDER_METADATA.verifiedApplyUrls,
    ATREE_CATALOG.verifiedApplyUrls,
  )
})

test('Atree backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ATREE_CATALOG } = await loadAtreeCatalog()
  const provider = hydrateProviderCatalogEntry(ATREE_CATALOG)

  assert.equal(provider.companyName, 'Atree')
  assert.equal(provider.companyDomain, 'atree.org')
  assert.match(provider.modulePath, /atree[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /atree[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Atree'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Atree\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atree', 'atree', 'Atree']],
  )
})

test('buildScrapers and company coverage resolve Atree from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'atree')
  const scraper = buildScrapers().find((item) => item.name === 'atree')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Atree')
  assert.equal(provider.companyCareerPage, 'https://www.atree.org/careers/')
  assert.match(scraper.dryRunFile, /atree[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Atree\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atree', 'atree', 'Atree']],
  )
})
