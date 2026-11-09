import assert from 'node:assert/strict'
import test from 'node:test'

const yuluModule = await import('../../scraper/yulu/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  JOBS_BOARD_URL,
  OFFICIAL_BRAND,
  REQUISITION_LIST_URL,
  SOURCE,
  VERIFIED_ON,
  VERIFIED_SURFACE_SUMMARY,
  buildApplyUrl,
  buildJobUrl,
  createYuluScraper,
  extractJobs,
  hasExpectedListingsError,
  hasVerifiedCareersSurface,
  run,
} = yuluModule

const VERIFIED_CAREERS_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Career</title>
    </head>
    <body>
      <main>
        <h1>Redefine Urban Mobility</h1>
        <p>At Yulu, passion meets purpose.</p>
        <h2>Why join us?</h2>
        <h2>Life at Yulu</h2>
        <section>
          <p>Yulu is Indiaâ€™s largest shared EV and BaaS company.</p>
          <button onclick="scrollToDiv()">Explore</button>
          <button onclick="location.href='mailto:career@yulu.bike'">Contact us</button>
        </section>
        <div id="target">
          <script src="https://yulu.mynexthire.com/employer/ui/js/jobboard/careers-integration.js"></script>
          <script>
            document.onreadystatechange = function () {
              if (document.readyState === "complete") {
                mnh_ci_onreadystatechange("careers", "yulu", {});
              }
            };
          </script>
          <iframe id="mnhembedded" src=""></iframe>
        </div>
        <section>
          <h2>Stay in touch!</h2>
          <p>Didn&apos;t find what you are looking for?</p>
          <a href="mailto:career@yulu.bike">career@yulu.bike</a>
        </section>
      </main>
    </body>
  </html>
`

const EXPECTED_LISTINGS_ERROR_MESSAGE =
  'Unable to process your request at this time; please try a little later or contact your administrator!'

const ENUMERABLE_LISTINGS_PAYLOAD = {
  reqDetailsBOList: [
    {
      reqId: 218,
      reqTitle: 'Full Stack Engineer',
      buName: 'Android Development',
      location: 'Bangalore',
      locationAddress: 'Prestige Tech Park, Bengaluru, Karnataka 560103',
      approvedOn: '2026-02-26T09:25:39.077+0000',
      employmentType: 'full-time',
      expMin: 0,
      expMax: 0,
      jdDisplay: '',
    },
    {
      reqId: 203,
      reqTitle: 'Assistant Manager - Refurb & Service Operations',
      buName: 'Electric Vehicles',
      location: 'Mumbai',
      locationAddress: 'BKC, Mumbai, Maharashtra 400051',
      approvedOn: '2026-01-20T11:09:02.007+0000',
      employmentType: 'full-time',
      expMin: 4,
      expMax: 6,
      jdDisplay: 'Lead refurbishment workshop operations and quality checks.',
    },
  ],
}

test('Yulu parses public MyNextHire requisitions from the verified careers shell', async () => {
  let requestedCareersUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedCareersUrl = url
      return VERIFIED_CAREERS_SURFACE_HTML
    },
    fetchJson: async (url, options = {}) => {
      assert.equal(url, REQUISITION_LIST_URL)
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), {
        source: 'careers',
        code: '',
        filterByBuId: -1,
      })

      return ENUMERABLE_LISTINGS_PAYLOAD
    },
  })

  assert.equal(requestedCareersUrl, CAREERS_URL)
  assert.equal(SOURCE, 'yulu')
  assert.equal(COMPANY, 'Yulu')
  assert.equal(OFFICIAL_BRAND, 'Yulu')
  assert.equal(CAREERS_URL, 'https://careers.yulu.bike/')
  assert.equal(JOBS_BOARD_URL, 'https://yulu.mynexthire.com/employer/jobs/careers')
  assert.equal(
    REQUISITION_LIST_URL,
    'https://yulu.mynexthire.com/employer/careers/reqlist/get',
  )
  assert.equal(
    DISPOSITION,
    'verified-first-party-careers-shell-with-mynexthire-public-openings',
  )
  assert.equal(VERIFIED_ON, '2026-08-01')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.yulu\.bike\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/yulu\.mynexthire\.com\/employer\/jobs\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /now returned 4 enumerable India openings/i)
  assert.equal(typeof createYuluScraper, 'function')
  assert.equal(hasVerifiedCareersSurface(VERIFIED_CAREERS_SURFACE_HTML), true)

  assert.deepEqual(extractJobs(ENUMERABLE_LISTINGS_PAYLOAD), [
    {
      title: 'Full Stack Engineer',
      company: 'Yulu',
      department: 'Android Development',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '218',
      requisitionId: '218',
      sourceUrl: buildJobUrl('218'),
      applyUrl: buildApplyUrl('218'),
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-02-26T09:25:39.077Z',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Assistant Manager - Refurb & Service Operations',
      company: 'Yulu',
      department: 'Electric Vehicles',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '203',
      requisitionId: '203',
      sourceUrl: buildJobUrl('203'),
      applyUrl: buildApplyUrl('203'),
      employmentType: 'Full-time',
      experienceRequired: '4-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-01-20T11:09:02.007Z',
      closingDate: null,
      jobDescription: 'Lead refurbishment workshop operations and quality checks.',
      remoteStatus: 'On-site',
    },
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'yulu')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Yulu still returns empty when the public requisition endpoint falls back to the historical error payload', async () => {
  const jobs = await run({
    fetchHtml: async () => VERIFIED_CAREERS_SURFACE_HTML,
    fetchJson: async () => ({ errorMessage: EXPECTED_LISTINGS_ERROR_MESSAGE }),
  })

  assert.deepEqual(jobs, [])
  assert.equal(
    hasExpectedListingsError({ errorMessage: EXPECTED_LISTINGS_ERROR_MESSAGE }),
    true,
  )
})

test('Yulu rejects when the verified careers shell disappears or the embed contract drifts', async () => {
  assert.equal(
    hasVerifiedCareersSurface(`
      <html>
        <body>
          <h1>Careers</h1>
          <p>Explore opportunities with us.</p>
        </body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <body>
            <h1>Careers</h1>
            <p>Explore opportunities with us.</p>
          </body>
        </html>
      `,
      fetchJson: async () => ({ errorMessage: EXPECTED_LISTINGS_ERROR_MESSAGE }),
    }),
    /verified careers shell/i,
  )
})

test('Yulu rejects when the public MyNextHire requisition response changes away from the verified error state and does not expose jobs', async () => {
  assert.equal(hasExpectedListingsError({ errorMessage: 'Service unavailable' }), false)

  await assert.rejects(
    run({
      fetchHtml: async () => VERIFIED_CAREERS_SURFACE_HTML,
      fetchJson: async () => ({ errorMessage: 'Service unavailable' }),
    }),
    /requisition contract changed materially|unexpected public listing response/i,
  )
})
