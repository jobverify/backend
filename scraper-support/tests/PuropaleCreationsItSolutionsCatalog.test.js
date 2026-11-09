import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/puropalecreationsitsolutions/provider.js')
  } catch {
    assert.fail('Expected Puropale Creations & IT Solutions provider module at ../../scraper/puropalecreationsitsolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/puropalecreationsitsolutions/script.js')
  } catch {
    assert.fail('Expected Puropale Creations & IT Solutions scraper module at ../../scraper/puropalecreationsitsolutions/script.js')
  }
}

test('Puropale Creations & IT Solutions exports a fail-closed provider contract for the unreachable official domain', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'puropalecreationsitsolutions',
    companyName: 'Puropale Creations & IT Solutions',
    officialBrandName: 'Puropale',
    adapter: 'script',
    modulePath: '../../scraper/puropalecreationsitsolutions/script.js',
    homepageUrl: 'https://puropale.com/',
    companyCareerPage: 'https://puropale.com/',
    atsPlatform: 'official-company-site-unreachable',
    countryFilter: 'India',
    paginationStrategy: 'fail-closed-sentinel',
    extractionStrategy: 'verified-official-domain-unreachable+no-public-jobs-surface+fail-closed-sentinel',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'puropale.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that the official Puropale domain published on the company LinkedIn page was https://puropale.com/, but live checks to https://puropale.com/, https://puropale.com/careers, https://puropale.com/jobs, and https://puropale.com/contact all failed with DNS-resolution errors and exposed no reachable first-party public jobs surface. This provider therefore remains fail-closed until the official domain resolves and publishes trustworthy openings.',
    dryRunFile: 'puropalecreationsitsolutions/jobs.json',
  })

  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
