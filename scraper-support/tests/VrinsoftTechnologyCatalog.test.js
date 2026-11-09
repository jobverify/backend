import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/vrinsofttechnology/provider.js')
  } catch {
    assert.fail('Expected Vrinsoft Technology provider module at ../../scraper/vrinsofttechnology/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/vrinsofttechnology/script.js')
  } catch {
    assert.fail('Expected Vrinsoft Technology scraper module at ../../scraper/vrinsofttechnology/script.js')
  }
}

test('Vrinsoft Technology exports local provider metadata for the verified first-party careers page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'vrinsofttechnology',
    companyName: 'Vrinsoft Technology',
    officialBrandName: 'Vrinsoft',
    adapter: 'script',
    modulePath: '../../scraper/vrinsofttechnology/script.js',
    homepageUrl: 'https://www.vrinsofts.com/',
    companyCareerPage: 'https://www.vrinsofts.com/career.html',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-page',
    extractionStrategy: 'verified-first-party-careers-page+same-page-job-cards+apply-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'vrinsofts.com',
    verifiedOn: '2026-07-17',
    verifiedSurfaceSummary:
      'Verified on Friday, July 17, 2026 that https://www.vrinsofts.com/career.html was the live first-party Vrinsoft careers page, and that the page exposed public developer and engineer hiring signals plus first-party Apply Now job links.',
    dryRunFile: 'vrinsofttechnology/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
