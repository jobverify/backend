import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Panasonic Corporate Careers</title>
  </head>
  <body>
    <h1>See jobs by: Categories Locations</h1>
    <script>
      window.currentContext = 'corporate';
      window.currentContextValue = 'corporate';
      window.searchConfig = {
        "query": {
          "country": "India"
        },
        "path": "/corporate/jobs/locations/country/India",
        "numRowsPerPage": 10,
        "contextSettings": {
          "currentContext": "corporate",
          "contextDefinitions": [
            {
              "name": "corporate",
              "metadata": {
                "title": "Panasonic Corporate Careers"
              }
            }
          ]
        },
        "pageTitle": "Panasonic Corporate Careers",
        "searchPageHeader": "corporate Job Search"
      };
    </script>
  </body>
</html>
`

const jobsPayload = {
  totalCount: 2,
  count: 2,
  jobs: [
    {
      data: {
        req_id: '2026-49964',
        slug: '49964',
        title: 'Line Maintenance Manager - India',
        city: 'New Delhi',
        country: 'India',
        country_code: 'IN',
        full_location: 'New Delhi, India',
        categories: [{ name: 'Technical Service and Repair' }],
        tags1: ['Full-Time'],
        employment_type: 'Full-Time',
        description: '<p>Lead line maintenance across India.</p>',
        qualifications: '<p>B.Tech or equivalent</p>',
        posted_date: '2026-07-09T10:58:00+0000',
        apply_url: 'https://uscareers-napanasonic.icims.com/jobs/49964/login',
        canonical_url: 'https://careers.na.panasonic.com/jobs/49964?lang=en-us',
      },
    },
    {
      data: {
        req_id: '2025-39825',
        slug: '39825',
        title: 'Software Engineer III - Fullstack + Kubernetes + Devops',
        city: 'Pune',
        country: 'India',
        country_code: 'IN',
        full_location: 'Pune, India',
        categories: [{ name: 'Engineering' }],
        tags1: ['Full-Time'],
        employment_type: null,
        responsibilities: '<p>Build cloud-native services.</p>',
        qualifications: '<p>Bachelor&apos;s degree in Computer Science</p>',
        posted_date: '2025-06-17T09:45:00+0000',
        apply_url: 'https://global-napanasonic.icims.com/jobs/39825/login',
        canonical_url: 'https://careers.na.panasonic.com/jobs/39825?lang=en-us',
      },
    },
  ],
}

const emptyJobsPayload = {
  totalCount: 0,
  count: 0,
  jobs: [],
}

const malformedJobsPayload = {
  totalCount: 0,
  count: 0,
  jobs: null,
}

const loadPanasonicModule = async () => {
  try {
    return await import('../../scraper/panasonic/script.js')
  } catch {
    assert.fail('Expected Panasonic scraper module at ../../scraper/panasonic/script.js')
  }
}

test('Panasonic scraper pins the verified corporate India route and Jibe API contract', async () => {
  const {
    COMPANY,
    COUNTRY_FILTER,
    DEFAULT_PAGE_SIZE,
    OFFICIAL_CAREERS_URL,
    OFFICIAL_JOBS_API_URL,
    SOURCE,
    buildIndiaJobsApiUrl,
    createPanasonicScraper,
    extractOfficialSearchConfig,
    hasOfficialPanasonicCareersSignals,
  } = await loadPanasonicModule()

  assert.equal(COMPANY, 'Panasonic')
  assert.equal(SOURCE, 'panasonic')
  assert.equal(COUNTRY_FILTER, 'India')
  assert.equal(DEFAULT_PAGE_SIZE, 10)
  assert.equal(
    OFFICIAL_CAREERS_URL,
    'https://careers.na.panasonic.com/corporate/jobs/locations/country/India',
  )
  assert.equal(OFFICIAL_JOBS_API_URL, 'https://careers.na.panasonic.com/api/jobs')
  assert.deepEqual(extractOfficialSearchConfig(officialCareersHtml), {
    query: {
      country: 'India',
    },
    path: '/corporate/jobs/locations/country/India',
    numRowsPerPage: 10,
    contextSettings: {
      currentContext: 'corporate',
      contextDefinitions: [
        {
          name: 'corporate',
          metadata: {
            title: 'Panasonic Corporate Careers',
          },
        },
      ],
    },
    pageTitle: 'Panasonic Corporate Careers',
    searchPageHeader: 'corporate Job Search',
  })
  assert.equal(hasOfficialPanasonicCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialPanasonicCareersSignals(
      officialCareersHtml.replace('"country": "India"', '"country": "Canada"'),
    ),
    false,
  )

  const apiUrl = buildIndiaJobsApiUrl({
    page: 2,
    limit: 25,
    searchConfig: extractOfficialSearchConfig(officialCareersHtml),
  })
  const builtUrl = new URL(apiUrl)

  assert.equal(builtUrl.origin + builtUrl.pathname, OFFICIAL_JOBS_API_URL)
  assert.equal(builtUrl.searchParams.get('country'), 'India')
  assert.equal(builtUrl.searchParams.get('internal'), 'false')
  assert.equal(builtUrl.searchParams.get('allLangs'), 'true')
  assert.equal(builtUrl.searchParams.get('dedupeLang'), 'en-us|en-us')
  assert.equal(builtUrl.searchParams.get('facetField'), 'tags1|tags2|tags3|tags4')
  assert.equal(builtUrl.searchParams.get('page'), '2')
  assert.equal(builtUrl.searchParams.get('limit'), '25')

  const scraper = createPanasonicScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace('Panasonic Corporate Careers', 'Panasonic Careers'),
      fetchJson: async () => emptyJobsPayload,
    }),
    /Panasonic verified corporate India careers route no longer matches the trusted public surface/i,
  )
})

test('run maps verified Panasonic India jobs into Jobverify jobs', async () => {
  const { createPanasonicScraper } = await loadPanasonicModule()
  const requestedUrls = []
  const scraper = createPanasonicScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return jobsPayload
    },
  })

  assert.equal(requestedUrls.length, 1)
  assert.match(requestedUrls[0], /^https:\/\/careers\.na\.panasonic\.com\/api\/jobs\?/)
  assert.match(requestedUrls[0], /country=India/)
  assert.match(requestedUrls[0], /page=1/)
  assert.match(requestedUrls[0], /limit=10/)

  assert.deepEqual(jobs, [
    {
      title: 'Line Maintenance Manager - India',
      company: 'Panasonic',
      department: 'Technical Service and Repair',
      location: 'New Delhi, India',
      city: 'New Delhi',
      country: 'India',
      jobId: '2026-49964',
      requisitionId: '2026-49964',
      sourceUrl: 'https://careers.na.panasonic.com/jobs/49964?lang=en-us',
      applyUrl: 'https://uscareers-napanasonic.icims.com/jobs/49964/login',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: 'B.Tech or equivalent',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-09',
      closingDate: null,
      jobDescription: 'Lead line maintenance across India.',
      source: 'panasonic',
      link: 'https://uscareers-napanasonic.icims.com/jobs/49964/login',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Software Engineer III - Fullstack + Kubernetes + Devops',
      company: 'Panasonic',
      department: 'Engineering',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: '2025-39825',
      requisitionId: '2025-39825',
      sourceUrl: 'https://careers.na.panasonic.com/jobs/39825?lang=en-us',
      applyUrl: 'https://global-napanasonic.icims.com/jobs/39825/login',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: "Bachelor's degree in Computer Science",
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-06-17',
      closingDate: null,
      jobDescription: 'Build cloud-native services.',
      source: 'panasonic',
      link: 'https://global-napanasonic.icims.com/jobs/39825/login',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Panasonic returns [] for a verified empty board and fails closed on malformed jobs payloads', async () => {
  const { createPanasonicScraper } = await loadPanasonicModule()
  const scraper = createPanasonicScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async () => emptyJobsPayload,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => malformedJobsPayload,
    }),
    /Panasonic public jobs api no longer exposes the expected jobs array/i,
  )
})
