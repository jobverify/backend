import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/stridelysolutions/provider.js')
  } catch {
    assert.fail('Expected Stridely Solutions provider module at ../../scraper/stridelysolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stridelysolutions/script.js')
  } catch {
    assert.fail('Expected Stridely Solutions scraper module at ../../scraper/stridelysolutions/script.js')
  }
}

const CAREERS_HTML = `
  <html>
    <head><title>Job Openings Archive - Stridely Solutions</title></head>
    <body>
      <h1 class="page-title awsm-jobs-archive-title">Job Openings</h1>
      <div class="awsm-job-listing-item awsm-list-item">
        <h2 class="awsm-job-post-title"><a href="https://www.stridelysolutions.com/insights/blog/jobs/rebar/">Rebar</a></h2>
        <span class="awsm-job-specification-term">Ahmedabad Pune</span>
        <span class="awsm-job-specification-term">Full Time</span>
        <span class="awsm-job-specification-term">Ahmedabad</span>
        <a class="awsm-job-more" href="https://www.stridelysolutions.com/insights/blog/jobs/rebar/">More Details</a>
      </div>
      <div class="awsm-job-listing-item awsm-list-item">
        <h2 class="awsm-job-post-title"><a href="https://www.stridelysolutions.com/insights/blog/jobs/sap-sd/">SAP SD</a></h2>
        <span class="awsm-job-specification-term">Full Time</span>
        <span class="awsm-job-specification-term">Ahmedabad Pune Vadodara</span>
        <a class="awsm-job-more" href="https://www.stridelysolutions.com/insights/blog/jobs/sap-sd/">More Details</a>
      </div>
    </body>
  </html>
`

test('Stridely Solutions exports local provider metadata for the verified first-party jobs archive', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'stridelysolutions',
    companyName: 'Stridely Solutions',
    officialBrandName: 'Stridely Solutions',
    adapter: 'script',
    modulePath: '../../scraper/stridelysolutions/script.js',
    homepageUrl: 'https://www.stridelysolutions.com/',
    companyCareerPage: 'https://www.stridelysolutions.com/insights/blog/jobs/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'awsm-job-archive-load-more-shell',
    extractionStrategy: 'verified-first-party-jobs-archive+awsm-job-listing-cards+same-domain-detail-links',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'stridelysolutions.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://www.stridelysolutions.com/insights/blog/jobs/ was the live first-party Stridely Solutions jobs archive and that it exposed public listing cards such as Rebar and SAP SD with same-domain More Details links.',
    dryRunFile: 'stridelysolutions/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
})

test('Stridely Solutions extracts normalized jobs from the verified jobs archive', async () => {
  const stridely = await loadScriptModule()

  assert.equal(stridely.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(
    stridely.extractJobCards(CAREERS_HTML),
    [
      {
        title: 'Rebar',
        location: 'Ahmedabad',
        sourceUrl: 'https://www.stridelysolutions.com/insights/blog/jobs/rebar/',
        applyUrl: 'https://www.stridelysolutions.com/insights/blog/jobs/rebar/',
      },
      {
        title: 'SAP SD',
        location: 'Ahmedabad Pune Vadodara',
        sourceUrl: 'https://www.stridelysolutions.com/insights/blog/jobs/sap-sd/',
        applyUrl: 'https://www.stridelysolutions.com/insights/blog/jobs/sap-sd/',
      },
    ],
  )

  const jobs = await stridely.run({
    fetchText: async (url) => {
      assert.equal(url, stridely.CAREERS_URL)
      return CAREERS_HTML
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.link, job.source]),
    [
      ['Rebar', 'Ahmedabad', 'https://www.stridelysolutions.com/insights/blog/jobs/rebar/', 'stridelysolutions'],
      ['SAP SD', 'Ahmedabad Pune Vadodara', 'https://www.stridelysolutions.com/insights/blog/jobs/sap-sd/', 'stridelysolutions'],
    ],
  )
})

test('Stridely Solutions run uses a bounded default fetch when no fetch override is supplied', async () => {
  const stridely = await loadScriptModule()
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options })
    return { ok: true, text: async () => CAREERS_HTML }
  }

  try {
    const jobs = await stridely.run({
      now: () => '2026-07-18T00:00:00.000Z',
    })

    assert.deepEqual(requests.map((request) => request.url), [stridely.CAREERS_URL])
    assert.ok(
      requests.every((request) => request.options.signal && typeof request.options.signal.aborted === 'boolean'),
      'Expected Stridely default fetch to include an AbortSignal timeout',
    )
    assert.deepEqual(
      jobs.map((job) => [job.title, job.source]),
      [
        ['Rebar', 'stridelysolutions'],
        ['SAP SD', 'stridelysolutions'],
      ],
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
