import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/electronicscorporationofindialimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/electronicscorporationofindialimited/catalog.js')
  } catch {
    assert.fail(
      'Expected Electronics Corporation of India Limited catalog module at ../../scraper/electronicscorporationofindialimited/catalog.js',
    )
  }
}

test('ECIL local catalog captures the verified first-party current job openings grid contract', async () => {
  const {
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.source,
    'electronicscorporationofindialimited',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.companyName,
    'Electronics Corporation of India Limited',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.officialBrandName,
    'ECIL',
  )
  assert.equal(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.adapter, 'script')
  assert.equal(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.modulePath, modulePath)
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.dryRunFile,
    'electronicscorporationofindialimited/jobs.json',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.homepageUrl,
    'https://www.ecil.co.in/',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.companyCareerPage,
    'https://www.ecil.co.in/jobopenings',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.currentOpeningsPage2Url,
    'https://www.ecil.co.in/jobopenings?page=2',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.companyDomain,
    'ecil.co.in',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.atsPlatform,
    'official-company-careers',
  )
  assert.equal(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.countryFilter, 'India')
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.paginationStrategy,
    'first-party-yiigrid-page-parameter-pagination-plus-pdf-documents',
  )
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.extractionStrategy,
    'verified-homepage-current-job-openings-link+verified-two-page-yiigrid+first-party-document-links+application-form-preference',
  )
  assert.equal(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.parser, 'custom-script')
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.normalizationProfile,
    'engineering-default',
  )
  assert.equal(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(
    ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG.verifiedSurfaceSummary,
    VERIFIED_SURFACE_SUMMARY,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.ecil\.co\.in\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.ecil\.co\.in\/jobopenings/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.ecil\.co\.in\/jobopenings\?page=2/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Showing 1-10 of 12 items/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Showing 11-12 of 12 items/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /first-party PDF documents/i)
})

test('ECIL local catalog hydrates into coverage without needing an alias entry', async () => {
  const { ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG)

  assert.equal(provider.companyName, 'Electronics Corporation of India Limited')
  assert.equal(provider.companyDomain, 'ecil.co.in')
  assert.match(provider.modulePath, /electronicscorporationofindialimited[\\/]script\.js$/i)
  assert.match(
    provider.dryRunFile,
    /electronicscorporationofindialimited[\\/]jobs\.json$/i,
  )

  const report = generateCompanyCoverageReport({
    csvText: 'Electronics Corporation of India Limited\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Electronics Corporation of India Limited',
      'electronicscorporationofindialimited',
      'Electronics Corporation of India Limited',
    ]],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      companyAliases,
      'Electronics Corporation of India Limited',
    ),
    false,
  )
})
