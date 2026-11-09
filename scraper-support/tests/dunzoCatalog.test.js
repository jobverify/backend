import {getScraperCatalog} from '../providers/index.js'
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dunzo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dunzo/catalog.js')
  } catch {
    assert.fail('Expected Dunzo catalog module at ../../scraper/dunzo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/dunzo/script.js')
  } catch {
    assert.fail('Expected Dunzo scraper module at ../../scraper/dunzo/script.js')
  }
}



test('Dunzo exact backlog name matches directly from the local provider contract', async () => {
  const { DUNZO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dunzo\n',
    catalog: [hydrateProviderCatalogEntry(DUNZO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dunzo', 'dunzo', 'Dunzo']],
  )
})

test('dunzo local and selected metadata expose current discovery-only GET policy without historical zero promotion',async()=>{const local=(await import('../../scraper/dunzo/catalog.js')).DUNZO_CATALOG,selected=getScraperCatalog().find(p=>p.source==='dunzo');for(const p of [local,selected]){assert.equal(p.verifiedOn,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.zeroResultPolicy,'coverage-gap');assert.equal(p.countryFilter,'India');assert.match(p.extractionStrategy,/original-all-country/)}assert.equal(selected.companyName,local.companyName);assert.equal(selected.companyCareerPage,local.companyCareerPage)})
