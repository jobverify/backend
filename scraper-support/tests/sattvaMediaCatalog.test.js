import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sattvamedia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sattvamedia/catalog.js')
  } catch {
    assert.fail('Expected Sattva Media catalog module at ../../scraper/sattvamedia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sattvamedia/script.js')
  } catch {
    assert.fail('Expected Sattva Media scraper module at ../../scraper/sattvamedia/script.js')
  }
}

test('Sattva Media local catalog captures the verified first-party Sattva careers pages plus public Freshteam board', async () => {
  const { SATTVA_MEDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sattvaMedia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SATTVA_MEDIA_CATALOG)

  assert.equal(defaultCatalog, SATTVA_MEDIA_CATALOG)
  assert.equal(provider.source, 'sattvamedia')
  assert.equal(provider.companyName, 'Sattva Media')
  assert.equal(provider.officialBrandName, 'Sattva Consulting')
  assert.equal(provider.legalEntityName, 'Sattva Media and Consulting Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sattva.co.in/join-us/careers/')
  assert.equal(provider.homepageUrl, 'https://www.sattva.co.in/join-us/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sattva.co.in/join-us/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://sattva-talent.freshteam.com/jobs')
  assert.equal(
    provider.detailUrlPattern,
    'https://sattva-talent.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(provider.companyDomain, 'sattva.co.in')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-public-freshteam-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-join-us-page+verified-careers-page-cta+public-freshteam-board+detail-page-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sattvamedia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sattva\.co\.in\/join-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sattva\.co\.in\/join-us\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sattva-talent\.freshteam\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Sattva Media and Consulting Private Limited/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sattva Media'), false)

  assert.equal(sattvaMedia.PROVIDER_METADATA.source, SATTVA_MEDIA_CATALOG.source)
  assert.equal(sattvaMedia.PROVIDER_METADATA.companyName, SATTVA_MEDIA_CATALOG.companyName)
  assert.equal(
    sattvaMedia.PROVIDER_METADATA.officialJobsBoardUrl,
    SATTVA_MEDIA_CATALOG.officialJobsBoardUrl,
  )
})

test('Sattva Media exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SATTVA_MEDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sattva Media\n',
    catalog: [hydrateProviderCatalogEntry(SATTVA_MEDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sattva Media', 'sattvamedia', 'Sattva Media']],
  )
})
