import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bukuwarung/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bukuwarung/catalog.js')
  } catch {
    assert.fail('Expected Bukuwarung catalog module at ../../scraper/bukuwarung/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bukuwarung local catalog captures the verified first-party careers page and non-public Darwinbox tenant without alias churn', async () => {
  const {
    BOOKUWARUNG_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(BOOKUWARUNG_CATALOG)

  assert.equal(defaultCatalog, BOOKUWARUNG_CATALOG)
  assert.equal(provider.source, 'bukuwarung')
  assert.equal(provider.companyName, 'Bukuwarung')
  assert.equal(provider.officialBrandName, 'BukuWarung')
  assert.equal(provider.legalEntityName, 'PT Buku Usaha Digital')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.bukuwarung.com/career/')
  assert.equal(provider.homepageUrl, 'https://www.bukuwarung.com/')
  assert.equal(provider.legacyHomepageUrl, 'https://bukuwarung.com/')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://bukuwarung.darwinbox.com/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxJobsUrl, 'https://bukuwarung.darwinbox.com/jobs')
  assert.deepEqual(provider.darwinboxShellRouteUrls, [
    'https://bukuwarung.darwinbox.com/ms/candidate/careers',
    'https://bukuwarung.darwinbox.com/ms/candidatev2/main/careers/home',
    'https://bukuwarung.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(
    provider.darwinboxListingApiUrl,
    'https://bukuwarung.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(provider.companyDomain, 'bukuwarung.com')
  assert.equal(provider.atsPlatform, 'darwinbox-public-native')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'full-native-board+all-public-details+final-listing-after-closing-details',
  )
  assert.equal(
    provider.extractionStrategy,
    'current-active-corporate-handoff+strict-native-identity-country-and-public-criteria+blocked-host-cache',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /bukuwarung[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /native HTTP403/)
  assert.match(provider.verifiedSurfaceSummary, /unknown totals, never verified empty/)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bukuwarung'), false)
})

test('Bukuwarung backlog row matches directly from the local provider metadata without an alias entry', async () => {
  const { BOOKUWARUNG_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bukuwarung\n',
    catalog: [buildCatalogReadyProvider(BOOKUWARUNG_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bukuwarung', 'bukuwarung', 'Bukuwarung']],
  )
})
