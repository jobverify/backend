import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/omninossolutions/provider.js')
  } catch {
    assert.fail('Expected Omninos Solutions provider module at ../../scraper/omninossolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/omninossolutions/script.js')
  } catch {
    assert.fail('Expected Omninos Solutions scraper module at ../../scraper/omninossolutions/script.js')
  }
}

test('Omninos Solutions exports provider metadata for the verified current openings page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'omninossolutions',
    companyName: 'Omninos Solutions',
    officialBrandName: 'Omninos',
    adapter: 'script',
    modulePath: '../../scraper/omninossolutions/script.js',
    homepageUrl: 'https://www.omninos.in/',
    companyCareerPage: 'https://omninos.in/current-opening.php',
    atsPlatform: 'official-first-party-role-cards',
    countryFilter: 'India',
    paginationStrategy: 'single-page-role-card-list',
    extractionStrategy: 'verified-first-party-current-openings-page+same-page-role-cards',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'omninos.in',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://omninos.in/current-opening.php was the live first-party Omninos current openings page and that it exposed public same-page role cards in Mohali, India including UI/UX Designer, Product Manager, Marketing Manager, Intern Android Developer, and Experienced Flutter Developer. Verified separately that the older first-party route https://www.omninos.in/career.php still showed stale 1st Jan, 2018 copy, so the scraper is pinned to the newer current-openings surface only.',
    dryRunFile: 'omninossolutions/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
