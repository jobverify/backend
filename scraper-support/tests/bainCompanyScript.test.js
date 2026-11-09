import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_INDIA_OFFICES = ['Bengaluru', 'Mumbai', 'New Delhi']

const careersHomeHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Bain | Bain &amp; Company</title>
  </head>
  <body>
    <a href="/careers/find-a-role/" class="btn--pill-hamburger">FIND JOBS</a>
    <a href="/careers/work-with-us/">Work with Us</a>
  </body>
</html>
`

const findARoleHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Find a Role  | Bain &amp; Company</title>
  </head>
  <body>
    <script>
      var autocompleteUrl = '/en/api/search/autocomplete/get';
    </script>
    <script>
      var jobRoleSearchPageData = {
        applyButtonCTAText: "APPLY",
        viewJobDescriptionUrl: "/careers/find-a-role/position/",
        searchImage: "/globalassets/careers/images/hero-imagery/u0.1-find-jobs-1198x118.jpg"
      }
      var feedTranslations = {
        showingResultsFormat: "Showing: {DisplayedJobCount} of {AvailableJobCount} roles",
        roleSearchOfficeCountFormat: "+ {Number} offices"
      }
      var roleSearchEndpoint = '/en/api/jobsearch/keyword/get';
      var autocompleteUrl = '/en/api/jobsearch/autocomplete/get';
      var searchPaginationEndpoint = '/en/api/jobsearch/keyword/get';
      var resultsPerPage = 10;
      var epiEditModeText = 'epieditmode';
    </script>
    <div id="role-search-page-react"></div>
  </body>
</html>
`

const apiPayload = {
  results: [
    {
      JobId: '105837',
      JobTitle: 'Associate - AI Engineer (CTE)',
      JobDescription:
        '<p><strong>About the role:</strong> Build AI accelerators for Bain&rsquo;s CTE teams.</p><p>Work closely with consulting and platform teams.</p>',
      Link: '/careers/find-a-role/position/?jobid=105837',
      Location: ['New Delhi'],
      Categories: ['Analytics, Data, & Research'],
      EmployeeType: 'Permanent Full-Time',
    },
    {
      JobId: '100975',
      JobTitle: 'Lead Platform Engineer',
      JobDescription:
        '<p>Lead platform engineering across India-based technology teams.</p>',
      Link: '/careers/find-a-role/position/?jobid=100975',
      Location: ['Bengaluru', 'Mumbai', 'New Delhi'],
      Categories: ['Technology & Engineering'],
      EmployeeType: 'Permanent Full-Time',
    },
    {
      JobId: '10403',
      JobTitle: 'Associate Consultant Internship',
      JobDescription:
        '<div><p>Our internship program offers broad exposure to consulting.</p><p>See application for full list of global locations.</p></div>',
      Link: '/careers/work-with-us/internships-programs/associate-consultant-internship/',
      Location: ['Amsterdam', 'Bengaluru', 'Mumbai', 'New Delhi'],
      Categories: ['Management Consulting'],
      EmployeeType: 'Temporary Full-Time',
    },
    {
      JobId: '2299196',
      JobTitle: 'True North: Scholarship for Women - India',
      JobDescription:
        '<p>Scholarship and community program for women considering strategy consulting careers in India.</p>',
      Link: '/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
      Location: ['Bengaluru', 'Mumbai', 'New Delhi'],
      Categories: ['Management Consulting'],
      EmployeeType: 'Program',
    },
    {
      JobId: '55555',
      JobTitle: 'Chicago Office Role',
      JobDescription: '<p>US-only role.</p>',
      Link: '/careers/find-a-role/position/?jobid=55555',
      Location: ['Chicago'],
      Categories: ['Management Consulting'],
      EmployeeType: 'Permanent Full-Time',
    },
  ],
  totalResults: 5,
  ctaLink: '/careers/find-a-role/',
  filters: {
    filterBlocks: [
      { filterGroup: 'workareas', filterArray: [{ label: 'Consulting', value: 'consulting' }] },
      { filterGroup: 'teams', filterArray: [{ label: 'PEG', value: 'peg' }] },
      { filterGroup: 'employmenttype', filterArray: [{ label: 'Full-Time', value: 'fulltime' }] },
      { filterGroup: 'offices', filterColumns: [[{ filterArray: [{ label: 'New Delhi', value: 'New Delhi' }] }]] },
    ],
  },
}

const loadBainCompanyModule = async () => {
  try {
    return await import('../../scraper/baincompany/script.js')
  } catch {
    assert.fail('Expected Bain & Company scraper module at ../../scraper/baincompany/script.js')
  }
}

test('Bain & Company helpers stay pinned to the verified careers home, find-a-role shell, and first-party jobsearch API shape', async () => {
  const bainCompany = await loadBainCompanyModule()

  assert.equal(bainCompany.SOURCE, 'baincompany')
  assert.equal(bainCompany.COMPANY, 'Bain & Company')
  assert.equal(bainCompany.OFFICIAL_BRAND_NAME, 'Bain & Company, Inc.')
  assert.equal(bainCompany.VERIFIED_ON, '2026-07-15')
  assert.equal(bainCompany.HOMEPAGE_URL, 'https://www.bain.com/')
  assert.equal(bainCompany.CAREERS_HOME_URL, 'https://www.bain.com/careers/')
  assert.equal(bainCompany.CAREERS_URL, 'https://www.bain.com/careers/find-a-role/')
  assert.equal(
    bainCompany.JOB_SEARCH_API_URL,
    'https://www.bain.com/en/api/jobsearch/keyword/get',
  )
  assert.deepEqual(bainCompany.VERIFIED_INDIA_OFFICES, VERIFIED_INDIA_OFFICES)
  assert.equal(bainCompany.hasCareersHomeSignal(careersHomeHtml), true)
  assert.equal(bainCompany.hasFindARoleSignal(findARoleHtml), true)
  assert.deepEqual(bainCompany.extractRoleSearchConfig(findARoleHtml), {
    viewJobDescriptionUrl: '/careers/find-a-role/position/',
    roleSearchEndpoint: '/en/api/jobsearch/keyword/get',
    autocompleteUrl: '/en/api/jobsearch/autocomplete/get',
    searchPaginationEndpoint: '/en/api/jobsearch/keyword/get',
    resultsPerPage: 10,
  })
  assert.equal(
    bainCompany.buildAllRolesApiUrl(
      'https://www.bain.com/en/api/jobsearch/keyword/get',
      { start: 0, results: 500, filters: '', searchValue: '' },
    ),
    'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue=',
  )
  assert.equal(bainCompany.hasJobSearchPayloadShape(apiPayload), true)

  assert.deepEqual(
    bainCompany.extractIndiaJobs(apiPayload).map((job) => ({
      jobId: job.jobId,
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
    })),
    [
      {
        jobId: '105837',
        title: 'Associate - AI Engineer (CTE)',
        department: 'Analytics, Data, & Research',
        location: 'New Delhi, India',
        city: 'New Delhi',
        sourceUrl: 'https://www.bain.com/careers/find-a-role/position/?jobid=105837',
        applyUrl: 'https://careers.bain.com/jobs/Login?folderId=105837',
        employmentType: 'Permanent Full-Time',
      },
      {
        jobId: '100975',
        title: 'Lead Platform Engineer',
        department: 'Technology & Engineering',
        location: 'Bengaluru, Mumbai, New Delhi, India',
        city: 'Bengaluru',
        sourceUrl: 'https://www.bain.com/careers/find-a-role/position/?jobid=100975',
        applyUrl: 'https://careers.bain.com/jobs/Login?folderId=100975',
        employmentType: 'Permanent Full-Time',
      },
      {
        jobId: '10403',
        title: 'Associate Consultant Internship',
        department: 'Management Consulting',
        location: 'Bengaluru, Mumbai, New Delhi, India',
        city: 'Bengaluru',
        sourceUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
        applyUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
        employmentType: 'Temporary Full-Time',
      },
      {
        jobId: '2299196',
        title: 'True North: Scholarship for Women - India',
        department: 'Management Consulting',
        location: 'Bengaluru, Mumbai, New Delhi, India',
        city: 'Bengaluru',
        sourceUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
        applyUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
        employmentType: 'Program',
      },
    ],
  )
  assert.match(
    bainCompany.extractIndiaJobs(apiPayload)[0].jobDescription,
    /Build AI accelerators for Bain's CTE teams\./i,
  )
  assert.match(
    bainCompany.extractIndiaJobs(apiPayload)[1].jobDescription,
    /Lead platform engineering across India-based technology teams\./i,
  )
})

test('Bain & Company run returns only India-facing roles from the verified first-party API surface', async () => {
  const bainCompany = await loadBainCompanyModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await bainCompany.createBainCompanyScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === bainCompany.CAREERS_HOME_URL) {
        return { status: 200, url, html: careersHomeHtml }
      }

      if (url === bainCompany.CAREERS_URL) {
        return { status: 200, url, html: findARoleHtml }
      }

      throw new Error(`Unexpected Bain & Company page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (
        url ===
        'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue='
      ) {
        return { status: 200, url, json: apiPayload }
      }

      throw new Error(`Unexpected Bain & Company JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    bainCompany.CAREERS_HOME_URL,
    bainCompany.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue=',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Associate - AI Engineer (CTE)',
      company: 'Bain & Company',
      department: 'Analytics, Data, & Research',
      location: 'New Delhi, India',
      city: 'New Delhi',
      country: 'India',
      jobId: '105837',
      requisitionId: '105837',
      sourceUrl: 'https://www.bain.com/careers/find-a-role/position/?jobid=105837',
      applyUrl: 'https://careers.bain.com/jobs/Login?folderId=105837',
      employmentType: 'Permanent Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "About the role: Build AI accelerators for Bain's CTE teams. Work closely with consulting and platform teams.",
      source: 'baincompany',
      link: 'https://careers.bain.com/jobs/Login?folderId=105837',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Lead Platform Engineer',
      company: 'Bain & Company',
      department: 'Technology & Engineering',
      location: 'Bengaluru, Mumbai, New Delhi, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '100975',
      requisitionId: '100975',
      sourceUrl: 'https://www.bain.com/careers/find-a-role/position/?jobid=100975',
      applyUrl: 'https://careers.bain.com/jobs/Login?folderId=100975',
      employmentType: 'Permanent Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead platform engineering across India-based technology teams.',
      source: 'baincompany',
      link: 'https://careers.bain.com/jobs/Login?folderId=100975',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Associate Consultant Internship',
      company: 'Bain & Company',
      department: 'Management Consulting',
      location: 'Bengaluru, Mumbai, New Delhi, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '10403',
      requisitionId: '10403',
      sourceUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
      applyUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
      employmentType: 'Temporary Full-Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Our internship program offers broad exposure to consulting. See application for full list of global locations.',
      source: 'baincompany',
      link: 'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'True North: Scholarship for Women - India',
      company: 'Bain & Company',
      department: 'Management Consulting',
      location: 'Bengaluru, Mumbai, New Delhi, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '2299196',
      requisitionId: '2299196',
      sourceUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
      applyUrl: 'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
      employmentType: 'Program',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Scholarship and community program for women considering strategy consulting careers in India.',
      source: 'baincompany',
      link: 'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Bain & Company fails closed when the careers home, search shell, or API payload drifts', async () => {
  const bainCompany = await loadBainCompanyModule()

  await assert.rejects(
    bainCompany.createBainCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === bainCompany.CAREERS_HOME_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Bain & Company page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: bainCompany.JOB_SEARCH_API_URL, json: apiPayload }),
    }),
    /careers home/i,
  )

  await assert.rejects(
    bainCompany.createBainCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === bainCompany.CAREERS_HOME_URL) {
          return { status: 200, url, html: careersHomeHtml }
        }

        if (url === bainCompany.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: findARoleHtml.replace('/en/api/jobsearch/keyword/get', '/en/api/jobsearch/changed'),
          }
        }

        throw new Error(`Unexpected Bain & Company page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: bainCompany.JOB_SEARCH_API_URL, json: apiPayload }),
    }),
    /find-a-role/i,
  )

  await assert.rejects(
    bainCompany.createBainCompanyScraper().run({
      fetchPage: async (url) => {
        if (url === bainCompany.CAREERS_HOME_URL) {
          return { status: 200, url, html: careersHomeHtml }
        }

        if (url === bainCompany.CAREERS_URL) {
          return { status: 200, url, html: findARoleHtml }
        }

        throw new Error(`Unexpected Bain & Company page URL: ${url}`)
      },
      fetchJson: async () => ({
        status: 200,
        url: 'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue=',
        json: { results: [{ JobTitle: 'Broken' }] },
      }),
    }),
    /jobsearch api/i,
  )
})
