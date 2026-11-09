import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadBacancyCatalog = async () => {
  try {
    return await import('../../scraper/bacancytechnology/catalog.js')
  } catch {
    assert.fail('Expected Bacancy Technology catalog module at ../../scraper/bacancytechnology/catalog.js')
  }
}

test('Bacancy Technology provider metadata captures the verified Cloudflare-blocked first-party jobs surface', async () => {
  const { BACANCY_TECHNOLOGY_CATALOG } = await loadBacancyCatalog()
  const provider = hydrateProviderCatalogEntry(BACANCY_TECHNOLOGY_CATALOG)

  assert.equal(provider.source, 'bacancytechnology')
  assert.equal(provider.companyName, 'Bacancy Technology')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.bacancytechnology.com/careers')
  assert.equal(provider.companyDomain, 'bacancytechnology.com')
  assert.equal(provider.jobsPageUrl, 'https://www.bacancytechnology.com/jobs/careers-apply.php')
  assert.equal(provider.atsPlatform, 'official-company-careers-blocked-by-cloudflare')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-plus-cloudflare-block-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-jobs-page-listing+live-403-cloudflare-block+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /bacancytechnology[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare block page/i)
})

test('Bacancy Technology backlog row matches directly from the local provider metadata', async () => {
  const { BACANCY_TECHNOLOGY_CATALOG } = await loadBacancyCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Bacancy Technology\n',
    catalog: [hydrateProviderCatalogEntry(BACANCY_TECHNOLOGY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bacancy Technology', 'bacancytechnology', 'Bacancy Technology']],
  )
})
