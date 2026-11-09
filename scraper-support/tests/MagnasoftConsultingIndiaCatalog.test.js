import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/magnasoftconsultingindia/catalog.js')
  } catch {
    assert.fail('Expected Magnasoft Consulting India catalog module at ../../scraper/magnasoftconsultingindia/catalog.js')
  }
}

test('Magnasoft Consulting India local catalog captures the verified Zoho Recruit board contract', async () => {
  const { MAGNASOFT_CONSULTING_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAGNASOFT_CONSULTING_INDIA_CATALOG)

  assert.equal(provider.source, 'magnasoftconsultingindia')
  assert.equal(provider.companyName, 'Magnasoft Consulting India')
  assert.equal(provider.officialBrandName, 'Magnasoft')
  assert.equal(provider.companyCareerPage, 'https://www.magnasoft.com/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://magnasoft.zohorecruit.in/jobs/Careers')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003493001/AIML-Engineer?source=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicPostingCount, 2)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /magnasoft\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /2 India roles/i)
})

test('Magnasoft Consulting India exact-name backlog row resolves directly from the local provider contract', async () => {
  const { MAGNASOFT_CONSULTING_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Magnasoft Consulting India\n',
    catalog: [hydrateProviderCatalogEntry(MAGNASOFT_CONSULTING_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Magnasoft Consulting India', 'magnasoftconsultingindia', 'Magnasoft Consulting India']],
  )
})
