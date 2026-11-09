import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Havas India</title>
    <link rel="canonical" href="https://in.havas.com/careers/" />
  </head>
  <body>
    <main>
      <h1>People & Culture</h1>
      <h2>Life At Havas</h2>
      <a href="https://rb.gy/5daebl" class="-cta-link1">
        Explore our current job openings and take the next step in your career with Havas India.
      </a>
    </main>
  </body>
</html>
`

const officialWorkdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta
      name="description"
      property="og:description"
      content="If you don't find a suitable opening on our Career Site, don't worry! About Us Founded in 1835 by Charles-Louis Havas, Havas is one of the world's largest global communications groups."
    >
    <meta property="og:url" content="https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite">
  </head>
  <body>
    <script type="text/javascript">
      window.workday = {
        tenant: "havas",
        siteId: "GroupExternalCareerSite"
      }
    </script>
  </body>
</html>
`

const unfilteredJobsPayload = {
  total: 447,
  jobPostings: [
    {
      title: 'Senior Art Director',
      externalPath: '/job/Lisboa/Senior-Art-Director_JR0097865',
      locationsText: 'Lisboa',
      postedOn: 'Posted Yesterday',
      bulletFields: ['JR0097865', 'Havas Worldwide Portugal, LDA (Portugal)'],
    },
  ],
  facets: [
    {
      facetParameter: 'Country',
      values: [
        {
          descriptor: 'France',
          id: 'france-facet-id',
          count: 80,
        },
        {
          descriptor: 'India',
          id: 'c4f78be1a8f14da0ab49ce1162348a5e',
          count: 53,
        },
      ],
    },
  ],
}

const filteredIndiaJobsPayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Business Development Manager',
      externalPath: '/job/Gurugram/Business-Development-Manager_JR0065257',
      locationsText: 'Gurugram',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['JR0065257', 'THINK DESIGN COLLABORATIVE PRIVATE LIMITED'],
    },
    {
      title: 'Digital Developer',
      externalPath: '/job/Chennai/Digital-Developer_JR0097642-1',
      locationsText: 'Chennai',
      postedOn: 'Posted Yesterday',
      bulletFields: ['JR0097642', 'Havas Worldwide India Pvt Ltd'],
    },
    {
      title: 'Senior Data Analyst - CSA',
      externalPath: '/job/Bengaluru/Senior-Data-Analyst---CSA_JR0095516',
      locationsText: 'Bengaluru',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['JR0095516', 'PivotRoots Digital Private Limited'],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/havasindia.workday/script.js')
  } catch {
    assert.fail('Expected Havas India scraper module at ../../scraper/havasindia.workday/script.js')
  }
}

test('Havas India pins the verified first-party careers page, public Workday board, and India country facet contract', async () => {
  const havasIndia = await loadModule()

  assert.equal(havasIndia.SOURCE, 'havasindia')
  assert.equal(havasIndia.COMPANY, 'Havas India')
  assert.equal(havasIndia.CAREERS_URL, 'https://in.havas.com/careers/')
  assert.equal(
    havasIndia.WORKDAY_BOARD_URL,
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite',
  )
  assert.equal(
    havasIndia.JOBS_API_URL,
    'https://wd3.myworkdaysite.com/wday/cxs/havas/GroupExternalCareerSite/jobs',
  )
  assert.equal(
    havasIndia.VERIFIED_INDIA_COUNTRY_FACET_ID,
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(havasIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    havasIndia.extractVerifiedWorkdayBoardUrl(officialCareersHtml),
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite',
  )
  assert.equal(havasIndia.hasOfficialWorkdayBoardSignal(officialWorkdayBoardHtml), true)
  assert.equal(
    havasIndia.extractIndiaCountryFacetId(unfilteredJobsPayload),
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.deepEqual(
    JSON.parse(havasIndia.buildUnfilteredJobsRequestBody({ offset: 0 })),
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )
  assert.deepEqual(
    JSON.parse(
      havasIndia.buildIndiaJobsRequestBody({
        offset: 20,
        countryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e',
      }),
    ),
    {
      appliedFacets: {
        Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      },
      limit: 20,
      offset: 20,
      searchText: '',
    },
  )
  assert.deepEqual(
    havasIndia.extractJobsFromPayload(filteredIndiaJobsPayload, FIXED_SCRAPED_AT),
    [
      {
        jobId: 'JR0065257',
        title: 'Business Development Manager',
        company: 'Havas India',
        department: null,
        location: 'Gurgaon, India',
        city: 'Gurgaon',
        locations: ['Gurugram'],
        link: 'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Gurugram/Business-Development-Manager_JR0065257',
        source: 'havasindia',
        postedAt: null,
        closingDate: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        experienceRequired: null,
        requisitionId: 'JR0065257',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'JR0097642',
        title: 'Digital Developer',
        company: 'Havas India',
        department: null,
        location: 'Chennai, India',
        city: 'Chennai',
        locations: ['Chennai'],
        link: 'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Chennai/Digital-Developer_JR0097642-1',
        source: 'havasindia',
        postedAt: null,
        closingDate: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        experienceRequired: null,
        requisitionId: 'JR0097642',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'JR0095516',
        title: 'Senior Data Analyst - CSA',
        company: 'Havas India',
        department: null,
        location: 'Bangalore, India',
        city: 'Bangalore',
        locations: ['Bengaluru'],
        link: 'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Bengaluru/Senior-Data-Analyst---CSA_JR0095516',
        source: 'havasindia',
        postedAt: null,
        closingDate: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        experienceRequired: null,
        requisitionId: 'JR0095516',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Havas India run validates the verified first-party handoff and extracts India Workday jobs through an injected jobs API fetcher', async () => {
  const havasIndia = await loadModule()
  const requestedPages = []
  const requestedJobsCalls = []

  const jobs = await havasIndia.createHavasIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === havasIndia.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === havasIndia.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      throw new Error(`Unexpected Havas India page URL: ${url}`)
    },
    fetchJobsPage: async (request) => {
      requestedJobsCalls.push(request)

      if (requestedJobsCalls.length === 1) {
        return unfilteredJobsPayload
      }

      if (requestedJobsCalls.length === 2) {
        return filteredIndiaJobsPayload
      }

      throw new Error(`Unexpected Havas India jobs API call #${requestedJobsCalls.length}`)
    },
  })

  assert.deepEqual(requestedPages.slice(0, 2), [
    havasIndia.CAREERS_URL,
    havasIndia.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(requestedPages.slice(2), [
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Gurugram/Business-Development-Manager_JR0065257',
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Chennai/Digital-Developer_JR0097642-1',
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Bengaluru/Senior-Data-Analyst---CSA_JR0095516',
  ])
  assert.deepEqual(requestedJobsCalls, [
    { offset: 0, limit: 20, countryFacetId: null },
    { offset: 0, limit: 20, countryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e' },
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.requisitionId, job.source, job.scrapedAt]),
    [
      ['Business Development Manager', 'Gurgaon, India', 'JR0065257', 'havasindia', FIXED_SCRAPED_AT],
      ['Digital Developer', 'Chennai, India', 'JR0097642', 'havasindia', FIXED_SCRAPED_AT],
      ['Senior Data Analyst - CSA', 'Bangalore, India', 'JR0095516', 'havasindia', FIXED_SCRAPED_AT],
    ],
  )
})

test('Havas India enriches India Workday jobs with public detail-page experience', async () => {
  const havasIndia = await loadModule()

  const detailHtmlByUrl = {
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Chennai/Digital-Developer_JR0097642-1': `
      <html>
        <body>
          <section data-automation-id="jobPostingDescription">
            <div>
              <p>Required Skills & Qualifications</p>
              <p>3-5 years of experience in digital production, banner development, and email development.</p>
            </div>
          </section>
        </body>
      </html>
    `,
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Bengaluru/Senior-Data-Analyst---CSA_JR0095516': `
      <html>
        <body>
          <section data-automation-id="jobPostingDescription">
            <div>
              <p>Qualifications</p>
              <p>2-5 years of relevant experience in data science or analytics roles.</p>
            </div>
          </section>
        </body>
      </html>
    `,
  }

  const jobs = await havasIndia.createHavasIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      if (url === havasIndia.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === havasIndia.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      if (detailHtmlByUrl[url]) {
        return {
          status: 200,
          url,
          html: detailHtmlByUrl[url],
        }
      }

      throw new Error(`Unexpected Havas India page URL: ${url}`)
    },
    fetchJobsPage: async (request) => (
      request.countryFacetId == null ? unfilteredJobsPayload : filteredIndiaJobsPayload
    ),
  })

  const digitalDeveloper = jobs.find((job) => job.requisitionId === 'JR0097642')
  const seniorDataAnalyst = jobs.find((job) => job.requisitionId === 'JR0095516')

  assert.equal(digitalDeveloper?.experienceRequired, '3-5 years')
  assert.match(digitalDeveloper?.jobDescription || '', /digital production/i)
  assert.equal(seniorDataAnalyst?.experienceRequired, '2-5 years')
  assert.match(seniorDataAnalyst?.jobDescription || '', /data science or analytics roles/i)
})


test('Havas India reports Workday maintenance before validating board identity or requesting jobs', async () => {
  const havasIndia = await loadModule()
  await assert.rejects(havasIndia.createHavasIndiaScraper().run({
    fetchPage: async (url) => ({
      status: 200, url,
      html: url === havasIndia.CAREERS_URL
        ? officialCareersHtml
        : '<html><title>Workday is currently unavailable.</title></html>',
    }),
    fetchJobsPage: async () => assert.fail('Maintenance must not request the jobs API'),
  }), (error) => error.name === 'WorkdayUpstreamOutageError')
})
