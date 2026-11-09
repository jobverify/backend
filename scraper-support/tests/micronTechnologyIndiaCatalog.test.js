import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/microntechnologyindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/microntechnologyindia/catalog.js')
  } catch {
    assert.fail('Expected Micron Technology India catalog module at ../../scraper/microntechnologyindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/microntechnologyindia/script.js')
  } catch {
    assert.fail('Expected Micron Technology India scraper module at ../../scraper/microntechnologyindia/script.js')
  }
}

test('Micron Technology India local catalog captures the verified first-party India careers page and public Eightfold API contract', async () => {
  const {
    MICRON_TECHNOLOGY_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const micron = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MICRON_TECHNOLOGY_INDIA_CATALOG)

  assert.equal(defaultCatalog, MICRON_TECHNOLOGY_INDIA_CATALOG)
  assert.equal(provider.source, 'microntechnologyindia')
  assert.equal(provider.companyName, 'Micron Technology India')
  assert.equal(provider.officialBrandName, 'Micron Technology')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://in.micron.com/')
  assert.equal(provider.companyCareerPage, 'https://in.micron.com/about/careers')
  assert.equal(
    provider.publicBoardUrl,
    'https://micron.eightfold.ai/careers?location=India&domain=micron.com',
  )
  assert.equal(provider.listingApiUrl, 'https://careers.micron.com/api/pcsx/search')
  assert.equal(
    provider.detailApiUrlTemplate,
    'https://careers.micron.com/api/pcsx/position_details?position_id={{jobId}}&domain=micron.com&hl=en',
  )
  assert.deepEqual(provider.apiQuery, {
    domain: 'micron.com',
    query: '',
    location: 'India',
  })
  assert.equal(provider.companyDomain, 'micron.com')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-india-careers-page-plus-public-eightfold-search-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+eightfold-search-api+public-position-urls+india-openings-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.dryRunEnrichPublicExperience, false)
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /microntechnologyindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/in\.micron\.com\/about\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.micron\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/micron\.eightfold\.ai\/careers\?location=India&domain=micron\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.micron\.com\/api\/pcsx\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /288 live India openings/i)
  assert.match(provider.verifiedSurfaceSummary, /STAFF ENG-HIG-HBM-LAYOUT/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.micron\.com\/careers\/job\//i)
  assert.match(provider.verifiedSurfaceSummary, /hyderabad, telangana, india/i)

  assert.equal(
    micron.PROVIDER_METADATA.source,
    MICRON_TECHNOLOGY_INDIA_CATALOG.source,
  )
  assert.equal(
    micron.PROVIDER_METADATA.companyName,
    MICRON_TECHNOLOGY_INDIA_CATALOG.companyName,
  )
  assert.equal(
    micron.PROVIDER_METADATA.publicBoardUrl,
    MICRON_TECHNOLOGY_INDIA_CATALOG.publicBoardUrl,
  )
})

test('Micron Technology India exact backlog name matches directly from local provider metadata', async () => {
  const { MICRON_TECHNOLOGY_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Micron Technology India\n',
    catalog: [hydrateProviderCatalogEntry(MICRON_TECHNOLOGY_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Micron Technology India', 'microntechnologyindia', 'Micron Technology India']],
  )
})

test('Micron Technology India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MICRON_TECHNOLOGY_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MICRON_TECHNOLOGY_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Micron Technology India')
  assert.equal(provider.companyCareerPage, 'https://in.micron.com/about/careers')
  assert.equal(provider.companyDomain, 'micron.com')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.match(provider.modulePath, /microntechnologyindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /microntechnologyindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('active Micron Technology India catalog disables dry-run public-page refetch', () => {
  const provider = getScraperCatalog().find((candidate) => candidate.source === 'microntechnologyindia')

  assert.ok(provider)
  assert.equal(provider.dryRunEnrichPublicExperience, false)
})
