import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const qureAiModulePath = path.resolve(currentDir, '../../scraper/qureai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/qureai/catalog.js')
  } catch {
    assert.fail('Expected Qure.ai catalog module at ../../scraper/qureai/catalog.js')
  }
}

test('Qure.ai local catalog captures the verified first-party careers portal and embedded public jobs payload metadata', async () => {
  const { QURE_AI_CATALOG, VERIFIED_SURFACE_SUMMARY } = await loadCatalogModule()

  assert.equal(QURE_AI_CATALOG.source, 'qureai')
  assert.equal(QURE_AI_CATALOG.companyName, 'Qure.ai')
  assert.equal(QURE_AI_CATALOG.officialBrandName, 'Qure.ai')
  assert.equal(QURE_AI_CATALOG.adapter, 'script')
  assert.equal(QURE_AI_CATALOG.modulePath, qureAiModulePath)
  assert.equal(QURE_AI_CATALOG.dryRunFile, 'qureai/jobs.json')
  assert.equal(QURE_AI_CATALOG.companyCareerPage, 'https://jobs.qure.ai/')
  assert.equal(QURE_AI_CATALOG.careersPortalUrl, 'https://career.qure.ai/jobs/Careers')
  assert.equal(QURE_AI_CATALOG.companyDomain, 'qure.ai')
  assert.equal(QURE_AI_CATALOG.embeddedJobsInputId, 'jobs')
  assert.equal(QURE_AI_CATALOG.verifiedPublicJobCount, 13)
  assert.equal(QURE_AI_CATALOG.verifiedIndiaRoleCount, 8)
  assert.equal(QURE_AI_CATALOG.verifiedSampleIndiaJobId, '102070000016750008')
  assert.equal(QURE_AI_CATALOG.verifiedSampleIndiaJobTitle, 'IT Infra Engineer')
  assert.equal(QURE_AI_CATALOG.atsPlatform, 'zohorecruit-embedded')
  assert.equal(QURE_AI_CATALOG.countryFilter, 'India')
  assert.equal(
    QURE_AI_CATALOG.paginationStrategy,
    'single-official-embedded-jobs-payload',
  )
  assert.equal(
    QURE_AI_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-zohorecruit-portal+embedded-public-jobs-payload+india-country-filter',
  )
  assert.equal(QURE_AI_CATALOG.parser, 'custom-script')
  assert.equal(QURE_AI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(QURE_AI_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(QURE_AI_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.qure\.ai\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/career\.qure\.ai\/jobs\/Careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b13 published public roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b8 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Qure\.ai Technologies Private Limited/i)
})
