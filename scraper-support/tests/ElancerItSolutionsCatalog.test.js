import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/elanceritsolutions/provider.js')
  } catch {
    assert.fail('Expected Elancer It Solutions provider module at ../../scraper/elanceritsolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/elanceritsolutions/script.js')
  } catch {
    assert.fail('Expected Elancer It Solutions scraper module at ../../scraper/elanceritsolutions/script.js')
  }
}

test('Elancer It Solutions exports provider metadata for the verified first-party careers page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'elanceritsolutions',
    companyName: 'Elancer It Solutions',
    officialBrandName: 'Elancer IT Solutions',
    adapter: 'script',
    modulePath: '../../scraper/elanceritsolutions/script.js',
    homepageUrl: 'https://elancerits.com/',
    companyCareerPage: 'https://elancerits.com/careers.html',
    atsPlatform: 'official-first-party-openings-page',
    countryFilter: 'India',
    paginationStrategy: 'single-page-accordion-list',
    extractionStrategy: 'verified-first-party-careers-page+same-page-open-positions+email-apply',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'elancerits.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://elancerits.com/careers.html was the live first-party Elancer IT Solutions careers page and that it exposed public same-page openings including Project Coordinator / Senior Team Coordinator and Business Development Executive - AI & Data Services, with resumes directed to hr@elancerits.com.',
    dryRunFile: 'elanceritsolutions/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
