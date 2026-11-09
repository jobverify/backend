import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/relinns/provider.js')
  } catch {
    assert.fail('Expected Relinns Technologies provider module at ../../scraper/relinns/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/relinns/script.js')
  } catch {
    assert.fail('Expected Relinns Technologies scraper module at ../../scraper/relinns/script.js')
  }
}

const careersHtml = `
  <html>
    <head><title>Explore Exciting Career Opportunities | Relinns Careers</title></head>
    <body>
      <input type="text" placeholder="Search your job here…" />
      <button>Engagement Type</button>
      <button class="job-title shadow-none bg-white border-0 rounded-4">Quality Assurance-Manual </button>
      <p class="mb-0 job-experience"><span>Full-time</span><span>|</span><span>2-5 Years Experience</span></p>
      <div class="apply-button">
        <a target="_blank" class="nav-link" href="/apply/engineering/full-time/Quality-Assurance-Manual">Apply</a>
      </div>
      <button class="job-title shadow-none bg-white border-0 rounded-4">Sales Development Representative </button>
      <p class="mb-0 job-experience"><span>Full-time</span><span>|</span><span>1-2 Years Experience</span></p>
      <div class="apply-button">
        <a target="_blank" class="nav-link" href="/apply/marketing/full-time/Sales-Development-Representative">Apply</a>
      </div>
    </body>
  </html>
`

test('Relinns Technologies exports local provider metadata for the verified first-party careers board', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'relinns',
    companyName: 'Relinns Technologies',
    officialBrandName: 'Relinns',
    adapter: 'script',
    modulePath: '../../scraper/relinns/script.js',
    homepageUrl: 'https://careers.relinns.com/',
    companyCareerPage: 'https://careers.relinns.com/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-careers-board-filterable-opening-cards',
    extractionStrategy: 'verified-first-party-careers-board+public-opening-cards+same-domain-apply-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'careers.relinns.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://careers.relinns.com/ is the live first-party Relinns careers board and that it exposes public opening cards with same-domain apply links, including Quality Assurance-Manual and Sales Development Representative.',
    dryRunFile: 'relinns/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Relinns Technologies parses public opening cards from the first-party careers board', async () => {
  const relinns = await loadScriptModule()

  assert.equal(relinns.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await relinns.run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Quality Assurance-Manual', 'Sales Development Representative'],
  )
  assert.equal(jobs[0].department, 'Engineering')
  assert.equal(jobs[1].department, 'Marketing')
  assert.equal(jobs[0].applyUrl, 'https://careers.relinns.com/apply/engineering/full-time/Quality-Assurance-Manual')
})
