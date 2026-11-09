import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const enfusionModulePath = path.resolve(currentDir, '../../scraper/enfusion.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/enfusion.workday/catalog.js')
  } catch {
    assert.fail('Expected Enfusion catalog module at ../../scraper/enfusion.workday/catalog.js')
  }
}

const loadEnfusionModule = async () => {
  try {
    return await import('../../scraper/enfusion.workday/script.js')
  } catch {
    assert.fail('Expected Enfusion scraper module at ../../scraper/enfusion.workday/script.js')
  }
}

test('Enfusion local catalog captures the verified Clearwater careers and Workday contract', async () => {
  const { ENFUSION_CATALOG } = await loadCatalogModule()
  const enfusion = await loadEnfusionModule()

  assert.equal(ENFUSION_CATALOG.source, 'enfusion')
  assert.equal(ENFUSION_CATALOG.companyName, 'Enfusion')
  assert.equal(ENFUSION_CATALOG.officialBrandName, 'Enfusion by Clearwater')
  assert.equal(ENFUSION_CATALOG.adapter, 'script')
  assert.equal(ENFUSION_CATALOG.enfusionHomepageUrl, 'https://enfusion.com/')
  assert.equal(ENFUSION_CATALOG.officialHomepageUrl, 'https://cwan.com/')
  assert.equal(ENFUSION_CATALOG.companyCareerPage, 'https://cwan.com/company/careers/')
  assert.equal(
    ENFUSION_CATALOG.officialWorkdayBoardUrl,
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers',
  )
  assert.equal(
    ENFUSION_CATALOG.firstPartyJobsApiUrl,
    'https://cwan.com/wp-content/themes/wp-clearwater/blocks/workday/api.php',
  )
  assert.deepEqual(ENFUSION_CATALOG.verifiedIndiaLocationReferences, ['LOC-Bengaluru Office'])
  assert.equal(
    ENFUSION_CATALOG.verifiedIndiaJobUrl,
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911',
  )
  assert.equal(
    ENFUSION_CATALOG.verifiedIndiaApplyUrl,
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911/apply',
  )
  assert.equal(ENFUSION_CATALOG.atsPlatform, 'workday')
  assert.equal(ENFUSION_CATALOG.countryFilter, 'India')
  assert.equal(
    ENFUSION_CATALOG.paginationStrategy,
    'single-first-party-json-feed-with-enfusion-brand-filter',
  )
  assert.equal(
    ENFUSION_CATALOG.extractionStrategy,
    'verified-enfusion-homepage-redirect+verified-first-party-clearwater-careers-page+verified-clearwater-workday-board+verified-first-party-jobs-api+enfusion-brand-filter+india-location-filter',
  )
  assert.equal(ENFUSION_CATALOG.parser, 'custom-script')
  assert.equal(ENFUSION_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ENFUSION_CATALOG.verifiedOn, '2026-07-15')
  assert.match(ENFUSION_CATALOG.verifiedSurfaceSummary, /https:\/\/enfusion\.com\//i)
  assert.match(ENFUSION_CATALOG.verifiedSurfaceSummary, /https:\/\/cwan\.com\/company\/careers\//i)
  assert.match(
    ENFUSION_CATALOG.verifiedSurfaceSummary,
    /https:\/\/cwan\.com\/wp-content\/themes\/wp-clearwater\/blocks\/workday\/api\.php/i,
  )
  assert.match(
    ENFUSION_CATALOG.verifiedSurfaceSummary,
    /https:\/\/clearwateranalytics\.wd1\.myworkdayjobs\.com\/Clearwater_Analytics_Careers/i,
  )
  assert.match(ENFUSION_CATALOG.verifiedSurfaceSummary, /Bengaluru/i)
  assert.equal(ENFUSION_CATALOG.modulePath, enfusionModulePath)

  assert.equal(enfusion.PROVIDER_METADATA.source, ENFUSION_CATALOG.source)
  assert.equal(enfusion.PROVIDER_METADATA.companyName, ENFUSION_CATALOG.companyName)
  assert.equal(enfusion.PROVIDER_METADATA.companyCareerPage, ENFUSION_CATALOG.companyCareerPage)
  assert.equal(enfusion.PROVIDER_METADATA.firstPartyJobsApiUrl, ENFUSION_CATALOG.firstPartyJobsApiUrl)
})
