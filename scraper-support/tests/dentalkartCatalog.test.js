import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadDentalkartCatalog = async () => {
  try {
    return await import('../../scraper/dentalkart/catalog.js')
  } catch {
    assert.fail('Expected Dentalkart catalog module at ../../scraper/dentalkart/catalog.js')
  }
}

test('Dentalkart catalog describes an observed native board without static inventory authority',async()=>{
 const {DENTALKART_CATALOG:catalog,default:defaultCatalog}=await loadDentalkartCatalog();assert.equal(catalog,defaultCatalog)
 assert.equal(catalog.source,'dentalkart');assert.equal(catalog.companyName,'Dentalkart');assert.equal(catalog.legalEmployerName,'VASA Denticity Limited')
 assert.equal(catalog.companyCareerPage,'https://www.dentalkart.com/careers');assert.equal(catalog.officialCareersHandoffUrl,'https://dentalkart.zohorecruit.in/jobs/Careers')
 assert.equal(catalog.zohoJobsApiUrl,null);assert.equal(catalog.verifiedOn,null);assert.equal(catalog.sourceScopeComplete,false);assert.equal(catalog.companyGlobalTotal,null);assert.equal(catalog.lifecycleCleanupAllowed,false)
 assert.equal(Object.hasOwn(companyAliases,'Dentalkart'),false)
})

test('Dentalkart backlog matching works directly from the local catalog metadata', async () => {
  const { DENTALKART_CATALOG } = await loadDentalkartCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Dentalkart\n',
    catalog: [DENTALKART_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dentalkart', 'dentalkart', 'Dentalkart']],
  )
})

test('buildScrapers and company coverage resolve Dentalkart from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dentalkart')
  const scraper = buildScrapers().find((item) => item.name === 'dentalkart')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Dentalkart')
  assert.equal(provider.companyCareerPage, 'https://www.dentalkart.com/careers')
  assert.match(scraper.dryRunFile, /dentalkart[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dentalkart\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dentalkart', 'dentalkart', 'Dentalkart']],
  )
})
