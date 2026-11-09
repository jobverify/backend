import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/techjays/provider.js')
  } catch {
    assert.fail('Expected Techjays provider module at ../../scraper/techjays/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/techjays/script.js')
  } catch {
    assert.fail('Expected Techjays scraper module at ../../scraper/techjays/script.js')
  }
}

test('Techjays exports local provider metadata for the counted first-party roles and incomplete location scope', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'techjays',
    companyName: 'Techjays',
    officialBrandName: 'Techjays',
    adapter: 'script',
    modulePath: '../../scraper/techjays/script.js',
    homepageUrl: 'https://www.techjays.com/',
    companyCareerPage: 'https://www.techjays.com/careers',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'first-party-counted-roles-plus-details',
    extractionStrategy: 'first-party-role-cards-and-details+explicit-india-location+incomplete-scope-preserves-prior-jobs',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'techjays.com',
    verifiedOn: '2026-09-13',
    verifiedSurfaceSummary:
      'Verified on 2026-09-13 that the official Techjays careers page lists six public roles with matching first-party detail pages and hireflow.techjays.com applications. Two roles explicitly identify Coimbatore / Hybrid; four lack role-level location evidence and remain diagnostic-only. Published India jobs carry incomplete-listing metadata so prior vacancies are preserved.',
    dryRunFile: 'techjays/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
