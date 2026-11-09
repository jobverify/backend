import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mazagondockshipbuilders/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mazagondockshipbuilders/catalog.js')
  } catch {
    assert.fail('Expected Mazagon Dock Shipbuilders catalog module at ../../scraper/mazagondockshipbuilders/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/mazagondockshipbuilders/script.js')
  } catch {
    assert.fail('Expected Mazagon Dock Shipbuilders scraper module at ../../scraper/mazagondockshipbuilders/script.js')
  }
}

test('Mazagon Dock Shipbuilders local catalog captures the verified official recruitment-table surfaces', async () => {
  const { MAZAGON_DOCK_SHIPBUILDERS_CATALOG } = await loadCatalogModule()
  const mazagon = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MAZAGON_DOCK_SHIPBUILDERS_CATALOG)

  assert.equal(provider.source, 'mazagondockshipbuilders')
  assert.equal(provider.companyName, 'Mazagon Dock Shipbuilders')
  assert.equal(provider.officialBrandName, 'Mazagon Dock Shipbuilders Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://mazagondock.in/')
  assert.equal(provider.companyCareerPage, 'https://mazagondock.in/career/online-recruitment')
  assert.equal(
    provider.executiveCareerPageUrl,
    'https://mazagondock.in/English/career/Career-Executives',
  )
  assert.equal(
    provider.nonExecutiveCareerPageUrl,
    'https://mazagondock.in/English/career/Career-Non-Executives',
  )
  assert.equal(
    provider.apprenticeCareerPageUrl,
    'https://mazagondock.in/English/career/Career-Apprentice',
  )
  assert.equal(
    provider.onlineRecruitmentPortalUrl,
    'https://mazagondock.in/app/MDLJobPortal/Welcome.aspx',
  )
  assert.equal(provider.companyDomain, 'mazagondock.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-multi-page-html-table-scan-plus-closing-date-filter',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-executive-nonexecutive-apprentice-pages+official-online-recruitment-handoff+active-opening-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.modulePath, /mazagondockshipbuilders[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Career-Executives/i)
  assert.match(provider.verifiedSurfaceSummary, /Career-Non-Executives/i)
  assert.match(provider.verifiedSurfaceSummary, /Career-Apprentice/i)
  assert.match(provider.verifiedSurfaceSummary, /15-07-2026/i)
  assert.match(provider.verifiedSurfaceSummary, /no active public recruitment postings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mazagon Dock Shipbuilders'), false)

  assert.equal(mazagon.PROVIDER_METADATA.source, MAZAGON_DOCK_SHIPBUILDERS_CATALOG.source)
  assert.equal(mazagon.PROVIDER_METADATA.companyName, MAZAGON_DOCK_SHIPBUILDERS_CATALOG.companyName)
  assert.equal(
    mazagon.PROVIDER_METADATA.onlineRecruitmentPortalUrl,
    MAZAGON_DOCK_SHIPBUILDERS_CATALOG.onlineRecruitmentPortalUrl,
  )
})

test('Mazagon Dock Shipbuilders exact backlog row matches directly from local provider metadata', async () => {
  const { MAZAGON_DOCK_SHIPBUILDERS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mazagon Dock Shipbuilders\n',
    catalog: [hydrateProviderCatalogEntry(MAZAGON_DOCK_SHIPBUILDERS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mazagon Dock Shipbuilders', 'mazagondockshipbuilders', 'Mazagon Dock Shipbuilders']],
  )
})

test('Mazagon Dock Shipbuilders hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MAZAGON_DOCK_SHIPBUILDERS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAZAGON_DOCK_SHIPBUILDERS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mazagon Dock Shipbuilders')
  assert.equal(provider.companyCareerPage, 'https://mazagondock.in/career/online-recruitment')
  assert.equal(provider.companyDomain, 'mazagondock.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /mazagondockshipbuilders[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mazagondockshipbuilders[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
