import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CitiusTech | Healthcare Technology Solutions &amp; Service Provider in US</title>
  </head>
  <body>
    <main>
      <h1>CitiusTech</h1>
      <p>Healthcare Technology Solutions &amp; Service Provider in US.</p>
      <a href="/careers">Careers</a>
    </main>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CitiusTech Careers | Build Real Impact. Join Our Team.</title>
  </head>
  <body>
    <main>
      <h1>Build Real Impact. Join Our Team.</h1>
      <a href="https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&amp;source=CAREERSITE#list" target="_blank" rel="noopener">
        Open Roles
      </a>
    </main>
  </body>
</html>
`

const jobBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CitiusTech Careers | Latest jobs at CitiusTech - Ripplehire.com</title>
    <meta
      name="description"
      content="Find current job openings at CitiusTech in Pune, Hyderabad, Chennai, Mumbai, Bengaluru, Gurugram, Trivandrum, Denwar, and Remote."
    />
  </head>
  <body>
    <div id="app">Latest jobs at CitiusTech</div>
  </body>
</html>
`

const SEARCH_RESULTS_PAYLOAD = {
  startJobIndex: 0,
  maxJobSize: 10,
  totalJobCount: 73,
  jobVoList: [
    {
      jobSeq: '891631',
      jobTitle: 'Lead Engineer - I_Security Operations Center',
      jobLocation: null,
      jobReqExp: '5 - 7 Years',
      jobPostingDate: null,
      locations: 'CT Pune (E) - EON',
      jobId: '891631',
      bussinessUnit: null,
    },
    {
      jobSeq: '891147',
      jobTitle: 'Technical Specialist_Immigration and Travel',
      jobLocation: '',
      jobReqExp: '10 - 15 Years',
      jobPostingDate: null,
      locations: 'New Jersey',
      jobId: '891147',
      bussinessUnit: null,
    },
    {
      jobSeq: '888644',
      jobTitle: 'Technical Lead - II_ETL',
      jobLocation: null,
      jobReqExp: '7 - 10 Years',
      jobPostingDate: null,
      locations: 'CT Pune Qubix SEZ1',
      jobId: '888644',
      bussinessUnit: null,
    },
  ],
}

const JOB_DETAIL_PAYLOAD = {
  companyVO: {
    companyName: 'CitiusTech',
  },
  jobVO: {
    jobSeq: '891631',
    jobId: '891631',
    jobTitle: 'Lead Engineer - I_Security Operations Center',
    jobDesc: `
      <p><strong>Who we are</strong></p>
      <p>CitiusTech is a global IT services, consulting, and business solutions enterprise 100% focused on the healthcare and life sciences industry.</p>
      <p><strong>Responsibilities: -</strong></p>
      <ul>
        <li>Monitor and analyze security alerts using next-gen SIEM platforms.</li>
        <li>Execute initial incident response actions (containment, enrichment, documentation).</li>
      </ul>
      <p><strong>Experience: -</strong></p>
      <ul>
        <li>5 - 7 Years</li>
      </ul>
      <p><strong>Location: -</strong></p>
      <ul>
        <li>Pune</li>
        <li>Mumbai</li>
      </ul>
      <p><strong>Educational Qualifications: -</strong></p>
      <ul>
        <li>Engineering Degree - BE/ME/BTech/MTech/BSc/MSc.</li>
        <li>Technical certification in multiple technologies is desirable.</li>
      </ul>
      <p><strong>Mandatory Technical Skills: -</strong></p>
      <ul>
        <li>Security Operations Center (SOC)</li>
      </ul>
      <p><strong>Good to Have Skills: -</strong></p>
      <ul>
        <li>Google Chronicle/SecOps/CrowdStrike</li>
      </ul>
    `,
    jobLocation: 'CT Pune (E) - EON',
    jobReqExp: '5 - 7 Years',
    jobType: 'R',
    jobPostingDate: '08-Jul-2026',
    locations: 'CT Pune (E) - EON',
    bussinessUnit: null,
    jobTypeCustom3: 'Employee',
    jobSkills: '',
    publishDetails: {
      CAREER_SITE: '2026-07-10T12:49:00Z',
    },
  },
}

const loadCitiusModule = async () => {
  try {
    return await import('../../scraper/citius/script.js')
  } catch {
    assert.fail('Expected Citius scraper module at ../../scraper/citius/script.js')
  }
}

test('Citius scraper constants and verified-surface helpers stay pinned to the CitiusTech first-party handoff', async () => {
  const citius = await loadCitiusModule()

  assert.equal(citius.SOURCE, 'citius')
  assert.equal(citius.COMPANY, 'Citius')
  assert.equal(citius.OFFICIAL_BRAND_NAME, 'CitiusTech')
  assert.equal(citius.VERIFIED_ON, '2026-07-15')
  assert.equal(citius.HOMEPAGE_URL, 'https://www.citiustech.com/')
  assert.equal(citius.COMPANY_CAREER_PAGE_URL, 'https://www.citiustech.com/careers')
  assert.equal(citius.PORTAL_ORIGIN, 'https://citiustech.ripplehire.com')
  assert.equal(
    citius.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#list',
  )
  assert.equal(
    citius.JOB_BOARD_URL,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE',
  )
  assert.equal(
    citius.JOB_SEARCH_API_URL,
    'https://citiustech.ripplehire.com/candidate/candidatejobsearch',
  )
  assert.deepEqual(citius.buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    token: 'bCKlfz3OO8vQIgiM2vuI',
    source: 'CAREERSITE',
    pagesize: 10,
  })
  assert.equal(citius.extractCareersHandoffUrl(careersPageHtml), citius.OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(citius.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(citius.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.equal(citius.hasVerifiedJobBoardSignal(jobBoardHtml), true)
  assert.equal(citius.isIndiaListing({ location: 'CT Pune (E) - EON' }), true)
  assert.equal(citius.isIndiaListing({ location: 'New Jersey' }), false)
})

test('Citius run verifies the known CitiusTech handoff before decorating RippleHire jobs for the local source', async () => {
  const citius = await loadCitiusModule()
  const pageRequests = []
  const apiRequests = []

  const jobs = await citius.createCitiusScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    maxPages: 1,
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === citius.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === citius.COMPANY_CAREER_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === citius.JOB_BOARD_URL) {
        return { status: 200, url, html: jobBoardHtml }
      }

      throw new Error(`Unexpected Citius page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ? String(options.body) : null,
      })

      if (url === citius.JOB_SEARCH_API_URL) {
        return SEARCH_RESULTS_PAYLOAD
      }

      if (url.includes('jobSeq=891631')) {
        return JOB_DETAIL_PAYLOAD
      }

      if (url.includes('jobSeq=888644')) {
        return {
          ...JOB_DETAIL_PAYLOAD,
          jobVO: {
            ...JOB_DETAIL_PAYLOAD.jobVO,
            jobSeq: '888644',
            jobId: '888644',
            jobTitle: 'Technical Lead - II_ETL',
            jobLocation: 'CT Pune Qubix SEZ1',
            locations: 'CT Pune Qubix SEZ1',
            jobReqExp: '7 - 10 Years',
            jobPostingDate: '06-Jul-2026',
            publishDetails: {
              CAREER_SITE: '2026-07-06T08:15:00Z',
            },
          },
        }
      }

      throw new Error(`Unexpected Citius API URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    citius.HOMEPAGE_URL,
    citius.COMPANY_CAREER_PAGE_URL,
    citius.JOB_BOARD_URL,
  ])
  assert.deepEqual(apiRequests.map((request) => request.method), ['POST', 'GET', 'GET'])
  assert.equal(apiRequests[0].url, citius.JOB_SEARCH_API_URL)
  assert.match(apiRequests[0].body, /bCKlfz3OO8vQIgiM2vuI/)
  assert.match(apiRequests[0].body, /CAREERSITE/)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Citius')
  assert.equal(jobs[0].source, 'citius')
  assert.equal(jobs[0].location, 'Pune, India')
  assert.equal(
    jobs[0].link,
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#apply/job/891631',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Technical Lead - II_ETL')
  assert.equal(jobs[1].company, 'Citius')
  assert.equal(jobs[1].source, 'citius')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Citius scraper fails closed when the verified homepage, careers page, or public RippleHire board drifts', async () => {
  const citius = await loadCitiusModule()

  await assert.rejects(
    citius.createCitiusScraper().run({
      fetchPage: async (url) => {
        if (url === citius.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected Citius page URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    citius.createCitiusScraper().run({
      fetchPage: async (url) => {
        if (url === citius.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === citius.COMPANY_CAREER_PAGE_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml.replace(
              'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&amp;source=CAREERSITE#list',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Citius page URL: ${url}`)
      },
    }),
    /careers page|handoff/i,
  )

  await assert.rejects(
    citius.createCitiusScraper().run({
      fetchPage: async (url) => {
        if (url === citius.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === citius.COMPANY_CAREER_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === citius.JOB_BOARD_URL) {
          return { status: 200, url, html: '<html><head><title>Placeholder</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected Citius page URL: ${url}`)
      },
    }),
    /public RippleHire board/i,
  )
})
