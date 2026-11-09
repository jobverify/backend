import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadStanPlusCatalog = async () => {
  try {
    return await import('../../scraper/stanplus/catalog.js')
  } catch {
    assert.fail('Expected StanPlus catalog module at ../../scraper/stanplus/catalog.js')
  }
}

test('StanPlus catalog metadata captures the verified RED.Health careers page and blank-shell Darwinbox public routes', async () => {
  const { STAN_PLUS_CATALOG } = await loadStanPlusCatalog()
  const provider = hydrateProviderCatalogEntry(STAN_PLUS_CATALOG)

  assert.equal(provider.source, 'stanplus')
  assert.equal(provider.companyName, 'StanPlus')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.red.health/career')
  assert.equal(provider.officialHomepageUrl, 'https://www.red.health/')
  assert.equal(provider.contactUsUrl, 'https://www.red.health/contact-us')
  assert.equal(provider.termsUrl, 'https://www.red.health/terms-conditions')
  assert.equal(provider.officialBrandName, 'RED.Health')
  assert.equal(provider.legalEntityName, 'Stanplus Technologies Private Limited')
  assert.equal(provider.officialCareersHandoffUrl, 'https://redhealth.darwinbox.in/ms/candidatev2/main')
  assert.equal(provider.darwinboxJobsUrl, 'https://redhealth.darwinbox.in/jobs')
  assert.equal(provider.darwinboxCandidateCareersUrl, 'https://redhealth.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxPublicHomeUrl, 'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/home')
  assert.equal(provider.darwinboxPublicAllJobsUrl, 'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.darwinboxListingApiUrl, 'https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-page-plus-darwinbox-shell-and-blocked-api-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-darwinbox-handoff+reachable-public-shells+blocked-listing-api-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'red.health')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.modulePath, /stanplus[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stanplus[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /generic public Darwinbox JavaScript shells/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 403 block/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public StanPlus jobs surface/i)
})

test('StanPlus matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { STAN_PLUS_CATALOG } = await loadStanPlusCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'StanPlus\n',
    catalog: [hydrateProviderCatalogEntry(STAN_PLUS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['StanPlus', 'stanplus', 'StanPlus']],
  )
})
