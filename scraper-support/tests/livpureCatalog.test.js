import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/livpure/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/livpure/catalog.js')
  } catch {
    assert.fail('Expected Livpure catalog module at ../../scraper/livpure/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/livpure/script.js')
  } catch {
    assert.fail('Expected Livpure scraper module at ../../scraper/livpure/script.js')
  }
}

test('Livpure local catalog captures the verified first-party empty PeopleStrong board', async () => {
  const { LIVPURE_CATALOG } = await loadCatalogModule()
  const livpure = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LIVPURE_CATALOG)

  assert.equal(provider.source, 'livpure')
  assert.equal(provider.companyName, 'Livpure')
  assert.equal(provider.officialBrandName, 'Livpure Smart Homes Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.livpuresmart.com/')
  assert.equal(provider.companyCareerPage, 'https://www.livpuresmart.com/')
  assert.equal(provider.portalOrigin, 'https://livpurerecruit-careers.peoplestrong.com')
  assert.equal(provider.jobListingsUrl, 'https://livpurerecruit-careers.peoplestrong.com/home')
  assert.equal(
    provider.jobsApiUrl,
    'https://livpurerecruit-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(provider.companyDomain, 'livpuresmart.com')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-peoplestrong-offset-limit-api-empty-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+direct-peoplestrong-handoff+peoplestrong-jobs-api-empty-board',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /livpure[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.livpuresmart\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/livpurerecruit-careers\.peoplestrong\.com\/home/i)
  assert.match(provider.verifiedSurfaceSummary, /api\/cp\/rest\/altone\/cp\/jobs\/v1\?offset=0&limit=20/i)
  assert.match(provider.verifiedSurfaceSummary, /0 public jobs/i)

  assert.equal(livpure.PROVIDER_METADATA.source, LIVPURE_CATALOG.source)
  assert.equal(livpure.PROVIDER_METADATA.companyName, LIVPURE_CATALOG.companyName)
  assert.equal(livpure.PROVIDER_METADATA.companyCareerPage, LIVPURE_CATALOG.companyCareerPage)
})

test('Livpure exact backlog row matches directly from local provider metadata', async () => {
  const { LIVPURE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Livpure\n',
    catalog: [hydrateProviderCatalogEntry(LIVPURE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Livpure', 'livpure', 'Livpure']],
  )
})
