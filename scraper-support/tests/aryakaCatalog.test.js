import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAryakaCatalog = async () => {
  try {
    return await import('../../scraper/aryaka/catalog.js')
  } catch {
    assert.fail('Expected Aryaka catalog module at ../../scraper/aryaka/catalog.js')
  }
}

test('Aryaka catalog captures the verified first-party careers handoff and Jobvite listings metadata', async () => {
  const {
    ARYAKA_CATALOG,
    default: defaultCatalog,
  } = await loadAryakaCatalog()
  const provider = hydrateProviderCatalogEntry(ARYAKA_CATALOG)

  assert.equal(defaultCatalog, ARYAKA_CATALOG)
  assert.equal(provider.source, 'aryaka')
  assert.equal(provider.companyName, 'Aryaka')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aryaka.com/careers/')
  assert.equal(provider.companyDomain, 'aryaka.com')
  assert.equal(provider.homepageUrl, 'https://www.aryaka.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://jobs.jobvite.com/aryaka')
  assert.equal(provider.jobListingsPageUrl, 'https://jobs.jobvite.com/aryaka/jobs/viewall')
  assert.equal(provider.atsPlatform, 'jobvite')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-homepage-plus-careers-page-plus-jobvite-viewall-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+verified-jobvite-handoff+jobvite-viewall-india-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aryaka\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aryaka\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.jobvite\.com\/aryaka/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.jobvite\.com\/aryaka\/jobs\/viewall/i)
  assert.match(provider.verifiedSurfaceSummary, /\bUI_UX Engineer\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bData Engineer\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bPlatform Engineer\b/i)
  assert.match(provider.modulePath, /aryaka[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aryaka'), false)
})

test('Aryaka backlog matching works directly from the local catalog metadata', async () => {
  const { ARYAKA_CATALOG } = await loadAryakaCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aryaka\n',
    catalog: [hydrateProviderCatalogEntry(ARYAKA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aryaka', 'aryaka', 'Aryaka']],
  )
})

test('buildScrapers and company coverage resolve Aryaka from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aryaka')
  const scraper = buildScrapers().find((item) => item.name === 'aryaka')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aryaka')
  assert.equal(provider.companyCareerPage, 'https://www.aryaka.com/careers/')
  assert.match(scraper.dryRunFile, /aryaka[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aryaka\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aryaka', 'aryaka', 'Aryaka']],
  )
})
