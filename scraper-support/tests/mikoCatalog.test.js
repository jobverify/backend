import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/miko/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/miko/catalog.js')
  } catch {
    assert.fail('Expected Miko catalog module at ../../scraper/miko/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/miko/script.js')
  } catch {
    assert.fail('Expected Miko scraper module at ../../scraper/miko/script.js')
  }
}

test('Miko local catalog captures the verified first-party careers page plus public Keka jobs feed', async () => {
  const { MIKO_CATALOG } = await loadCatalogModule()
  const miko = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MIKO_CATALOG)

  assert.equal(MIKO_CATALOG.source, 'miko')
  assert.equal(MIKO_CATALOG.companyName, 'Miko')
  assert.equal(MIKO_CATALOG.officialBrandName, 'MIKO')
  assert.equal(MIKO_CATALOG.adapter, 'script')
  assert.equal(MIKO_CATALOG.modulePath, modulePath)
  assert.equal(MIKO_CATALOG.dryRunFile, 'miko/jobs.json')
  assert.equal(MIKO_CATALOG.companyCareerPage, 'https://in.miko.ai/pages/careers')
  assert.equal(MIKO_CATALOG.officialCareersHandoffUrl, 'https://rnc.keka.com/careers/')
  assert.equal(
    MIKO_CATALOG.careerPortalInfoUrl,
    'https://rnc.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    MIKO_CATALOG.activeJobsApiUrl,
    'https://rnc.keka.com/careers/api/embedjobs/default/active/d7f38166-f316-43c8-bc07-256b602da7a4',
  )
  assert.equal(MIKO_CATALOG.verifiedSampleJobUrl, 'https://rnc.keka.com/careers/jobdetails/134690')
  assert.equal(MIKO_CATALOG.companyDomain, 'miko.ai')
  assert.equal(MIKO_CATALOG.verifiedFirstPartyInlineOpeningCount, 31)
  assert.equal(MIKO_CATALOG.verifiedPublicJobCount, 25)
  assert.equal(MIKO_CATALOG.atsPlatform, 'keka')
  assert.equal(MIKO_CATALOG.countryFilter, 'India')
  assert.equal(
    MIKO_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-single-keka-active-jobs-api',
  )
  assert.equal(
    MIKO_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  )
  assert.equal(MIKO_CATALOG.parser, 'custom-script')
  assert.equal(MIKO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(MIKO_CATALOG.verifiedOn, '2026-07-16')
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /https:\/\/in\.miko\.ai\/pages\/careers/i)
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /https:\/\/rnc\.keka\.com\/careers\//i)
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /25 live public jobs/i)
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /31 static inline cards/i)
  assert.match(MIKO_CATALOG.verifiedSurfaceSummary, /HR Operations Intern/i)

  assert.equal(provider.source, 'miko')
  assert.equal(provider.companyName, 'Miko')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://in.miko.ai/pages/careers')
  assert.equal(provider.companyDomain, 'miko.ai')
  assert.match(provider.modulePath, /miko[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /miko[\\/]jobs\.json$/i)

  assert.equal(miko.PROVIDER_METADATA.source, provider.source)
  assert.equal(miko.CAREERS_URL, provider.companyCareerPage)
  assert.equal(miko.CAREER_PORTAL_INFO_URL, provider.careerPortalInfoUrl)
  assert.equal(miko.ACTIVE_JOBS_URL, provider.activeJobsApiUrl)
})

test('Miko exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { MIKO_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Miko\n',
    catalog: [hydrateProviderCatalogEntry(MIKO_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Miko', 'miko', 'Miko']],
  )
})
