import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stratogenttechnologyservices/catalog.js')
  } catch {
    assert.fail('Expected Stratogent Technology Services catalog module at ../../scraper/stratogenttechnologyservices/catalog.js')
  }
}

test('Stratogent Technology Services local catalog captures the verified email-only careers page', async () => {
  const { STRATOGENT_TECHNOLOGY_SERVICES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(STRATOGENT_TECHNOLOGY_SERVICES_CATALOG)

  assert.equal(provider.source, 'stratogenttechnologyservices')
  assert.equal(provider.companyName, 'Stratogent Technology Services')
  assert.equal(provider.companyCareerPage, 'https://www.stratogent.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /ptp\.cloud\/careers\/india/i)
  assert.match(provider.verifiedSurfaceSummary, /always hiring/i)
  assert.match(provider.verifiedSurfaceSummary, /careers-india@stratogent.com/i)
})

test('Stratogent Technology Services backlog row matches directly through the local catalog', async () => {
  const { STRATOGENT_TECHNOLOGY_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Stratogent Technology Services\n',
    catalog: [hydrateProviderCatalogEntry(STRATOGENT_TECHNOLOGY_SERVICES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
