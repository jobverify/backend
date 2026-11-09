import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const liciousModulePath = path.resolve(currentDir, '../../scraper/licious/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/licious/catalog.js')
  } catch {
    assert.fail('Expected Licious catalog module at ../../scraper/licious/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/licious/script.js')
  } catch {
    assert.fail('Expected Licious scraper module at ../../scraper/licious/script.js')
  }
}

test('Licious local catalog describes its current MyNextHire migration', async () => {
  const { LICIOUS_CATALOG } = await loadCatalogModule()
  const licious = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LICIOUS_CATALOG)
  assert.equal(provider.source, 'licious')
  assert.equal(provider.companyName, 'Licious')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.licious.in/careers')
  assert.equal(provider.officialCareersHandoffUrl, 'https://www.licious.in/careers/jobs')
  assert.equal(provider.publicPortalUrl, 'https://licious.mynexthire.com/employer/jobs/careers')
  assert.equal(provider.companyDomain, 'licious.in')
  assert.equal(provider.atsPlatform, 'mynexthire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.equal(provider.modulePath, liciousModulePath)
  assert.match(provider.verifiedSurfaceSummary, /1163/)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Licious'), false)
  assert.equal(licious.PROVIDER_METADATA, LICIOUS_CATALOG)
})

test('Licious backlog row matches directly from the local catalog without alias churn', async () => {
  const { LICIOUS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Licious\n',
    catalog: [hydrateProviderCatalogEntry(LICIOUS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Licious', 'licious', 'Licious']],
  )
})
