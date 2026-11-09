import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/msc/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/msc/catalog.js')
  } catch {
    assert.fail('Expected MSC catalog module at ../../scraper/msc/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/msc/script.js')
  } catch {
    assert.fail('Expected MSC scraper module at ../../scraper/msc/script.js')
  }
}

test('MSC local catalog captures the verified Cornerstone inventory contract', async () => {
  const { MSC_CATALOG } = await loadCatalogModule()
  const msc = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MSC_CATALOG)

  assert.equal(provider.source, 'msc')
  assert.equal(provider.companyName, 'MSC')
  assert.equal(provider.officialBrandName, 'MSC Mediterranean Shipping Company')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.msc.com/en')
  assert.equal(provider.companyCareerPage, 'https://www.msc.com/en/careers')
  assert.equal(provider.companyDomain, 'msc.com')
  assert.equal(provider.atsPlatform, 'cornerstone-csod')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-csod-requisition-count-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-csod-handoff+exact-tenant+explicit-india-requisitions',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /msc[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /September 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.msc\.com\/en\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /msc\.csod\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /six India/i)
  assert.match(provider.verifiedSurfaceSummary, /incomplete or blocked/i)

  assert.equal(msc.PROVIDER_METADATA.source, MSC_CATALOG.source)
  assert.equal(msc.PROVIDER_METADATA.companyName, MSC_CATALOG.companyName)
  assert.equal(msc.PROVIDER_METADATA.companyCareerPage, MSC_CATALOG.companyCareerPage)
})

test('MSC exact backlog row resolves directly from local provider metadata', async () => {
  const { MSC_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MSC\n',
    catalog: [hydrateProviderCatalogEntry(MSC_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MSC', 'msc', 'MSC']],
  )
})

test('MSC hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MSC_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MSC_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MSC')
  assert.equal(provider.companyCareerPage, 'https://www.msc.com/en/careers')
  assert.equal(provider.companyDomain, 'msc.com')
  assert.match(provider.modulePath, /msc[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /msc[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})


test('MSC central metadata matches the current India-only Cornerstone source', async()=>{
 const {MSC_CATALOG}=await loadCatalogModule();const shared=getScraperCatalog().find(p=>p.source==='msc')
 for(const key of ['companyCareerPage','countryFilter','atsPlatform','paginationStrategy','extractionStrategy','verifiedOn'])assert.equal(shared[key],MSC_CATALOG[key],key)
})
