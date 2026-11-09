import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/mobiculetechnologies/provider.js')
  } catch {
    assert.fail('Expected Mobicule Technologies provider module at ../../scraper/mobiculetechnologies/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mobiculetechnologies/script.js')
  } catch {
    assert.fail('Expected Mobicule Technologies scraper module at ../../scraper/mobiculetechnologies/script.js')
  }
}

test('Mobicule Technologies exports provider metadata for the current greytHR handoff', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'mobiculetechnologies',
    companyName: 'Mobicule Technologies',
    officialBrandName: 'Mobicule',
    adapter: 'script',
    modulePath: '../../scraper/mobiculetechnologies/script.js',
    homepageUrl: 'https://mobicule.com/',
    companyCareerPage: 'https://mobicule.com/careers/',
    careersPortalUrl: 'https://mobiculetechnologies.greythr.com/hire/jobs/',
    careersApiUrl: 'https://mobiculetechnologies.greythr.com/hire/api/career/published_jobs/',
    atsPlatform: 'greythr',
    countryFilter: 'India',
    paginationStrategy: 'first-party-greythr-handoff-plus-published-jobs-feed',
    extractionStrategy: 'verified-first-party-handoff+greythr-company-identity+published-feed+filters+job-details',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'mobicule.com',
    verifiedOn: '2026-10-03',
    verifiedSurfaceSummary:
      'Verified on October 3, 2026 that https://mobicule.com/careers/ now hands applicants to https://mobiculetechnologies.greythr.com/hire/jobs/. The branded greytHR company endpoint and published jobs feed listed three roles, with location IDs mapped to Mumbai and Pune by the same public portal filters. All three job detail endpoints were published and matched the feed.',
    dryRunFile: 'mobiculetechnologies/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.CAREERS_API_URL, providerModule.provider.careersApiUrl)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
