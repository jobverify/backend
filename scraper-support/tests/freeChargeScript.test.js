import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Freecharge</title>
  </head>
  <body>
    <main>
      <h1>Freecharge</h1>
      <a href="https://careers.freecharge.in">Career</a>
      <footer>© Freecharge Payment Technologies Pvt. Ltd. All Rights Reserved</footer>
    </main>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Freecharge</title>
  </head>
  <body>
    <main>
      <h1>#ChangeYourFuture</h1>
      <p>Grow Your Career While We Revolutionize Payments</p>
      <p>open roles</p>
      <a href="https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&amp;source=CAREERSITE#list">
        Explore Opportunities
      </a>
    </main>
  </body>
</html>
`

const jobBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Freecharge Careers | Latest jobs at Freecharge - Ripplehire.com</title>
  </head>
  <body>
    <div id="app">Latest jobs at Freecharge</div>
  </body>
</html>
`

const SEARCH_RESULTS_PAYLOAD = {
  startJobIndex: 0,
  maxJobSize: 10,
  totalJobCount: 24,
  jobVoList: [
    {
      jobSeq: '910501',
      jobTitle: 'Senior Backend Engineer',
      jobLocation: null,
      jobReqExp: '5 - 8 Years',
      jobPostingDate: null,
      locations: 'Gurugram',
      jobId: '910501',
      bussinessUnit: 'Engineering',
    },
    {
      jobSeq: '910441',
      jobTitle: 'Product Designer',
      jobLocation: '',
      jobReqExp: '4 - 6 Years',
      jobPostingDate: null,
      locations: 'Singapore',
      jobId: '910441',
      bussinessUnit: 'Design',
    },
    {
      jobSeq: '910399',
      jobTitle: 'SRE - Payments Platform',
      jobLocation: null,
      jobReqExp: '6 - 9 Years',
      jobPostingDate: null,
      locations: 'Bengaluru',
      jobId: '910399',
      bussinessUnit: 'Infrastructure',
    },
  ],
}

const JOB_DETAIL_PAYLOAD = {
  companyVO: {
    companyName: 'Freecharge',
  },
  jobVO: {
    jobSeq: '910501',
    jobId: '910501',
    jobTitle: 'Senior Backend Engineer',
    jobDesc: `
      <p><strong>About the role</strong></p>
      <p>Build and scale core payments services for millions of users.</p>
      <p><strong>Location: -</strong></p>
      <ul>
        <li>Gurugram</li>
      </ul>
      <p><strong>Educational Qualifications: -</strong></p>
      <ul>
        <li>Bachelor's degree in Computer Science or equivalent.</li>
        <li>Master's degree is a plus.</li>
      </ul>
      <p><strong>Mandatory Technical Skills: -</strong></p>
      <ul>
        <li>Node.js</li>
        <li>Distributed systems</li>
      </ul>
      <p><strong>Good to Have Skills: -</strong></p>
      <ul>
        <li>Payments domain experience</li>
      </ul>
    `,
    jobLocation: 'Gurugram',
    jobReqExp: '5 - 8 Years',
    jobType: 'R',
    jobPostingDate: '12-Jul-2026',
    locations: 'Gurugram',
    bussinessUnit: 'Engineering',
    jobTypeCustom3: 'Employee',
    publishDetails: {
      CAREER_SITE: '2026-07-12T10:30:00Z',
    },
  },
}

const loadFreeChargeModule = async () => {
  try {
    return await import('../../scraper/freecharge/script.js')
  } catch {
    assert.fail('Expected FreeCharge scraper module at ../../scraper/freecharge/script.js')
  }
}

test('FreeCharge scraper constants and verified-surface helpers stay pinned to the first-party RippleHire handoff', async () => {
  const freeCharge = await loadFreeChargeModule()

  assert.equal(freeCharge.SOURCE, 'freecharge')
  assert.equal(freeCharge.COMPANY, 'FreeCharge')
  assert.equal(freeCharge.OFFICIAL_BRAND_NAME, 'Freecharge')
  assert.equal(freeCharge.VERIFIED_ON, '2026-08-02')
  assert.equal(freeCharge.HOMEPAGE_URL, 'https://www.freecharge.in/')
  assert.equal(freeCharge.COMPANY_CAREER_PAGE_URL, 'https://careers.freecharge.in/')
  assert.equal(freeCharge.PORTAL_ORIGIN, 'https://freecharge.ripplehire.com')
  assert.equal(
    freeCharge.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  )
  assert.equal(
    freeCharge.JOB_BOARD_URL,
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  )
  assert.equal(
    freeCharge.JOB_SEARCH_API_URL,
    'https://freecharge.ripplehire.com/candidate/candidatejobsearch',
  )
  assert.deepEqual(freeCharge.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    token: 'IoV5vvUSMKLwmaa1Suou',
    source: 'CAREERSITE',
    pagesize: 10,
  })
  assert.equal(
    freeCharge.extractCareersHandoffUrl(careersPageHtml),
    freeCharge.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(freeCharge.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(freeCharge.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.equal(freeCharge.hasVerifiedJobBoardSignal(jobBoardHtml), true)
  assert.equal(freeCharge.isIndiaListing({ location: 'Gurugram' }), true)
  assert.equal(freeCharge.isIndiaListing({ location: 'Singapore' }), false)
})

test('FreeCharge run verifies the known first-party handoff before decorating RippleHire jobs for the local source', async () => {
  const freeCharge = await loadFreeChargeModule()
  const pageRequests = []
  const apiRequests = []

  const jobs = await freeCharge.createFreeChargeScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    maxPages: 1,
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === freeCharge.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === freeCharge.COMPANY_CAREER_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === freeCharge.JOB_BOARD_URL) {
        return { status: 200, url, html: jobBoardHtml }
      }

      throw new Error(`Unexpected FreeCharge page URL: ${url}`)
    },
    fetchPayload: async (url, options = {}) => {
      apiRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === freeCharge.JOB_SEARCH_API_URL) {
        return SEARCH_RESULTS_PAYLOAD
      }

      if (url.includes('jobSeq=910501')) {
        return JOB_DETAIL_PAYLOAD
      }

      if (url.includes('jobSeq=910399')) {
        return {
          ...JOB_DETAIL_PAYLOAD,
          jobVO: {
            ...JOB_DETAIL_PAYLOAD.jobVO,
            jobSeq: '910399',
            jobId: '910399',
            jobTitle: 'SRE - Payments Platform',
            jobLocation: 'Bengaluru',
            locations: 'Bengaluru',
            jobReqExp: '6 - 9 Years',
            bussinessUnit: 'Infrastructure',
            jobPostingDate: '10-Jul-2026',
            publishDetails: {
              CAREER_SITE: '2026-07-10T08:00:00Z',
            },
          },
        }
      }

      throw new Error(`Unexpected FreeCharge API URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    freeCharge.HOMEPAGE_URL,
    freeCharge.COMPANY_CAREER_PAGE_URL,
    freeCharge.JOB_BOARD_URL,
  ])
  assert.deepEqual(apiRequests.map((request) => request.method), ['POST', 'GET', 'GET'])
  assert.equal(apiRequests[0].url, freeCharge.JOB_SEARCH_API_URL)
  assert.match(apiRequests[0].body, /IoV5vvUSMKLwmaa1Suou/)
  assert.match(apiRequests[0].body, /CAREERSITE/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'FreeCharge')
  assert.equal(jobs[0].source, 'freecharge')
  assert.equal(jobs[0].location, 'Gurugram, India')
  assert.equal(
    jobs[0].link,
    'https://freecharge.ripplehire.com/candidate/?source=CAREERSITE&token=IoV5vvUSMKLwmaa1Suou#apply/job/910501',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'SRE - Payments Platform')
  assert.equal(jobs[1].company, 'FreeCharge')
  assert.equal(jobs[1].source, 'freecharge')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('FreeCharge scraper fails closed when the verified homepage, careers page, or public RippleHire board drifts', async () => {
  const freeCharge = await loadFreeChargeModule()

  await assert.rejects(
    freeCharge.createFreeChargeScraper().run({
      fetchPage: async (url) => {
        if (url === freeCharge.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected FreeCharge page URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    freeCharge.createFreeChargeScraper().run({
      fetchPage: async (url) => {
        if (url === freeCharge.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === freeCharge.COMPANY_CAREER_PAGE_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml.replace(
              'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&amp;source=CAREERSITE#list',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected FreeCharge page URL: ${url}`)
      },
    }),
    /careers page|handoff/i,
  )

  await assert.rejects(
    freeCharge.createFreeChargeScraper().run({
      fetchPage: async (url) => {
        if (url === freeCharge.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === freeCharge.COMPANY_CAREER_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === freeCharge.JOB_BOARD_URL) {
          return { status: 200, url, html: '<html><head><title>Placeholder</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected FreeCharge page URL: ${url}`)
      },
    }),
    /public RippleHire board/i,
  )
})
