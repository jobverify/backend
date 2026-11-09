import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const livguardModulePath = path.resolve(currentDir, '../../scraper/livguard/script.js')

const loadLivguardCatalog = async () => {
  try {
    return await import('../../scraper/livguard/catalog.js')
  } catch {
    assert.fail('Expected Livguard catalog module at ../../scraper/livguard/catalog.js')
  }
}

test('Livguard catalog captures the verified no-public-careers sentinel surface', async () => {
  const { LIVGUARD_CATALOG } = await loadLivguardCatalog()
  const provider = hydrateProviderCatalogEntry(LIVGUARD_CATALOG)

  assert.equal(provider.source, 'livguard')
  assert.equal(provider.companyName, 'Livguard')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.livguard.com/')
  assert.equal(provider.companyDomain, 'livguard.com')
  assert.equal(provider.officialHomepageUrl, 'https://www.livguard.com/')
  assert.equal(provider.officialAboutUrl, 'https://www.livguard.com/about-us')
  assert.deepEqual(provider.noPublicCareersRouteUrls, [
    'https://www.livguard.com/careers',
    'https://www.livguard.com/career',
    'https://www.livguard.com/jobs',
    'https://www.livguard.com/join-us',
    'https://www.livguard.com/openings',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-about-and-common-careers-route-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, livguardModulePath)
  assert.match(provider.dryRunFile, /livguard[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.livguard\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.livguard\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.livguard\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Livguard'), false)
})

test('Livguard backlog row matches directly from provider metadata without alias churn', async () => {
  const { LIVGUARD_CATALOG } = await loadLivguardCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Livguard\n',
    catalog: [hydrateProviderCatalogEntry(LIVGUARD_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Livguard', 'livguard', 'Livguard']],
  )
})
