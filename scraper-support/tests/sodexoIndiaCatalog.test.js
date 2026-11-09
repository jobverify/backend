import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadSodexoIndiaCatalog = async () => {
  try {
    return await import('../../scraper/sodexoindia/catalog.js')
  } catch {
    assert.fail('Expected Sodexo India catalog module at ../../scraper/sodexoindia/catalog.js')
  }
}

test('Sodexo India catalog metadata captures the verified careers page and AccessHr handoff without shared-registry coupling', async () => {
  const { SODEXO_INDIA_CATALOG } = await loadSodexoIndiaCatalog()
  const provider = hydrateProviderCatalogEntry(SODEXO_INDIA_CATALOG)

  assert.equal(provider.source, 'sodexoindia')
  assert.equal(provider.companyName, 'Sodexo India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sodexo.in/careers')
  assert.equal(provider.officialHomepageUrl, 'https://www.sodexo.in/')
  assert.equal(provider.accessHrJobsUrl, 'https://accesshr.in.sodexo.com/#/jobs')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-page-plus-accesshr-login-js-shell-or-timeout-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-accesshr-jobs-link+verified-login-shell-js-shell-or-timeout-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sodexo.in')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.match(provider.modulePath, /sodexoindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sodexoindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sodexo\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/accesshr\.in\.sodexo\.com\/#\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /JavaScript app shell|timeout/i)
})

test('Sodexo India matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { SODEXO_INDIA_CATALOG } = await loadSodexoIndiaCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Sodexo India\n',
    catalog: [hydrateProviderCatalogEntry(SODEXO_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sodexo India', 'sodexoindia', 'Sodexo India']],
  )
})
