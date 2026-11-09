import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ikya/catalog.js')
  } catch {
    assert.fail('Expected Ikya catalog module at ../../scraper/ikya/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ikya/script.js')
  } catch {
    assert.fail('Expected Ikya scraper module at ../../scraper/ikya/script.js')
  }
}



test('Ikya exact-name backlog rows resolve directly from local provider metadata without shared aliases', async () => {
  const { IKYA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Ikya\n',
    catalog: [hydrateProviderCatalogEntry(IKYA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ikya', 'ikya', 'Ikya']],
  )
})

test('getScraperCatalog includes Ikya as a verified SmartRecruiters empty-board provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ikya')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ikya')
  assert.equal(provider.companyCareerPage, 'https://careers.smartrecruiters.com/Ikya1')
  assert.equal(provider.homepageUrl, 'http://www.ikya.com/')
  assert.equal(provider.companyDomain, 'ikya.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.match(provider.modulePath, /ikya[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ikya scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ikya')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ikya')
  assert.equal(scraper.provider.atsPlatform, 'smartrecruiters')
  assert.match(scraper.dryRunFile, /ikya[\\/]jobs\.json$/i)
})

test('ikya local and selected metadata expose current discovery-only GET policy without historical zero promotion',async()=>{const local=(await import('../../scraper/ikya/catalog.js')).IKYA_CATALOG,selected=getScraperCatalog().find(p=>p.source==='ikya');for(const p of [local,selected]){assert.equal(p.verifiedOn,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.zeroResultPolicy,'coverage-gap');assert.equal(p.countryFilter,'India');assert.match(p.extractionStrategy,/original-all-country/)}assert.equal(selected.companyName,local.companyName);assert.equal(selected.companyCareerPage,local.companyCareerPage)})
