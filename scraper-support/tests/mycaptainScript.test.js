import assert from 'node:assert/strict'
import test from 'node:test'

const loadMyCaptainModule = async () => {
  try {
    return await import('../../scraper/mycaptain/script.js')
  } catch {
    assert.fail('Expected MyCaptain scraper module at ../../scraper/mycaptain/script.js')
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>MyCaptain - E-Learning Platform with Job Ready &amp; Certification Programs</title>
    <meta
      name="description"
      content="Learn from real-world mentors and launch your career with MyCaptain's live programs."
    />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us">About Us</a>
      <a href="https://app.mycaptain.in/">Login</a>
    </nav>
    <main>
      <h1>Transform your Career with</h1>
      <ul>
        <li>Live Programs</li>
        <li>Stellar Captains</li>
        <li>Job Assistance</li>
        <li>MyCaptain</li>
      </ul>
      <p><strong>3,80,000+</strong> learners already have! When will you?</p>
      <p>800+ Hiring Partners</p>
      <footer>Copyright © 2026 Imarticus Learning Pvt Ltd</footer>
    </main>
  </body>
</html>
`

const verifiedCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <script type="text/javascript" id="zt-script-loader" async src="https://scripts.zipteams.com/v2.0/index.js"></script>
  </head>
  <body>
    <div id="__next">
      <main>
        <section class="careerBannerSection_careerBannerContainer__R4bvo">
          <h2 class="careerBannerSection_careerBannerHeading__Z4vtE mycapProHeading">Join us in creating an Impact</h2>
          <p class="careerBannerSection_careerBannerHeadingSub__lXFPE mb-0">
            We're on a mission to help people do what they truly love &amp; we’d love for you to join us
          </p>
          <button id="career_openings">See Current Openings</button>
        </section>
        <section class="jobOpenings_jobOpeningsContainer__IpKH_">
          <div class="jobOpenings_headerContainer__8U9Qd">
            <h2 class="jobOpenings_jobOpeningsHeading__RGaaW mycapProHeading">Current Job Openings</h2>
            <p class="jobOpenings_jobOpeningsHeadingSub__DPrYn mb-0">
              If you’re looking for an opportunity to showcase your talent &amp; grow, then see what you’d be a fit for
            </p>
          </div>
          <div class="jobOpenings_searchBox__NlSmU">
            <input placeholder="Search by job role" class="form-control" />
            <button id="search_job">Search</button>
          </div>
          <div class="jobOpenings_capsules_wrapper__EhFvT">
            <div class="jobOpenings_capscules__IGURz card"><div class="card-body">All departments (12)</div></div>
            <div class="jobOpenings_capscules__IGURz card"><div class="card-body">Product (7)</div></div>
            <div class="jobOpenings_capscules__IGURz card"><div class="card-body">Finance (20)</div></div>
            <div class="jobOpenings_capscules__IGURz card"><div class="card-body">Technology (10)</div></div>
          </div>
          <div class="row">
            <div class="col-md-6 col-sm-4">
              <div class="jobOpenings_jobCards__jbc_0 card">
                <div class="card-body">
                  <div class="jobOpenings_jobTitle__PS9_f card-title h5">Program Manager Executive</div>
                  <p class="nextImageBlock card-text"><img alt="location" /> <!-- -->Bangalore</p>
                </div>
              </div>
            </div>
            <div class="col-md-6 col-sm-4">
              <div class="jobOpenings_jobCards__jbc_0 card">
                <div class="card-body">
                  <div class="jobOpenings_jobTitle__PS9_f card-title h5">Finance Controller</div>
                  <p class="nextImageBlock card-text"><img alt="location" /> <!-- -->Bangalore</p>
                </div>
              </div>
            </div>
            <div class="col-md-6 col-sm-4">
              <div class="jobOpenings_jobCards__jbc_0 card">
                <div class="card-body">
                  <div class="jobOpenings_jobTitle__PS9_f card-title h5">Finance Controller</div>
                  <p class="nextImageBlock card-text"><img alt="location" /> <!-- -->Bangalore</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer>
          <a href="https://www.linkedin.com/company/mycaptain-in/">LinkedIn</a>
          <p>Copyright © 2026 Imarticus Learning Pvt Ltd</p>
        </footer>
      </main>
    </div>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{}},"page":"/career","query":{},"buildId":"sDA1vobK2MokZf81M8sZc","nextExport":true,"autoExport":true}
    </script>
  </body>
</html>
`

const deploymentPausedPage = (url) => ({
  status: 402,
  url,
  headers: {
    server: 'Vercel',
  },
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Deployment Paused</title>
      </head>
      <body>
        <h1>Deployment Paused</h1>
        <p>This deployment is temporarily paused</p>
      </body>
    </html>
  `,
})

test('MyCaptain validates the legacy first-party careers shell and the current verified deployment-paused sentinel', async () => {
  const mycaptain = await loadMyCaptainModule()

  assert.equal(mycaptain.SOURCE, 'mycaptain')
  assert.equal(mycaptain.COMPANY, 'MyCaptain')
  assert.equal(mycaptain.HOMEPAGE_URL, 'https://mycaptain.in/')
  assert.equal(mycaptain.CAREER_URL, 'https://mycaptain.in/career')
  assert.equal(mycaptain.CAREERS_URL, 'https://mycaptain.in/careers')
  assert.equal(mycaptain.JOB_URL, 'https://mycaptain.in/job')
  assert.equal(mycaptain.JOBS_URL, 'https://mycaptain.in/jobs')
  assert.equal(mycaptain.VERIFIED_ON, '2026-08-15')
  assert.equal(mycaptain.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mycaptain.hasOfficialCareerPageSignal(verifiedCareerHtml), true)
  assert.equal(mycaptain.hasVerifiedDeploymentPausedSignal(deploymentPausedPage(mycaptain.HOMEPAGE_URL)), true)

  assert.deepEqual(mycaptain.extractInlineJobCards(verifiedCareerHtml), [
    {
      title: 'Program Manager Executive',
      company: 'MyCaptain',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'mycaptain-program-manager-executive-bangalore',
      requisitionId: 'mycaptain-program-manager-executive-bangalore',
      sourceUrl: 'https://mycaptain.in/career',
      applyUrl: null,
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Finance Controller',
      company: 'MyCaptain',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'mycaptain-finance-controller-bangalore',
      requisitionId: 'mycaptain-finance-controller-bangalore',
      sourceUrl: 'https://mycaptain.in/career',
      applyUrl: null,
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Finance Controller',
      company: 'MyCaptain',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'mycaptain-finance-controller-bangalore-2',
      requisitionId: 'mycaptain-finance-controller-bangalore-2',
      sourceUrl: 'https://mycaptain.in/career',
      applyUrl: null,
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
})

test('MyCaptain run fetches the verified homepage and /career page and returns the inline public job cards', async () => {
  const mycaptain = await loadMyCaptainModule()
  const requestedUrls = []

  const jobs = await mycaptain.createMyCaptainScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === mycaptain.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
      if (url === mycaptain.CAREER_URL) return { status: 200, url, headers: {}, html: verifiedCareerHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [mycaptain.HOMEPAGE_URL, mycaptain.CAREER_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'mycaptain')
  assert.equal(jobs[0].company, 'MyCaptain')
  assert.equal(jobs[0].companyCareerPage, 'https://mycaptain.in/career')
  assert.equal(jobs[0].companyDomain, 'mycaptain.in')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].sourceUrl, 'https://mycaptain.in/career')
  assert.equal(jobs[0].applyUrl, null)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[2].jobId, 'mycaptain-finance-controller-bangalore-2')
})

test('MyCaptain reports unavailable inventory when public routes all show the deployment-paused shell', async () => {
  const mycaptain = await loadMyCaptainModule()
  const requestedUrls = []

  await assert.rejects(mycaptain.createMyCaptainScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return deploymentPausedPage(url)
    },
  }), error => error.failureKind === 'upstream_inventory_unavailable' && error.status === 402)

  assert.deepEqual(requestedUrls, [
    mycaptain.HOMEPAGE_URL,
    mycaptain.CAREER_URL,
    mycaptain.CAREERS_URL,
    mycaptain.JOB_URL,
    mycaptain.JOBS_URL,
  ])
})

test('MyCaptain retains an unavailable check when public routes are temporarily timeout-blocked', async () => {
  const mycaptain = await loadMyCaptainModule()

  await assert.rejects(mycaptain.createMyCaptainScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted address: mycaptain.in:443, timeout: 10000ms)',
      )
    },
  }), /Connect Timeout Error/)
})

test('MyCaptain fails closed when the verified reachable-or-blocked contract drifts materially', async () => {
  const mycaptain = await loadMyCaptainModule()

  await assert.rejects(
    mycaptain.createMyCaptainScraper().run({
      fetchPage: async (url) => {
        if (url === mycaptain.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }
        if (url === mycaptain.CAREER_URL) {
          return { status: 200, url, headers: {}, html: verifiedCareerHtml }
        }
        if ([mycaptain.CAREERS_URL, mycaptain.JOB_URL, mycaptain.JOBS_URL].includes(url)) {
          return deploymentPausedPage(url)
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mycaptain.createMyCaptainScraper().run({
      fetchPage: async (url) => {
        if (url === mycaptain.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: verifiedHomepageHtml }
        }
        if (url === mycaptain.CAREER_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: verifiedCareerHtml.replace('Current Job Openings', 'Join our team'),
          }
        }
        if ([mycaptain.CAREERS_URL, mycaptain.JOB_URL, mycaptain.JOBS_URL].includes(url)) {
          return deploymentPausedPage(url)
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no longer matches the verified accessible jobs surface/i,
  )

  await assert.rejects(
    mycaptain.createMyCaptainScraper().run({
      fetchPage: async (url) => {
        if (url === mycaptain.HOMEPAGE_URL) {
          return deploymentPausedPage(url)
        }
        if (url === mycaptain.CAREER_URL) {
          return {
            status: 503,
            url,
            headers: {
              server: 'Vercel',
            },
            html: '<html><head><title>Unexpected</title></head><body><h1>Temporarily unavailable</h1></body></html>',
          }
        }
        if ([mycaptain.CAREERS_URL, mycaptain.JOB_URL, mycaptain.JOBS_URL].includes(url)) {
          return deploymentPausedPage(url)
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /reachable jobs shell or the verified deployment-paused sentinel/i,
  )
})
