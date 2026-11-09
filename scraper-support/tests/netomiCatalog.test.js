import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/netomi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/netomi/catalog.js')
  } catch {
    assert.fail('Expected Netomi catalog module at ../../scraper/netomi/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/netomi/script.js')
  } catch {
    assert.fail('Expected Netomi scraper module at ../../scraper/netomi/script.js')
  }
}

test("Netomi local catalog preserves the configured channel and unresolved current publisher state",async()=>{
   const {NETOMI_CATALOG:c}=await loadCatalogModule(),netomi=await loadScraperModule(),p=hydrateProviderCatalogEntry(c)
   assert.equal(p.source,'netomi');assert.equal(p.companyName,'Netomi');assert.equal(p.officialBrandName,'Netomi')
   assert.equal(p.homepageUrl,'https://www.netomi.com/');assert.equal(p.companyCareerPage,'https://www.netomi.com/careers')
   assert.equal(p.officialLeverBoardUrl,'https://jobs.lever.co/netomi');assert.equal(p.leverApiUrl,'https://api.lever.co/v0/postings/netomi?mode=json')
   assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
   assert.equal(p.countryFilter,'Global');assert.equal(p.adapter,'script');assert.equal(p.sourceScopeComplete,false)
   assert.equal(p.modulePath,modulePath);assert.equal(netomi.PROVIDER_METADATA.companyCareerPage,c.companyCareerPage)
   assert.match(p.verifiedSurfaceSummary,/publisher binding may remain held/)
  
})

test('Netomi exact backlog row resolves directly from local provider metadata', async () => {
  const { NETOMI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Netomi\n',
    catalog: [hydrateProviderCatalogEntry(NETOMI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Netomi', 'netomi', 'Netomi']],
  )
})

test('Netomi hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NETOMI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NETOMI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netomi')
  assert.equal(provider.companyCareerPage, 'https://www.netomi.com/careers')
  assert.equal(provider.companyDomain, 'netomi.com')
  assert.match(provider.modulePath, /netomi[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /netomi[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
