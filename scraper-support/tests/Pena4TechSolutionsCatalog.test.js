import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/pena4techsolutions/provider.js')
  } catch {
    assert.fail('Expected Pena4 Tech Solutions provider module at ../../scraper/pena4techsolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pena4techsolutions/script.js')
  } catch {
    assert.fail('Expected Pena4 Tech Solutions scraper module at ../../scraper/pena4techsolutions/script.js')
  }
}

test('Pena4 Tech Solutions exports local provider metadata for the verified first-party jobs page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'pena4techsolutions',
    companyName: 'Pena4 Tech Solutions',
    officialBrandName: 'Pena4',
    adapter: 'script',
    modulePath: '../../scraper/pena4techsolutions/script.js',
    homepageUrl: 'https://www.pena4.com/',
    companyCareerPage: 'https://www.pena4.com/jobs.php',
    atsPlatform: 'official-first-party-jobs-page',
    countryFilter: 'India',
    paginationStrategy: 'single-page-region-tabs',
    extractionStrategy: 'verified-first-party-jobs-page+india-region-filter+same-page-application-form',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'pena4.com',
    verifiedOn: '2026-08-04',
    verifiedSurfaceSummary:
      'Verified on Tuesday, August 4, 2026 that https://www.pena4.com/jobs.php was the live first-party Pena4 jobs page, that it publicly exposed the Inpatient Medical Coder listing while older Pena4 job cards remained only inside commented HTML, and that the page included a first-party application form plus outbound Indeed and LinkedIn job links.',
    dryRunFile: 'pena4techsolutions/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.JOBS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
