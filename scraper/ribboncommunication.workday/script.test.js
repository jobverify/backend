import assert from 'node:assert/strict'
import test from 'node:test'

const loadRibbonModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ribbon Communication scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ribbon Careers</title>
  </head>
  <body>
    <main>
      <h1>Find Your Next Job</h1>
      <a href="https://vhr-genband.wd1.myworkdayjobs.com/ribboncareers">Ribbon Careers</a>
    </main>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta property="og:title" content="Careers at Ribbon">
    <meta
      property="og:description"
      content="Ribbon Communications (Nasdaq: RBBN) delivers communications software."
    >
    <script type="text/javascript">
      window.workday = window.workday || {
        tenant: "vhr_genband",
        siteId: "ribboncareers",
        requestLocale: "en-US"
      };
    </script>
  </head>
  <body>
    <h1>Careers at Ribbon</h1>
  </body>
</html>
`

const firstDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <script type="application/ld+json">
      {
        "@type": "JobPosting",
        "title": "IT System Administrator Technical Specialist",
        "employmentType": "FULL_TIME",
        "datePosted": "2026-06-12",
        "description": "Maintain and improve internal enterprise systems for Ribbon Communications.",
        "identifier": {
          "@type": "PropertyValue",
          "value": "REQ-2026-2958"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "India",
            "addressLocality": "Varthur Hobli"
          }
        }
      }
    </script>
  </head>
  <body></body>
</html>
`

const secondDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <script type="application/ld+json">
      {
        "@type": "JobPosting",
        "title": "Systems Engineering Consultant",
        "employmentType": "FULL_TIME",
        "datePosted": "2026-05-08",
        "description": "Ribbon Communications is looking for a talented Consultant-Optical Engineer.",
        "identifier": {
          "@type": "PropertyValue",
          "value": "REQ-2026-2934"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "India",
            "addressLocality": "DELHI"
          }
        }
      }
    </script>
  </head>
  <body></body>
</html>
`

test('Ribbon scraper verifies the official careers handoff and normalizes India Workday jobs', async () => {
  const ribbon = await loadRibbonModule()
  const requestedTextUrls = []
  const requestedBodies = []

  const jobs = await ribbon.run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === ribbon.CAREER_PAGE_URL) return officialCareersHtml
      if (url === ribbon.WORKDAY_BASE_URL) return workdayBoardHtml
      if (url.endsWith('Technical-Specialist_REQ-2026-2958')) return firstDetailHtml
      if (url.endsWith('Consultant_REQ-2026-2934')) return secondDetailHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requestedBodies.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      return {
        total: 2,
        jobPostings: [
          {
            title: 'IT System Administrator Technical Specialist',
            externalPath: '/job/India-Karnataka-Varthur-Hobli/IT-System-Administrator-Technical-Specialist_REQ-2026-2958',
            locationsText: 'India, Karnataka, Varthur Hobli',
            postedOn: 'Posted Today',
            bulletFields: ['REQ-2026-2958'],
          },
          {
            title: 'Systems Engineering Consultant',
            externalPath: '/job/India-New-Delhi/Systems-Engineering-Consultant_REQ-2026-2934',
            locationsText: 'India, New Delhi',
            postedOn: 'Posted Yesterday',
            bulletFields: ['REQ-2026-2934'],
          },
        ],
      }
    },
  })

  assert.equal(ribbon.COMPANY_NAME, 'Ribbon Communications')
  assert.equal(ribbon.SOURCE, 'ribboncommunication')
  assert.equal(ribbon.CAREER_PAGE_URL, 'https://ribboncommunications.com/company/careers')
  assert.equal(ribbon.WORKDAY_BASE_URL, 'https://vhr-genband.wd1.myworkdayjobs.com/ribboncareers')
  assert.equal(
    ribbon.WORKDAY_DETAIL_URL_BASE,
    'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers',
  )
  assert.equal(
    ribbon.WORKDAY_JOBS_API_URL,
    'https://vhr-genband.wd1.myworkdayjobs.com/wday/cxs/vhr_genband/ribboncareers/jobs',
  )
  assert.equal(ribbon.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(ribbon.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(ribbon.hasVerifiedWorkdayBoardSignal(workdayBoardHtml), true)
  assert.equal(
    ribbon.extractVerifiedWorkdayHandoffUrl(officialCareersHtml),
    'https://vhr-genband.wd1.myworkdayjobs.com/ribboncareers',
  )
  assert.deepEqual(
    JSON.parse(ribbon.buildJobsApiRequest()),
    {
      appliedFacets: {
        locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
      },
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )

  assert.deepEqual(requestedTextUrls, [
    ribbon.CAREER_PAGE_URL,
    ribbon.WORKDAY_BASE_URL,
    'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-Karnataka-Varthur-Hobli/IT-System-Administrator-Technical-Specialist_REQ-2026-2958',
    'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-New-Delhi/Systems-Engineering-Consultant_REQ-2026-2934',
  ])
  assert.deepEqual(requestedBodies, [
    {
      url: ribbon.WORKDAY_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        },
        limit: 20,
        offset: 0,
        searchText: '',
      },
    },
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map(({ scrapedAt, postedAt, ...job }) => ({
      ...job,
      postedAtType: postedAt instanceof Date,
      scrapedAtType: typeof scrapedAt,
    })),
    [
      {
        jobId: 'REQ-2026-2958',
        title: 'IT System Administrator Technical Specialist',
        company: 'Ribbon Communications',
        department: null,
        location: 'India, Karnataka, Varthur Hobli',
        city: 'Varthur Hobli',
        country: 'India',
        sourceUrl:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-Karnataka-Varthur-Hobli/IT-System-Administrator-Technical-Specialist_REQ-2026-2958',
        applyUrl:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-Karnataka-Varthur-Hobli/IT-System-Administrator-Technical-Specialist_REQ-2026-2958/apply',
        employmentType: 'FULL_TIME',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        closingDate: null,
        jobDescription: 'Maintain and improve internal enterprise systems for Ribbon Communications.',
        requisitionId: 'REQ-2026-2958',
        source: 'ribboncommunication',
        link:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-Karnataka-Varthur-Hobli/IT-System-Administrator-Technical-Specialist_REQ-2026-2958/apply',
        postedAtType: true,
        scrapedAtType: 'string',
      },
      {
        jobId: 'REQ-2026-2934',
        title: 'Systems Engineering Consultant',
        company: 'Ribbon Communications',
        department: null,
        location: 'India, New Delhi',
        city: 'New Delhi',
        country: 'India',
        sourceUrl:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-New-Delhi/Systems-Engineering-Consultant_REQ-2026-2934',
        applyUrl:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-New-Delhi/Systems-Engineering-Consultant_REQ-2026-2934/apply',
        employmentType: 'FULL_TIME',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        closingDate: null,
        jobDescription: 'Ribbon Communications is looking for a talented Consultant-Optical Engineer.',
        requisitionId: 'REQ-2026-2934',
        source: 'ribboncommunication',
        link:
          'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers/job/India-New-Delhi/Systems-Engineering-Consultant_REQ-2026-2934/apply',
        postedAtType: true,
        scrapedAtType: 'string',
      },
    ],
  )
})

test('Ribbon scraper fails closed when the official careers handoff changes', async () => {
  const ribbon = await loadRibbonModule()

  await assert.rejects(
    ribbon.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /official careers page changed/i,
  )

  await assert.rejects(
    ribbon.run({
      fetchText: async (url) => {
        if (url === ribbon.CAREER_PAGE_URL) {
          return `
            <html>
              <head><title>Ribbon Careers</title></head>
              <body>
                <h1>Find Your Next Job</h1>
                <a href="https://vhr-genband.wd1.myworkdayjobs.com/otherboard">Ribbon Careers</a>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified workday handoff changed/i,
  )
})

test('Ribbon scraper fails closed when the public Workday board no longer matches the verified tenant', async () => {
  const ribbon = await loadRibbonModule()

  await assert.rejects(
    ribbon.run({
      fetchText: async (url) => {
        if (url === ribbon.CAREER_PAGE_URL) return officialCareersHtml
        if (url === ribbon.WORKDAY_BASE_URL) return '<html><body><h1>Jobs</h1></body></html>'
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified workday board changed/i,
  )
})


test('Ribbon detects maintenance before checking Workday company identity', async () => {
  const ribbon = await loadRibbonModule()
  await assert.rejects(ribbon.createRibbonCommunicationScraper().run({
    fetchText: async (url) => url === ribbon.CAREER_PAGE_URL ? officialCareersHtml : '<title>Workday is currently unavailable.</title>',
    fetchJson: async () => assert.fail('Must not query jobs during maintenance'),
  }), (error) => error.name === 'WorkdayUpstreamOutageError')
})
