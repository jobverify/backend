import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/valuefirstdigitalmedia/provider.js')
  } catch {
    assert.fail('Expected ValueFirst Digital Media provider module at ../../scraper/valuefirstdigitalmedia/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/valuefirstdigitalmedia/script.js')
  } catch {
    assert.fail('Expected ValueFirst Digital Media scraper module at ../../scraper/valuefirstdigitalmedia/script.js')
  }
}

test('ValueFirst Digital Media exports provider metadata for the verified first-party careers page and role detail', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'valuefirstdigitalmedia',
    companyName: 'ValueFirst Digital Media',
    officialBrandName: 'ValueFirst',
    adapter: 'script',
    modulePath: '../../scraper/valuefirstdigitalmedia/script.js',
    homepageUrl: 'https://www.vfirst.com/',
    companyCareerPage: 'https://www.vfirst.com/resources/careers',
    atsPlatform: 'official-first-party-role-pages',
    countryFilter: 'India',
    paginationStrategy: 'single-page-role-list-plus-first-party-role-pages',
    extractionStrategy: 'verified-first-party-careers-page+same-page-role-list+first-party-role-detail-page',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'vfirst.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.vfirst.com/resources/careers was the live first-party ValueFirst careers page and that it publicly listed the India role Sales Manager - Acquisition in Gurugram with a first-party detail page at https://www.vfirst.com/job-opening/sales-manager-acquisition.',
    dryRunFile: 'valuefirstdigitalmedia/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
