import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Job Opportunities</h1>
    <h2>OPPORTUNITIES</h2>
    <h4>Mumbai, India</h4>
    <a href="/opportunities/business-development-manager-banking-products/">Business Development Manager (Banking Products)</a>
    <a href="/opportunities/sr-business-analyst-banking-products/">Sr. Business Analyst (Banking Products)</a>
    <a href="/opportunities/sr-support-specialist-banking-products/">Sr. Support Specialist (Banking Products)</a>
    <a href="/opportunities/software-solution-architect/">Software Solution Architect</a>
    <h4>Kolkata, India</h4>
    <a href="/opportunities/infrastructure-software-developers/">Infrastructure Software Developers</a>
    <a href="/opportunities/backend-software-developers/">Backend Software Developers</a>
    <a href="/opportunities/ui-ux-software-developers/">UI/UX Software Developers</a>
    <a href="/opportunities/database-manager/">Database Manager</a>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/hashcashconsultants/provider.js')
  } catch {
    assert.fail('Expected HashCash Consultants provider module at ../../scraper/hashcashconsultants/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hashcashconsultants/script.js')
  } catch {
    assert.fail('Expected HashCash Consultants scraper module at ../../scraper/hashcashconsultants/script.js')
  }
}

test('HashCash Consultants exports local provider metadata for the verified first-party opportunities page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'hashcashconsultants',
    companyName: 'HashCash Consultants',
    officialBrandName: 'HashCash Consultants',
    adapter: 'script',
    modulePath: '../../scraper/hashcashconsultants/script.js',
    homepageUrl: 'https://www.hashcashconsultants.com/careers/',
    companyCareerPage: 'https://www.hashcashconsultants.com/opportunities/',
    atsPlatform: 'official-first-party-opportunities-page',
    countryFilter: 'India',
    paginationStrategy: 'single-page-location-sections',
    extractionStrategy: 'verified-first-party-opportunities-page+india-location-groups+same-page-role-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'hashcashconsultants.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.hashcashconsultants.com/opportunities/ was the live first-party HashCash Consultants opportunities page, and that it publicly exposed India hiring sections for Mumbai and Kolkata with role links including Business Development Manager (Banking Products), Sr. Support Specialist (Banking Products), Infrastructure Software Developers, Backend Software Developers, UI/UX Software Developers, and Database Manager.',
    dryRunFile: 'hashcashconsultants/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('HashCash Consultants extracts verified India opportunities from the first-party location groups', async () => {
  const hashcash = await loadScriptModule()

  assert.equal(hashcash.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await hashcash.run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 8)
  assert.deepEqual(jobs[0], {
    title: 'Business Development Manager (Banking Products)',
    location: 'Mumbai, India',
    sourceUrl:
      'https://www.hashcashconsultants.com/opportunities/business-development-manager-banking-products/',
    applyUrl:
      'https://www.hashcashconsultants.com/opportunities/business-development-manager-banking-products/',
    company: 'HashCash Consultants',
    country: 'India',
    link:
      'https://www.hashcashconsultants.com/opportunities/business-development-manager-banking-products/',
    source: 'hashcashconsultants',
    scrapedAt: '2026-07-18T00:00:00.000Z',
  })
})
