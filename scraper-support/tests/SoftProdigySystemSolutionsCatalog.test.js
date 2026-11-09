import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/softprodigysystemsolutions/provider.js')
  } catch {
    assert.fail('Expected SoftProdigy System Solutions provider module at ../../scraper/softprodigysystemsolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/softprodigysystemsolutions/script.js')
  } catch {
    assert.fail('Expected SoftProdigy System Solutions scraper module at ../../scraper/softprodigysystemsolutions/script.js')
  }
}

test('SoftProdigy System Solutions exports local provider metadata for the verified homepage-to-Keka jobs handoff', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'softprodigysystemsolutions',
    companyName: 'SoftProdigy System Solutions',
    officialBrandName: 'SoftProdigy',
    adapter: 'script',
    modulePath: '../../scraper/softprodigysystemsolutions/script.js',
    homepageUrl: 'https://softprodigy.com/',
    companyCareerPage: 'https://softprodigy.keka.com/careers/',
    atsPlatform: 'official-homepage-plus-keka-board',
    countryFilter: 'India',
    paginationStrategy: 'homepage-handoff-plus-keka-board-shell-plus-active-jobs-api',
    extractionStrategy: 'verified-homepage-keka-link+verified-keka-board-shell+keka-active-jobs-api',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'softprodigy.com',
    verifiedOn: '2026-07-27',
    verifiedSurfaceSummary:
      'Verified on Monday, July 27, 2026 that https://softprodigy.com/ linked candidates to the public board at https://softprodigy.keka.com/careers/, that the live Keka shell still rendered the SoftProdigy System Solutions Pvt. Ltd. hiring surface with a Browse all jobs prompt, and that the public active-jobs API at https://softprodigy.keka.com/careers/api/jobs/default/active exposed three openings including Software Developer, Internship cum Job Opportunity - Hiring Interns (2025 & 2026 Batch), and PPC Analyst.',
    dryRunFile: 'softprodigysystemsolutions/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.homepageUrl)
  assert.equal(scriptModule.KEKA_BOARD_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})
