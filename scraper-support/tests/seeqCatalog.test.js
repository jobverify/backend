import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/seeq/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/seeq/catalog.js')
  } catch {
    assert.fail('Expected Seeq catalog module at ../../scraper/seeq/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/seeq/script.js')
  } catch {
    assert.fail('Expected Seeq scraper module at ../../scraper/seeq/script.js')
  }
}

test('Seeq catalogue records discovery policy without stale verification claims',async()=>{
 const {SEEQ_CATALOG,default:defaultCatalog}=await loadCatalogModule(),seeq=await loadScriptModule(),provider=hydrateProviderCatalogEntry(SEEQ_CATALOG)
 assert.equal(defaultCatalog,SEEQ_CATALOG);assert.equal(provider.source,'seeq');assert.equal(provider.companyName,'Seeq')
 assert.equal(provider.companyCareerPage,'https://www.seeq.com/careers/');assert.equal(provider.workableBoardUrl,'https://apply.workable.com/seeq/')
 assert.equal(provider.atsPlatform,'workable-public-get');assert.equal(provider.countryFilter,'India');assert.equal(provider.verifiedOn,null)
 assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null)
 assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.backfillMode,'discovery-only')
 assert.equal(provider.modulePath,modulePath);assert.equal(seeq.PROVIDER_METADATA.source,SEEQ_CATALOG.source)
 assert.equal(Object.prototype.hasOwnProperty.call(companyAliases,'Seeq'),false)
})

test('Seeq backlog row matches directly from the local catalog without alias churn', async () => {
  const { SEEQ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Seeq\n',
    catalog: [hydrateProviderCatalogEntry(SEEQ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Seeq', 'seeq', 'Seeq']],
  )
})

test('Seeq hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SEEQ_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SEEQ_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Seeq')
  assert.equal(provider.companyCareerPage, 'https://www.seeq.com/careers/')
  assert.equal(provider.companyDomain, 'seeq.com')
  assert.equal(provider.atsPlatform, 'workable-public-get')
  assert.match(provider.modulePath, /seeq[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /seeq[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
