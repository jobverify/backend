import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const deHaatModulePath = path.resolve(currentDir, '../../scraper/dehaat/script.js')

const loadDeHaatCatalog = async () => {
  try {
    return await import('../../scraper/dehaat/catalog.js')
  } catch {
    assert.fail('Expected DeHaat catalog module at ../../scraper/dehaat/catalog.js')
  }
}

const loadDeHaatModule = async () => {
  try {
    return await import('../../scraper/dehaat/script.js')
  } catch {
    assert.fail('Expected DeHaat scraper module at ../../scraper/dehaat/script.js')
  }
}



test('DeHaat backlog row hydrates locally without needing a shared alias entry', async () => {
  const { DEHAAT_CATALOG } = await loadDeHaatCatalog()
  const provider = hydrateProviderCatalogEntry(DEHAAT_CATALOG)

  assert.equal(provider.companyName, 'DeHaat')
  assert.equal(provider.companyDomain, 'agrevolution.in')
  assert.match(provider.modulePath, /dehaat[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dehaat[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DeHaat'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'DeHaat\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DeHaat', 'dehaat', 'DeHaat']],
  )
})

test('buildScrapers and company coverage resolve DeHaat from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dehaat')
  const scraper = buildScrapers().find((item) => item.name === 'dehaat')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'DeHaat')
  assert.equal(provider.companyCareerPage, 'https://agrevolution.in/careers')
  assert.match(scraper.dryRunFile, /dehaat[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'DeHaat\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DeHaat', 'dehaat', 'DeHaat']],
  )
})

test('dehaat local and selected metadata expose current discovery-only GET policy without historical zero promotion',async()=>{const local=(await import('../../scraper/dehaat/catalog.js')).DEHAAT_CATALOG,selected=getScraperCatalog().find(p=>p.source==='dehaat');for(const p of [local,selected]){assert.equal(p.verifiedOn,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false);assert.equal(p.zeroResultPolicy,'coverage-gap');assert.equal(p.countryFilter,'India');assert.match(p.extractionStrategy,/original-all-country/)}assert.equal(selected.companyName,local.companyName);assert.equal(selected.companyCareerPage,local.companyCareerPage)})
