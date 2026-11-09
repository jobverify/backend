import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/graygraphtechnologiesprivatelimited/provider.js')
  } catch {
    assert.fail('Expected Graygraph Technologies Private Limited provider module at ../../scraper/graygraphtechnologiesprivatelimited/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/graygraphtechnologiesprivatelimited/script.js')
  } catch {
    assert.fail('Expected Graygraph Technologies Private Limited scraper module at ../../scraper/graygraphtechnologiesprivatelimited/script.js')
  }
}

const CAREERS_HTML = `
  <html>
    <head><title>Job Openings Archive - Graygraph.com</title></head>
    <body>
      <h1 class="page-title awsm-jobs-archive-title">Job Openings</h1>
      <div class="awsm-job-listing-item awsm-list-item">
        <h2 class="awsm-job-post-title"><a href="https://www.graygraph.com/jobs/hiring-for-seo-team-lead/">Hiring for SEO Team Lead</a></h2>
        <span class="awsm-job-specification-term">SEO</span>
        <span class="awsm-job-specification-term">Full Time</span>
        <span class="awsm-job-specification-term">Noida</span>
        <a class="awsm-job-more" href="https://www.graygraph.com/jobs/hiring-for-seo-team-lead/">More Details</a>
      </div>
      <div class="awsm-job-listing-item awsm-list-item">
        <h2 class="awsm-job-post-title"><a href="https://www.graygraph.com/jobs/hiring-for-it-project-manager/">Hiring For IT Project Manager</a></h2>
        <span class="awsm-job-specification-term">IT</span>
        <span class="awsm-job-specification-term">Full Time</span>
        <span class="awsm-job-specification-term">Noida</span>
        <a class="awsm-job-more" href="https://www.graygraph.com/jobs/hiring-for-it-project-manager/">More Details</a>
      </div>
    </body>
  </html>
`

test('Graygraph Technologies Private Limited exports local provider metadata for the verified first-party jobs archive', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'graygraphtechnologiesprivatelimited',
    companyName: 'Graygraph Technologies Private Limited',
    officialBrandName: 'Graygraph Technologies',
    adapter: 'script',
    modulePath: '../../scraper/graygraphtechnologiesprivatelimited/script.js',
    homepageUrl: 'https://www.graygraph.com/',
    companyCareerPage: 'https://www.graygraph.com/jobs/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'awsm-job-archive-single-page',
    extractionStrategy: 'verified-first-party-jobs-archive+awsm-job-listing-cards+same-domain-detail-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'graygraph.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.graygraph.com/jobs/ was the live first-party Graygraph Technologies jobs archive and that it exposed public listing cards including Hiring for SEO Team Lead and Hiring For IT Project Manager with same-domain More Details links and Noida location text.',
    dryRunFile: 'graygraphtechnologiesprivatelimited/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
})

test('Graygraph Technologies Private Limited extracts normalized jobs from the verified jobs archive', async () => {
  const graygraph = await loadScriptModule()

  assert.equal(graygraph.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(
    graygraph.extractJobCards(CAREERS_HTML),
    [
      {
        title: 'Hiring for SEO Team Lead',
        location: 'Noida',
        sourceUrl: 'https://www.graygraph.com/jobs/hiring-for-seo-team-lead/',
        applyUrl: 'https://www.graygraph.com/jobs/hiring-for-seo-team-lead/',
      },
      {
        title: 'Hiring For IT Project Manager',
        location: 'Noida',
        sourceUrl: 'https://www.graygraph.com/jobs/hiring-for-it-project-manager/',
        applyUrl: 'https://www.graygraph.com/jobs/hiring-for-it-project-manager/',
      },
    ],
  )

  const jobs = await graygraph.run({
    fetchText: async (url) => {
      assert.equal(url, graygraph.CAREERS_URL)
      return CAREERS_HTML
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.link, job.source]),
    [
      ['Hiring for SEO Team Lead', 'Noida', 'https://www.graygraph.com/jobs/hiring-for-seo-team-lead/', 'graygraphtechnologiesprivatelimited'],
      ['Hiring For IT Project Manager', 'Noida', 'https://www.graygraph.com/jobs/hiring-for-it-project-manager/', 'graygraphtechnologiesprivatelimited'],
    ],
  )
})
