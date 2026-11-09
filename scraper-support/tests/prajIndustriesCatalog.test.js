import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadPrajIndustriesCatalog = async () => {
  try {
    return await import('../../scraper/prajindustries/catalog.js')
  } catch {
    assert.fail('Expected Praj Industries catalog module at ../../scraper/prajindustries/catalog.js')
  }
}

test('Praj Industries catalog captures the verified first-party careers page plus the current blocked Darwinbox runtime state', async () => {
  const { PRAJ_INDUSTRIES_CATALOG } = await loadPrajIndustriesCatalog()

  assert.equal(PRAJ_INDUSTRIES_CATALOG.source, 'prajindustries')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.companyName, 'Praj Industries')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.officialBrandName, 'Praj Industries')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.adapter, 'script')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.homepageUrl, 'https://www.praj.net/')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.companyCareerPage, 'https://www.praj.net/careers/')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.companyDomain, 'praj.net')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.countryFilter, 'India')
  assert.equal(
    PRAJ_INDUSTRIES_CATALOG.paginationStrategy,
    'verified-careers-page-plus-darwinbox-shell-and-blocked-api-validation',
  )
  assert.equal(
    PRAJ_INDUSTRIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-darwinbox-handoff+reachable-public-shells+blocked-listing-api-return-empty',
  )
  assert.equal(PRAJ_INDUSTRIES_CATALOG.officialCareersHandoffUrl, 'https://praj.darwinbox.in/ms/candidate/careers')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxOrigin, 'https://praj.darwinbox.in')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxJobsUrl, 'https://praj.darwinbox.in/jobs')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxCandidateCareersUrl, 'https://praj.darwinbox.in/ms/candidate/careers')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxPublicHomeUrl, 'https://praj.darwinbox.in/ms/candidatev2/main/careers/home')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxPublicAllJobsUrl, 'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(PRAJ_INDUSTRIES_CATALOG.darwinboxListingApiUrl, 'https://praj.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.deepEqual(PRAJ_INDUSTRIES_CATALOG.darwinboxShellRouteUrls, [
    'https://praj.darwinbox.in/jobs',
    'https://praj.darwinbox.in/ms/candidate/careers',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(Object.prototype.hasOwnProperty.call(PRAJ_INDUSTRIES_CATALOG, 'officialListingApiUrl'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(PRAJ_INDUSTRIES_CATALOG, 'officialJobDetailApiUrl'), false)
  assert.equal(PRAJ_INDUSTRIES_CATALOG.verifiedOn, '2026-08-14')
  assert.match(PRAJ_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(PRAJ_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /SEARCH FOR JOB/i)
  assert.match(PRAJ_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /Cloudflare 403/i)
  assert.match(PRAJ_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /no trustworthy public Praj jobs surface/i)
  assert.match(PRAJ_INDUSTRIES_CATALOG.modulePath, /scraper[\\/]prajindustries[\\/]script\.js$/i)
  assert.match(PRAJ_INDUSTRIES_CATALOG.dryRunFile, /prajindustries[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Praj Industries'), false)
})

test('getScraperCatalog exposes Praj Industries as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prajindustries')
  const scraper = buildScrapers().find((item) => item.name === 'prajindustries')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Praj Industries')
  assert.equal(provider.companyCareerPage, 'https://www.praj.net/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Praj Industries'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Praj Industries\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Praj Industries', 'prajindustries', 'Praj Industries']],
  )
})
