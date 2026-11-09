import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=()=>{throw Error('OFFLINE AutoForm catalog network tripwire')}

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/autoformindia/catalog.js')
  } catch {
    assert.fail('Expected AutoForm India catalog module at ../../scraper/autoformindia/catalog.js')
  }
}

test('AutoForm India local catalog captures the verified first-party careers RSS surface without aliases', async () => {
  const { AUTOFORM_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AUTOFORM_INDIA_CATALOG)

  assert.equal(provider.source, 'autoformindia')
  assert.equal(provider.companyName, 'AutoForm India')
  assert.equal(provider.officialBrandName, 'AutoForm Engineering')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.autoform.com/en/jobs/job-search/')
  assert.equal(provider.homepageUrl, 'https://www.autoform.com/en/')
  assert.equal(provider.careersHomeUrl, 'https://careers.autoform.com/en/')
  assert.equal(provider.jobsLandingUrl, 'https://careers.autoform.com/en/jobs/')
  assert.equal(provider.jobsRssUrl, 'https://careers.autoform.com/en/jobs.rss')
  assert.equal(provider.companyDomain, 'autoform.com')
  assert.equal(provider.atsPlatform, 'official-typo3-native-listing-rss-and-details')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'all-advertised-native-listing-pages-next-links-and-closing-recheck',
  )
  assert.equal(
    provider.extractionStrategy,
    'current-corporate-handoff+native-listing-rss-reconciliation+full-native-details+explicit-role-countries+closing-recheck',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-11-03')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.modulePath, /autoformindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /autoformindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /November 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.autoform\.com\/en\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.autoform\.com\/en\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.autoform\.com\/en\/jobs\/job-search\//i)
  assert.match(provider.verifiedSurfaceSummary, /first-party RSS feeds/i)
  assert.match(provider.verifiedSurfaceSummary, /\bIndia\b/i)
  assert.match(provider.verifiedSurfaceSummary, /India absence is independently proved/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AutoForm India'), false)
})

test('AutoForm India backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { AUTOFORM_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AutoForm India\n',
    catalog: [hydrateProviderCatalogEntry(AUTOFORM_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AutoForm India', 'autoformindia', 'AutoForm India']],
  )
})

test('buildScrapers and company coverage resolve AutoForm India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'autoformindia')
  const scraper = buildScrapers().find((item) => item.name === 'autoformindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AutoForm India')
  assert.equal(provider.companyCareerPage, 'https://careers.autoform.com/en/jobs/job-search/')
  assert.match(scraper.dryRunFile, /autoformindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AutoForm India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AutoForm India', 'autoformindia', 'AutoForm India']],
  )
})
