import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/kochbusinesssolutions/provider.js')
  } catch {
    assert.fail('Expected Koch Business Solutions provider module at ../../scraper/kochbusinesssolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kochbusinesssolutions/script.js')
  } catch {
    assert.fail('Expected Koch Business Solutions scraper module at ../../scraper/kochbusinesssolutions/script.js')
  }
}

const SEARCH_HTML = `
  <html>
    <head><title>Job Search | Koch</title></head>
    <body>
      <a href="https://koch.avature.net/en_US/careers/SearchJobs?732=26082375&tags=rm.kcm.web.kcm-004">View open roles</a>
      <article class="article article--result">
        <h3 class="article__header__text__title">
          <a href="https://koch.avature.net/en_US/careers/JobDetail/Data-Analyst/190822">Data Analyst</a>
        </h3>
        <div class="article__content__field__label">Location:</div>
        <div class="article__content__field__value">Bangalore, Karnataka, India</div>
      </article>
      <article class="article article--result">
        <h3 class="article__header__text__title">
          <a href="https://koch.avature.net/en_US/careers/JobDetail/Business-Process-Analyst/190608">Business Process Analyst</a>
        </h3>
        <div class="article__content__field__label">Location:</div>
        <div class="article__content__field__value">Bengaluru, Karnataka, India</div>
      </article>
    </body>
  </html>
`

test('Koch Business Solutions exports local provider metadata for the verified Koch page and filtered Avature board', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'kochbusinesssolutions',
    companyName: 'Koch Business Solutions',
    officialBrandName: 'Koch Business Solutions',
    adapter: 'script',
    modulePath: '../../scraper/kochbusinesssolutions/script.js',
    homepageUrl: 'https://www.kochinc.com/',
    companyCareerPage: 'https://www.kochinc.com/career-opportunities/koch',
    searchJobsUrl: 'https://koch.avature.net/en_US/careers/SearchJobs?732=26082375&tags=rm.kcm.web.kcm-004',
    atsPlatform: 'avature',
    countryFilter: 'India',
    paginationStrategy: 'koch-company-page-plus-filtered-avature-pagination',
    extractionStrategy: 'verified-koch-company-page+company-filtered-avature-search-results+jobdetail-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'koch.avature.net',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.kochinc.com/career-opportunities/koch linked to a company-filtered Avature board at https://koch.avature.net/en_US/careers/SearchJobs?732=26082375&tags=rm.kcm.web.kcm-004, and that the filtered search results exposed public Koch roles with Bangalore or Bengaluru, Karnataka, India locations plus paginated JobDetail links.',
    dryRunFile: 'kochbusinesssolutions/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.SEARCH_JOBS_URL, providerModule.provider.searchJobsUrl)
})

test('Koch Business Solutions extracts normalized India jobs from the filtered Avature board', async () => {
  const koch = await loadScriptModule()

  assert.equal(koch.hasOfficialCareersSignal('<h1>Empowering Koch companies with shared expertise</h1><a href="https://koch.avature.net/en_US/careers/SearchJobs?732=26082375&tags=rm.kcm.web.kcm-004">View open roles</a>'), true)
  assert.deepEqual(
    koch.extractJobsFromSearchHtml(SEARCH_HTML),
    [
      {
        title: 'Data Analyst',
        location: 'Bangalore, Karnataka, India',
        sourceUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Data-Analyst/190822',
        applyUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Data-Analyst/190822',
      },
      {
        title: 'Business Process Analyst',
        location: 'Bengaluru, Karnataka, India',
        sourceUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Business-Process-Analyst/190608',
        applyUrl: 'https://koch.avature.net/en_US/careers/JobDetail/Business-Process-Analyst/190608',
      },
    ],
  )

  const jobs = await koch.run({
    fetchText: async (url) => {
      if (url === koch.CAREERS_URL) {
        return '<h1>Empowering Koch companies with shared expertise</h1><a href="https://koch.avature.net/en_US/careers/SearchJobs?732=26082375&tags=rm.kcm.web.kcm-004">View open roles</a>'
      }
      if (url === koch.SEARCH_JOBS_URL) return SEARCH_HTML
      throw new Error(`Unexpected Koch URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.link, job.source]),
    [
      ['Data Analyst', 'Bangalore, Karnataka, India', 'https://koch.avature.net/en_US/careers/JobDetail/Data-Analyst/190822', 'kochbusinesssolutions'],
      ['Business Process Analyst', 'Bengaluru, Karnataka, India', 'https://koch.avature.net/en_US/careers/JobDetail/Business-Process-Analyst/190608', 'kochbusinesssolutions'],
    ],
  )
})
