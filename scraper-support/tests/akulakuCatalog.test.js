import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const akulakuModulePath = path.resolve(currentDir, '../../scraper/akulaku/script.js')

const loadAkulakuCatalog = async () => {
  try {
    return await import('../../scraper/akulaku/catalog.js')
  } catch {
    assert.fail('Expected Akulaku catalog module at ../../scraper/akulaku/catalog.js')
  }
}

const loadAkulakuModule = async () => {
  try {
    return await import('../../scraper/akulaku/script.js')
  } catch {
    assert.fail('Expected Akulaku scraper module at ../../scraper/akulaku/script.js')
  }
}

test('Akulaku local catalog requires current public native evidence without historical empty counts',async()=>{
 const{AKULAKU_CATALOG}=await loadAkulakuCatalog(),akulaku=await loadAkulakuModule()
 assert.equal(AKULAKU_CATALOG.source,'akulaku');assert.equal(AKULAKU_CATALOG.companyName,'Akulaku');assert.equal(AKULAKU_CATALOG.officialBrandName,'Akulaku')
 assert.equal(AKULAKU_CATALOG.adapter,'script');assert.equal(AKULAKU_CATALOG.officialJobsBoardUrl,'https://akulaku.zhiye.com/');assert.equal(AKULAKU_CATALOG.companyDomain,'akulaku.com');assert.equal(AKULAKU_CATALOG.countryFilter,'India')
 assert.equal(AKULAKU_CATALOG.verifiedOn,null);assert.equal(AKULAKU_CATALOG.verifiedPublicJobCount,null);assert.equal(AKULAKU_CATALOG.verifiedIndiaJobCount,null);assert.equal(AKULAKU_CATALOG.zeroResultPolicy,'evidence-required')
 assert.equal(AKULAKU_CATALOG.sourceCompanyWideScopeComplete,false);assert.equal(AKULAKU_CATALOG.lifecycleCleanupAllowed,false);assert.equal(AKULAKU_CATALOG.modulePath,akulakuModulePath);assert.equal(akulaku.PROVIDER_METADATA.source,AKULAKU_CATALOG.source)
 assert.match(AKULAKU_CATALOG.paginationStrategy,/final-enumerations-after-closing-details/);assert.match(AKULAKU_CATALOG.verifiedSurfaceSummary,/private account\/application fields never establish India or verified empty/)
})

test('Akulaku backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { AKULAKU_CATALOG } = await loadAkulakuCatalog()
  const provider = hydrateProviderCatalogEntry(AKULAKU_CATALOG)

  assert.equal(provider.companyName, 'Akulaku')
  assert.equal(provider.companyDomain, 'akulaku.com')
  assert.match(provider.modulePath, /akulaku[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /akulaku[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Akulaku'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Akulaku\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akulaku', 'akulaku', 'Akulaku']],
  )
})

test('buildScrapers and company coverage resolve Akulaku from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akulaku')
  const scraper = buildScrapers().find((item) => item.name === 'akulaku')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akulaku')
  assert.equal(provider.companyCareerPage, 'https://www.akulaku.com/staff-life')
  assert.match(scraper.dryRunFile, /akulaku[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akulaku\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akulaku', 'akulaku', 'Akulaku']],
  )
})
