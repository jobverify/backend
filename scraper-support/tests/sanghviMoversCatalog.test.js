import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const sanghviMoversModulePath = path.resolve(currentDir, '../../scraper/sanghvimovers/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sanghvimovers/catalog.js')
  } catch {
    assert.fail('Expected Sanghvi Movers catalog module at ../../scraper/sanghvimovers/catalog.js')
  }
}

const loadSanghviMoversModule = async () => {
  try {
    return await import('../../scraper/sanghvimovers/script.js')
  } catch {
    assert.fail('Expected Sanghvi Movers scraper module at ../../scraper/sanghvimovers/script.js')
  }
}

test('Sanghvi Movers local catalog captures the verified first-party static careers page contract', async () => {
  const { SANGHVI_MOVERS_CATALOG } = await loadCatalogModule()
  const sanghviMovers = await loadSanghviMoversModule()
  const provider = hydrateProviderCatalogEntry(SANGHVI_MOVERS_CATALOG)

  assert.equal(provider.source, 'sanghvimovers')
  assert.equal(provider.companyName, 'Sanghvi Movers')
  assert.equal(provider.officialBrandName, 'Sanghvi Movers Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://sanghvicranes.com/')
  assert.equal(provider.companyCareerPage, 'https://sanghvicranes.com/careers/')
  assert.equal(provider.officialJobBoardUrl, 'https://sanghvicranes.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-static-html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+static-job-sections+india-normalization',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sanghvicranes.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, sanghviMoversModulePath)
  assert.match(provider.dryRunFile, /sanghvimovers[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sanghvicranes\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Engineers Civil \(Solar\)/i)
  assert.match(provider.verifiedSurfaceSummary, /WTG Installation Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Area Operations Manager/i)

  assert.equal(sanghviMovers.PROVIDER_METADATA.source, SANGHVI_MOVERS_CATALOG.source)
  assert.equal(
    sanghviMovers.PROVIDER_METADATA.companyCareerPage,
    SANGHVI_MOVERS_CATALOG.companyCareerPage,
  )
})

test('Sanghvi Movers exact backlog row matches directly from the local catalog without aliases', async () => {
  const { SANGHVI_MOVERS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sanghvi Movers\n',
    catalog: [hydrateProviderCatalogEntry(SANGHVI_MOVERS_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sanghvi Movers', 'sanghvimovers', 'Sanghvi Movers']],
  )
})
