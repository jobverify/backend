import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/anandgroup/catalog.js')
  } catch {
    assert.fail('Expected Anand Group catalog module at ../../scraper/anandgroup/catalog.js')
  }
}

test('Anand Group local catalog retains unknown current native inventory and original source identity',async()=>{
 const {ANAND_GROUP_CATALOG}=await loadCatalogModule(),provider=hydrateProviderCatalogEntry(ANAND_GROUP_CATALOG)
 assert.equal(provider.source,'anandgroup');assert.equal(provider.companyName,'Anand Group');assert.equal(provider.officialBrandName,'ANAND Group');assert.equal(provider.companyCareerPage,'https://www.anandgroupindia.com/careers-at-anand/');assert.equal(provider.joinUsPageUrl,'https://www.anandgroupindia.com/careers-at-anand/join-usnew/');assert.equal(provider.zeroResultPolicy,'evidence-required');assert.equal(provider.verifiedOn,null);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.sourceCompanyWideScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false);assert.match(provider.verifiedSurfaceSummary,/general ANAND Group hiring entry/);assert.equal(Object.hasOwn(companyAliases,'Anand Group'),false)
})

test('Anand Group backlog row matches directly from the local provider metadata without aliases', async () => {
  const { ANAND_GROUP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Anand Group\n',
    catalog: [hydrateProviderCatalogEntry(ANAND_GROUP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anand Group', 'anandgroup', 'Anand Group']],
  )
})

test('buildScrapers and company coverage resolve Anand Group from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anandgroup')
  const scraper = buildScrapers().find((item) => item.name === 'anandgroup')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Anand Group')
  assert.equal(provider.companyCareerPage, 'https://www.anandgroupindia.com/careers-at-anand/')
  assert.match(scraper.dryRunFile, /anandgroup[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anand Group\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anand Group', 'anandgroup', 'Anand Group']],
  )
})
