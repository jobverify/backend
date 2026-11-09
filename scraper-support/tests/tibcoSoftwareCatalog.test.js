import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tibcosoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tibcosoftware/catalog.js')
  } catch {
    assert.fail('Expected TIBCO Software catalog module at ../../scraper/tibcosoftware/catalog.js')
  }
}

test('TIBCO Software local catalog captures the verified generic multi-brand careers handoff without alias churn', async () => {
  const { TIBCO_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TIBCO_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, TIBCO_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'tibcosoftware')
  assert.equal(provider.companyName, 'TIBCO Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tibco.com/contact-us')
  assert.equal(provider.companyDomain, 'tibco.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /careers\.cloud\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /AWS WAF|empty 202 challenge response/i)
  assert.match(provider.verifiedSurfaceSummary, /Citrix/i)
  assert.match(provider.verifiedSurfaceSummary, /Spotfire/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TIBCO Software'), false)
})

test('TIBCO Software backlog row matches directly from the local catalog', async () => {
  const { TIBCO_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TIBCO Software\n',
    catalog: [hydrateProviderCatalogEntry(TIBCO_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TIBCO Software', 'tibcosoftware', 'TIBCO Software']],
  )
})

test('TIBCO Software hydrated local catalog stays script-runner compatible', async () => {
  const { TIBCO_SOFTWARE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TIBCO_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
