import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ionic/catalog.js')
  } catch {
    assert.fail('Expected Ionic catalog module at ../../scraper/ionic/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ionic/script.js')
  } catch {
    assert.fail('Expected Ionic scraper module at ../../scraper/ionic/script.js')
  }
}

test("Ionic local catalog retains its source identity without stale verification or zero claims",async()=>{
   const {IONIC_CATALOG:c}=await loadCatalogModule(),ionic=await loadScriptModule(),p=hydrateProviderCatalogEntry(c)
   assert.equal(c.source,'ionic');assert.equal(c.companyName,'Ionic');assert.equal(c.officialBrandName,'Ionic')
   assert.equal(c.companyCareerPage,'https://ionic.io/about/jobs');assert.equal(c.leverProxyUrl,'https://ionic.io/api/lever');assert.equal(c.leverBoardUrl,'https://jobs.lever.co/Ionic')
   assert.equal(c.countryFilter,'Global');assert.equal(c.atsPlatform,'lever');assert.equal(c.adapter,'script')
   assert.equal(c.verifiedOn,null);assert.equal(c.verifiedPublicJobCount,null);assert.equal(c.verifiedIndiaJobCount,null)
   assert.equal(c.sourceScopeComplete,false);assert.equal(c.lifecycleCleanupAllowed,false)
   assert.match(p.modulePath,/ionic[\\/]script[.]js$/);assert.equal(ionic.CAREERS_URL,p.companyCareerPage)
   assert.equal(ionic.LEVER_PROXY_URL,c.leverProxyUrl);assert.equal(ionic.PROVIDER_METADATA.source,c.source)
  
})

test('Ionic exact-name backlog rows resolve directly from local provider metadata without shared aliases', async () => {
  const { IONIC_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Ionic\n',
    catalog: [hydrateProviderCatalogEntry(IONIC_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ionic', 'ionic', 'Ionic']],
  )
})

test('getScraperCatalog includes Ionic as a verified broken-Lever sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ionic')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ionic')
  assert.equal(provider.companyCareerPage, 'https://ionic.io/about/jobs')
  assert.equal(provider.companyDomain, 'ionic.io')
  assert.equal(provider.atsPlatform, 'lever')
  assert.match(provider.modulePath, /ionic[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ionic scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ionic')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ionic')
  assert.equal(scraper.provider.atsPlatform, 'lever')
  assert.match(scraper.dryRunFile, /ionic[\\/]jobs\.json$/i)
})
