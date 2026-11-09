import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/srmtechnologiespvtltd/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/srmtechnologiespvtltd/catalog.js')
  } catch {
    assert.fail('Expected SRM Technologies Pvt.Ltd catalog module at ../../scraper/srmtechnologiespvtltd/catalog.js')
  }
}

test('SRM Technologies Pvt.Ltd catalog captures the verified first-party handoff to the public Zoho board', async () => {
  const { SRM_TECHNOLOGIES_PVT_LTD_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SRM_TECHNOLOGIES_PVT_LTD_CATALOG)

  assert.equal(defaultCatalog, SRM_TECHNOLOGIES_PVT_LTD_CATALOG)
  assert.equal(provider.source, 'srmtechnologiespvtltd')
  assert.equal(provider.companyName, 'SRM Technologies Pvt.Ltd')
  assert.equal(provider.officialBrandName, 'SRM Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.srmtech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.srmtech.com/')
  assert.equal(provider.careersPortalUrl, 'https://careers.srmtech.com/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://careers.srmtech.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.candidatePortalUrl, 'https://careers.srmtech.com/candidateportal')
  assert.equal(provider.companyDomain, 'srmtech.com')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-handoff-plus-single-zoho-public-api-request')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-open-positions-handoff+verified-zoho-board+public-job-openings-api+india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.equal(provider.verifiedPublicPostingCount, 20)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /srmtechnologiespvtltd[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Job_Openings/i)
})
