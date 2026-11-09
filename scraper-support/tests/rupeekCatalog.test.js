import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rupeek/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rupeek/catalog.js')
  } catch {
    assert.fail('Expected Rupeek catalog module at ../../scraper/rupeek/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/rupeek/script.js')
  } catch {
    assert.fail('Expected Rupeek scraper module at ../../scraper/rupeek/script.js')
  }
}

test('Rupeek local catalog captures the verified first-party careers page and LinkedIn handoff board', async () => {
  const { RUPEEK_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rupeek = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(RUPEEK_CATALOG)

  assert.equal(defaultCatalog, RUPEEK_CATALOG)
  assert.equal(provider.source, 'rupeek')
  assert.equal(provider.companyName, 'Rupeek')
  assert.equal(provider.officialBrandName, 'Rupeek')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://rupeek.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://rupeek.com/about/careers')
  assert.equal(provider.officialCareersCanonicalUrl, 'https://rupeek.com/careers')
  assert.equal(provider.companyDomain, 'rupeek.com')
  assert.equal(provider.atsPlatform, 'linkedin-company-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+html-job-cards+linkedin-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /rupeek[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rupeek\.com\/about\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rupeek\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /LinkedIn/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rupeek'), false)

  assert.equal(rupeek.PROVIDER_METADATA.source, RUPEEK_CATALOG.source)
  assert.equal(rupeek.PROVIDER_METADATA.companyName, RUPEEK_CATALOG.companyName)
})

test('Rupeek exact backlog row matches directly from local provider metadata', async () => {
  const { RUPEEK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rupeek\n',
    catalog: [hydrateProviderCatalogEntry(RUPEEK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rupeek', 'rupeek', 'Rupeek']],
  )
})

test('Rupeek hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { RUPEEK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RUPEEK_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rupeek')
  assert.equal(provider.companyCareerPage, 'https://rupeek.com/careers')
  assert.equal(provider.companyDomain, 'rupeek.com')
  assert.equal(provider.atsPlatform, 'linkedin-company-jobs')
  assert.match(provider.modulePath, /rupeek[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /rupeek[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
