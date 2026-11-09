import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dhanModulePath = path.resolve(currentDir, '../../scraper/dhan/script.js')

const loadDhanCatalog = async () => {
  try {
    return await import('../../scraper/dhan/catalog.js')
  } catch {
    assert.fail('Expected Dhan catalog module at ../../scraper/dhan/catalog.js')
  }
}

test('Dhan catalog binds the current declared Raise group board with unknown exact-brand scope',async()=>{
 const {DHAN_CATALOG}=await loadDhanCatalog(),provider=hydrateProviderCatalogEntry(DHAN_CATALOG)
 assert.equal(provider.companyName,'Dhan');assert.equal(provider.companyCareerPage,'https://dhan.co/career/');assert.equal(provider.officialCareersHandoffUrl,'https://raise.keka.com/careers')
 assert.equal(provider.careersApiOrigin,'https://raise.keka.com/careers/api');assert.equal(provider.jobsApiUrl,'https://raise.keka.com/careers/api/embedjobs/default/active/7669ff3a-2b35-4442-9bac-9f9ae4b718b3')
 assert.equal(provider.sourceEmployerScope,'corporate-declared-group-board');assert.equal(provider.sourceExactBrandRoleScopeVerified,false);assert.equal(provider.verifiedOn,null);assert.equal(provider.companyGlobalTotal,null);assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.modulePath,dhanModulePath)
})

test('Dhan backlog row matches directly from provider metadata without aliases', async () => {
  const { DHAN_CATALOG } = await loadDhanCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Dhan\n',
    catalog: [hydrateProviderCatalogEntry(DHAN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dhan', 'dhan', 'Dhan']],
  )
})

test('buildScrapers and company coverage resolve Dhan from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dhan')
  const scraper = buildScrapers().find((item) => item.name === 'dhan')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Dhan')
  assert.equal(provider.companyCareerPage, 'https://dhan.co/career/')
  assert.match(scraper.dryRunFile, /dhan[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dhan\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dhan', 'dhan', 'Dhan']],
  )
})
