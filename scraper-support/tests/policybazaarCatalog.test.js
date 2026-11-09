import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/policybazaar/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/policybazaar/catalog.js')
  } catch {
    assert.fail('Expected Policybazaar catalog module at ../../scraper/policybazaar/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/policybazaar/script.js')
  } catch {
    assert.fail('Expected Policybazaar scraper module at ../../scraper/policybazaar/script.js')
  }
}

test('Policybazaar local catalog captures the verified first-party inline careers surface', async () => {
  const { POLICYBAZAAR_CATALOG } = await loadCatalogModule()
  const policybazaar = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(POLICYBAZAAR_CATALOG)

  assert.equal(provider.source, 'policybazaar')
  assert.equal(provider.companyName, 'Policybazaar')
  assert.equal(provider.officialBrandName, 'Policybazaar')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.policybazaar.com/')
  assert.equal(provider.companyCareerPage, 'https://www.policybazaar.com/careers/')
  assert.equal(provider.publicBoardUrl, 'https://www.policybazaar.com/careers/')
  assert.equal(provider.companyDomain, 'policybazaar.com')
  assert.deepEqual(provider.verifiedHiringCities, [
    'Gurugram',
    'Mumbai',
    'Pune',
    'Kolkata',
    'Chennai',
    'Bangalore',
    'Hyderabad',
  ])
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-native-exact-employer-india-list-and-detail-reading;incomplete')
  assert.equal(
    provider.extractionStrategy,
    'official-employer-identity+native-enabled-application+explicit-India+original-public-dates',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-23')
  assert.equal(provider.verifiedPublicOpeningCount, null)
  assert.equal(provider.observedRoleCardCount, 4)
  assert.equal(provider.currentInventoryStatus, 'coverage-gap')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /policybazaar[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 23, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.policybazaar\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /4 inline role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Sales Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers in Technology/i)
  assert.match(provider.verifiedSurfaceSummary, /position-select resume upload form/i)

  assert.equal(policybazaar.PROVIDER_METADATA.source, POLICYBAZAAR_CATALOG.source)
  assert.equal(policybazaar.PROVIDER_METADATA.companyName, POLICYBAZAAR_CATALOG.companyName)
  assert.equal(
    policybazaar.PROVIDER_METADATA.companyCareerPage,
    POLICYBAZAAR_CATALOG.companyCareerPage,
  )
})

test('Policybazaar and PB Fintech backlog rows resolve through one provider and the shared alias map', async () => {
  const { POLICYBAZAAR_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(POLICYBAZAAR_CATALOG)

  assert.equal(companyAliases['PB Fintech'], 'policybazaar')

  const report = generateCompanyCoverageReport({
    csvText: 'Policybazaar\nPB Fintech\n',
    catalog: [provider],
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Policybazaar', 'policybazaar', 'Policybazaar'],
      ['PB Fintech', 'policybazaar', 'Policybazaar'],
    ],
  )
})

test('Policybazaar hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { POLICYBAZAAR_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(POLICYBAZAAR_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Policybazaar')
  assert.equal(provider.companyCareerPage, 'https://www.policybazaar.com/careers/')
  assert.equal(provider.companyDomain, 'policybazaar.com')
  assert.match(provider.modulePath, /policybazaar[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /policybazaar[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})


test('Policybazaar native metadata preserves incomplete scope and old original publications',async()=>{
 const {POLICYBAZAAR_CATALOG:provider}=await loadCatalogModule()
 assert.equal(provider.nativeEmployerOrganizationId,'303524');assert.equal(provider.nativeValidatedIndiaDetailCount,2);assert.equal(provider.observedEligibleCount,0);assert.equal(provider.firstParty,false);assert.equal(provider.sourceListingComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
})
