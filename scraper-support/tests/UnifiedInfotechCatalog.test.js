import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/unifiedinfotech/provider.js')
  } catch {
    assert.fail('Expected Unified Infotech provider module at ../../scraper/unifiedinfotech/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/unifiedinfotech/script.js')
  } catch {
    assert.fail('Expected Unified Infotech scraper module at ../../scraper/unifiedinfotech/script.js')
  }
}

test('Unified Infotech exports local provider metadata for the verified first-party careers page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'unifiedinfotech',
    companyName: 'Unified Infotech',
    officialBrandName: 'Unified Infotech',
    adapter: 'script',
    modulePath: '../../scraper/unifiedinfotech/script.js',
    homepageUrl: 'https://www.unifiedinfotech.net/',
    companyCareerPage: 'https://www.unifiedinfotech.net/careers/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-page-load-more-cards',
    extractionStrategy: 'verified-first-party-careers-page+public-opening-cards+same-page-apply-form',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'unifiedinfotech.net',
    verifiedOn: '2026-07-17',
    verifiedSurfaceSummary:
      'Verified on Friday, July 17, 2026 that https://www.unifiedinfotech.net/careers/ was the live first-party Unified Infotech careers page, that it exposed public opening cards behind a Load More interface, and that the page included a first-party Apply For A Position form.',
    dryRunFile: 'unifiedinfotech/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
