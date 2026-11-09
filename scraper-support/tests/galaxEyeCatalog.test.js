import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const galaxEyeModulePath = path.resolve(currentDir, '../../scraper/galaxeye/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/galaxeye/catalog.js')
  } catch {
    assert.fail('Expected GalaxEye catalog module at ../../scraper/galaxeye/catalog.js')
  }
}

const loadGalaxEyeModule = async () => {
  try {
    return await import('../../scraper/galaxeye/script.js')
  } catch {
    assert.fail('Expected GalaxEye scraper module at ../../scraper/galaxeye/script.js')
  }
}

test('GalaxEye local catalog captures the verified first-party job portal and fail-closed public jobs shell contract', async () => {
  const { GALAXEYE_CATALOG } = await loadCatalogModule()
  const galaxEye = await loadGalaxEyeModule()

  assert.equal(GALAXEYE_CATALOG.source, 'galaxeye')
  assert.equal(GALAXEYE_CATALOG.companyName, 'GalaxEye')
  assert.equal(GALAXEYE_CATALOG.officialBrandName, 'Galaxeye Space Solutions Private Limited')
  assert.equal(GALAXEYE_CATALOG.adapter, 'script')
  assert.equal(GALAXEYE_CATALOG.homepageUrl, 'https://galaxeye.space/')
  assert.equal(GALAXEYE_CATALOG.companyCareerPage, 'https://galaxeye.space/job-portal')
  assert.equal(
    GALAXEYE_CATALOG.officialCareersHandoffUrl,
    'https://careers.galaxeye.space/jobs/Careers',
  )
  assert.equal(
    GALAXEYE_CATALOG.publicJobsShellUrl,
    'https://careers.galaxeye.space/jobs/Careers',
  )
  assert.equal(GALAXEYE_CATALOG.companyDomain, 'galaxeye.space')
  assert.equal(GALAXEYE_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GALAXEYE_CATALOG.countryFilter, 'India')
  assert.equal(
    GALAXEYE_CATALOG.paginationStrategy,
    'verified-homepage-plus-first-party-job-portal-plus-empty-public-jobs-shell',
  )
  assert.equal(
    GALAXEYE_CATALOG.extractionStrategy,
    'verified-homepage+verified-job-portal-handoff+verified-shell-only-public-jobs-page-return-empty',
  )
  assert.equal(GALAXEYE_CATALOG.parser, 'custom-script')
  assert.equal(GALAXEYE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GALAXEYE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(GALAXEYE_CATALOG.dryRunFile, 'galaxeye/jobs.json')
  assert.match(GALAXEYE_CATALOG.verifiedSurfaceSummary, /https:\/\/galaxeye\.space\//i)
  assert.match(GALAXEYE_CATALOG.verifiedSurfaceSummary, /https:\/\/galaxeye\.space\/job-portal/i)
  assert.match(
    GALAXEYE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.galaxeye\.space\/jobs\/Careers/i,
  )
  assert.match(GALAXEYE_CATALOG.verifiedSurfaceSummary, /Jobs \| GalaxEye/i)
  assert.match(GALAXEYE_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(GALAXEYE_CATALOG.modulePath, galaxEyeModulePath)

  assert.equal(galaxEye.PROVIDER_METADATA.source, GALAXEYE_CATALOG.source)
  assert.equal(galaxEye.PROVIDER_METADATA.companyCareerPage, GALAXEYE_CATALOG.companyCareerPage)
  assert.equal(
    galaxEye.PROVIDER_METADATA.officialCareersHandoffUrl,
    GALAXEYE_CATALOG.officialCareersHandoffUrl,
  )
})
