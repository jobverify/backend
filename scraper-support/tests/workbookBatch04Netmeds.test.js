import assert from 'node:assert/strict'
import test from 'node:test'

const netmedsModule = await import('../../scraper/netmeds/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  CAREERS_PORTAL_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  buildSearchPayload,
  createNetmedsScraper,
  hasVerifiedCompanySurface,
  hasVerifiedRelianceRetailCareersPortal,
  mapSearchResponseToJobs,
  run,
} = netmedsModule

const VERIFIED_COMPANY_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Order Medicine Online from India's Most Trusted Online Pharmacy | Netmeds</title>
      <meta property="og:site_name" content="Netmeds" />
      <meta property="og:url" content="https://www.netmeds.com" />
    </head>
    <body>
      <main>
        <h1>Netmeds</h1>
        <p>India's most trusted online pharmacy.</p>
        <a href="/customer-care">Customer Care</a>
        <a href="https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do">Career</a>
      </main>
    </body>
  </html>
`

const VERIFIED_RCAREERS_PORTAL_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Reliance Retail Careers</title>
    </head>
    <body>
      <main>
        <h1>Welcome to Reliance Retail- India's largest Retail Company</h1>
        <p>Job Opportunities</p>
        <p>Register Now to apply for our career opportunities</p>
        <select id="jbbus">
          <option value="AUxFRkRERCE2">Netmeds</option>
        </select>
      </main>
    </body>
  </html>
`

const DROPDOWN_PAYLOAD = {
  d: {
    results: [
      {
        Mode: 'BU',
        Value: 'BU000218',
        Text: 'Netmeds',
      },
    ],
  },
}

const EMPTY_SEARCH_RESPONSE = {
  d: {
    ApplyJobURLNew: '',
    ApplyJobURLExisting: '',
    ViewJobURL: '',
    ReferralCode: '',
    MessageText: '',
    JobTyp: '',
    NavHeaderToJobSearch: null,
  },
}

test('Netmeds returns [] while the Monday, August 3, 2026 homepage-to-RCareers search contract exposes zero live openings', async () => {
  const requestedHtmlUrls = []
  const requestedJsonUrls = []
  let receivedBusinessOption = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedHtmlUrls.push(url)
      if (url === CAREERS_URL) return VERIFIED_COMPANY_SURFACE_HTML
      if (url === CAREERS_PORTAL_URL) return VERIFIED_RCAREERS_PORTAL_HTML
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return DROPDOWN_PAYLOAD
    },
    executeSearch: async ({ businessOption }) => {
      receivedBusinessOption = businessOption
      return EMPTY_SEARCH_RESPONSE
    },
  })

  assert.deepEqual(requestedHtmlUrls, [
    CAREERS_URL,
    CAREERS_PORTAL_URL,
  ])
  assert.equal(requestedJsonUrls.length, 1)
  assert.deepEqual(receivedBusinessOption, {
    Mode: 'BU',
    Value: 'BU000218',
    Text: 'Netmeds',
  })
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'netmeds')
  assert.equal(COMPANY, 'Netmeds')
  assert.equal(CAREERS_URL, 'https://www.netmeds.com/')
  assert.equal(
    CAREERS_PORTAL_URL,
    'https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do',
  )
  assert.equal(DISPOSITION, 'verified-homepage-handoff-plus-public-rcareers-search')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Monday, August 3, 2026/)
  assert.equal(typeof createNetmedsScraper, 'function')
  assert.equal(hasVerifiedCompanySurface(VERIFIED_COMPANY_SURFACE_HTML), true)
  assert.equal(hasVerifiedRelianceRetailCareersPortal(VERIFIED_RCAREERS_PORTAL_HTML), true)
})

test('Netmeds maps public RCareers OData rows into scrapeable jobs when openings exist', () => {
  const jobs = mapSearchResponseToJobs({
    d: {
      ApplyJobURLNew: '/sap(bD1lbiZjPTQ0OQ==)/bc/bsp/sap/zerec_home_page/apply_job.do?lp=X',
      ApplyJobURLExisting: '/sap(bD1lbiZjPTQ0OQ==)/bc/bsp/sap/zerec_home_page/apply_job_existing.do?lp=X',
      ViewJobURL: '/sap(bD1lbiZjPTQ0OQ==)/bc/bsp/sap/zerec_home_page/job_description.do?lp=X',
      NavHeaderToJobSearch: {
        results: [
          {
            Jobtitle: 'Pharmacist',
            Buisness: 'Netmeds',
            FunArea: 'Retail Pharmacy',
            Location: 'Bangalore',
            JobCode: 'NM-1234',
            EncryptedId: 'ENC-1234',
            PostedOn: '/Date(1785715200000)/',
          },
        ],
      },
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Pharmacist')
  assert.equal(jobs[0].company, 'Netmeds')
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].department, 'Retail Pharmacy')
  assert.equal(jobs[0].requisitionId, 'NM-1234')
  assert.equal(jobs[0].jobId, 'ENC-1234')
  assert.equal(
    jobs[0].sourceUrl,
    'https://rcareers.ril.com/sap(bD1lbiZjPTQ0OQ==)/bc/bsp/sap/zerec_home_page/job_description.do?lp=X&tid=DJ&pid=ENC-1234',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://rcareers.ril.com/sap(bD1lbiZjPTQ0OQ==)/bc/bsp/sap/zerec_home_page/apply_job.do?lp=X&tid=AJ&pid=ENC-1234',
  )
  assert.deepEqual(jobs[0].postedAt, new Date('2026-08-03T00:00:00.000Z'))
  assert.match(jobs[0].jobDescription, /Retail Pharmacy/)
})

test('Netmeds builds the public business-search payload expected by the RCareers app', () => {
  assert.deepEqual(
    buildSearchPayload({
      businessOption: {
        Value: 'BU000218',
        Text: 'Netmeds',
      },
    }),
    {
      Mode: 'JOBLIST',
      JobTyp: null,
      ApplyJobURLNew: '',
      ApplyJobURLExisting: '',
      ViewJobURL: '',
      ReferralCode: '',
      MessageText: '',
      NavHeaderToJobSearch: [],
      NavJobSearchCriteriaSet: [
        {
          Imode: 'BU',
          Mode: 'BU',
          Value: 'BU000218',
          Text: 'Netmeds',
        },
      ],
    },
  )
})

test('Netmeds rejects when the verified exact-name public company surface disappears', async () => {
  assert.equal(
    hasVerifiedCompanySurface(`
      <html>
        <head><title>Example Store</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <head><title>Example Store</title></head>
          <body><h1>Example</h1></body>
        </html>
      `,
    }),
    /verified public company surface/i,
  )
})

test('Netmeds rejects when the public company surface starts exposing a first-party jobs route', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <section>
          <h2>Current Openings</h2>
          <a href="/careers/pharmacist">Pharmacist</a>
        </section>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Netmeds rejects when the public company surface starts exposing trusted ATS signals or JobPosting markup', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <iframe src="https://jobs.ashbyhq.com/netmeds"></iframe>
      `,
    }),
    /public jobs surface changed materially/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async () => `
        ${VERIFIED_COMPANY_SURFACE_HTML}
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"JobPosting","title":"Supply Chain Analyst"}
        </script>
      `,
    }),
    /public jobs surface changed materially/i,
  )
})

test('Netmeds rejects when the verified Reliance Retail careers handoff disappears or the Netmeds business option is no longer public', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => {
        if (url === CAREERS_URL) {
          return VERIFIED_COMPANY_SURFACE_HTML.replace(
            'https://rcareers.ril.com/sap%28bD1lbiZjPTQ0OQ==%29/bc/bsp/sap/zerec_home_page/home_page.do',
            'https://example.com/careers',
          )
        }
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
    }),
    /verified Reliance Retail careers handoff/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async (url) => {
        if (url === CAREERS_URL) return VERIFIED_COMPANY_SURFACE_HTML
        if (url === CAREERS_PORTAL_URL) return VERIFIED_RCAREERS_PORTAL_HTML
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ d: { results: [] } }),
      executeSearch: async () => EMPTY_SEARCH_RESPONSE,
    }),
    /Netmeds business option no longer appears/i,
  )
})
