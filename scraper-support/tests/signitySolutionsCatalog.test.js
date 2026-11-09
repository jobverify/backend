import assert from 'node:assert/strict'
import test from 'node:test'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/signitysolutions/provider.js')
  } catch {
    assert.fail('Expected Signity Solutions provider module at ../../scraper/signitysolutions/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/signitysolutions/script.js')
  } catch {
    assert.fail('Expected Signity Solutions scraper module at ../../scraper/signitysolutions/script.js')
  }
}

const CAREERS_HTML = `
  <html>
    <head><title>Job Openings &amp; Career Opportunities at Signity Solutions</title></head>
    <body>
      <h2 class="heading mt-0 mb-2">Current Openings</h2>
      <div class="list-area" id="Job1">
        <div class="row align-items-center">
          <div class="col-xl-5 col-lg-4 col-md-5 col-9 order-div1">
            <a class="job-title jobOpner" href="#Job1">
              <h3>Assistant Digital Marketing Manager</h3>
            </a>
          </div>
          <div class="col-xl-5 col-lg-5 col-md-5 col-12 order-div2">
            <div class="mid-section">
              <div class="mid1">
                <div class="posted-date">
                  <span>Job posted on</span>
                  <strong>20th July, 2026</strong>
                </div>
              </div>
              <div class="mid1">
                <div class="location">
                  <span>Location</span>
                  <strong>Mohali</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-2 col-lg-3 col-md-2 col-3 order-div3">
            <div class="apply-job">
              <div class="action-button">
                <a href="#career-form" class="d-none d-md-flex btn-style2">Apply for this job</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="list-area" id="Job2">
        <h3>QA Lead</h3>
        <span>Job posted on</span><strong>20th July, 2026</strong>
        <span>Location</span><strong>Mohali</strong>
        <a class="btn" href="#career-form">Apply for this job</a>
      </div>
      <div class="list-area" id="Job3">
        <h3>Senior SEO Specialist</h3>
        <span>Job posted on</span><strong>20th July, 2026</strong>
        <span>Location</span><strong>Mohali</strong>
        <a class="btn" href="#career-form">Apply for this job</a>
      </div>
    </body>
  </html>
`

test('Signity Solutions exports local provider metadata for the verified first-party careers page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'signitysolutions',
    companyName: 'Signity Solutions',
    officialBrandName: 'Signity Solutions',
    adapter: 'script',
    modulePath: '../../scraper/signitysolutions/script.js',
    homepageUrl: 'https://www.signitysolutions.com/',
    companyCareerPage: 'https://www.signitysolutions.com/careers',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'single-page-current-openings-accordion',
    extractionStrategy: 'verified-careers-page+inline-opening-sections+career-form-anchor',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'signitysolutions.com',
    verifiedOn: '2026-07-27',
    verifiedSurfaceSummary:
      'Verified on Monday, July 27, 2026 that https://www.signitysolutions.com/careers was the live first-party Signity Solutions careers page and that it exposed inline public openings including Assistant Digital Marketing Manager, QA Lead, and Senior SEO Specialist with posting dates, Mohali location text, and the first-party #career-form apply anchor.',
    dryRunFile: 'signitysolutions/jobs.json',
  })

  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
})

test('Signity Solutions extracts normalized jobs from the verified careers page', async () => {
  const signity = await loadScriptModule()

  assert.equal(signity.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(
    signity.extractJobCards(CAREERS_HTML),
    [
      {
        title: 'Assistant Digital Marketing Manager',
        location: 'Mohali',
        sourceUrl: 'https://www.signitysolutions.com/careers',
        applyUrl: 'https://www.signitysolutions.com/careers#career-form',
      },
      {
        title: 'QA Lead',
        location: 'Mohali',
        sourceUrl: 'https://www.signitysolutions.com/careers',
        applyUrl: 'https://www.signitysolutions.com/careers#career-form',
      },
      {
        title: 'Senior SEO Specialist',
        location: 'Mohali',
        sourceUrl: 'https://www.signitysolutions.com/careers',
        applyUrl: 'https://www.signitysolutions.com/careers#career-form',
      },
    ],
  )

  const jobs = await signity.run({
    fetchText: async (url) => {
      assert.equal(url, signity.CAREERS_URL)
      return CAREERS_HTML
    },
    now: () => '2026-07-27T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.link, job.source]),
    [
      ['Assistant Digital Marketing Manager', 'Mohali', 'https://www.signitysolutions.com/careers#career-form', 'signitysolutions'],
      ['QA Lead', 'Mohali', 'https://www.signitysolutions.com/careers#career-form', 'signitysolutions'],
      ['Senior SEO Specialist', 'Mohali', 'https://www.signitysolutions.com/careers#career-form', 'signitysolutions'],
    ],
  )
})
