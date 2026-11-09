import assert from 'node:assert/strict'
import test from 'node:test'

const loadStellantisModule = async () => {
  try {
    return await import('../../scraper/stellantis/script.js')
  } catch {
    assert.fail('Expected Stellantis scraper module at ../../scraper/stellantis/script.js')
  }
}

const firstPagePayload = {
  totalHits: 3,
  nextPageToken: 'next-page-token',
  searchResults: [
    {
      summary: {
        job_summary: 'Build connected vehicle data platforms.',
      },
      job: {
        id: 23559227,
        title: 'Data Engineer',
        primary_city: 'Pune',
        primary_state: 'MH',
        primary_country: 'IN',
        primary_address: 'Pune Tech Center',
        employment_type: 'Full-time',
        open_date: '2026-07-02T12:02:53',
        close_date: '2036-07-02T12:02:53',
        department: 'ICT, Digital and Data',
        url: 'https://careers.stellantis.com/job/23559227/data-engineer-pune-mh/',
        seo_url: 'https://recruiting.adp.com/srccar/public/RTI.home?r=5001208608706&c=2183219&d=ExternalCareerSite&rb=SYMPHONYTALENT',
        description: '<p>Build connected vehicle data platforms.</p>',
      },
    },
    {
      summary: {
        job_summary: 'Lead manufacturing quality work in Michigan.',
      },
      job: {
        id: 23429497,
        title: 'Electrical Engineer',
        primary_city: 'Kokomo',
        primary_state: 'IN',
        primary_country: 'US',
        primary_address: 'Indiana Transmission 1 Plant - Kokomo',
        employment_type: 'Full-time',
        open_date: '2026-07-06T12:02:57',
        close_date: '2036-07-06T12:02:57',
        department: 'Engineering',
        url: 'https://careers.stellantis.com/job/23429497/electrical-engineer-kokomo-in/',
        seo_url: 'https://recruiting.adp.com/srccar/public/RTI.home?r=5001200480106&c=2183219&d=ExternalCareerSite&rb=SYMPHONYTALENT',
        description: '<p>Lead manufacturing quality work in Michigan.</p>',
      },
    },
  ],
}

const secondPagePayload = {
  totalHits: 3,
  nextPageToken: null,
  searchResults: [
    {
      summary: {
        job_summary: 'Own digital manufacturing systems for India plants.',
      },
      job: {
        id: 23561385,
        title: 'Manufacturing Systems Engineer',
        primary_city: 'Chennai',
        primary_state: 'TN',
        primary_country: 'IN',
        primary_address: 'Chennai Engineering Hub',
        employment_type: 'Full-time',
        open_date: '2026-07-03T08:15:00',
        close_date: null,
        department: 'Engineering',
        url: 'https://careers.stellantis.com/job/23561385/manufacturing-systems-engineer-chennai-tn/',
        seo_url: 'https://stellantis.wd3.myworkdayjobs.com/en-US/External/job/Chennai/Manufacturing-Systems-Engineer_23561385/apply',
        description: '<p>Own digital manufacturing systems for India plants.</p>',
      },
    },
  ],
}

test('buildSearchUrl keeps Stellantis requests on the public jobs feed contract', async () => {
  const {
    COMPANY_QUERY_VALUE,
    SEARCH_API_URL,
    SEARCH_PAGE_URL,
    buildDetailUrl,
    buildSearchUrl,
  } = await loadStellantisModule()

  assert.equal(SEARCH_PAGE_URL, 'https://careers.stellantis.com/job-search-results/')
  assert.equal(SEARCH_API_URL, 'https://jobsapi-google.m-cloud.io/api/job/search')
  assert.equal(COMPANY_QUERY_VALUE, 'companies/16115603-6c1b-4c45-b544-238a4e6c51b3')
  assert.equal(
    buildSearchUrl(),
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2F16115603-6c1b-4c45-b544-238a4e6c51b3&limit=10&sortfield=open_date&sortorder=descending',
  )
  assert.equal(
    buildSearchUrl({ pageToken: 'next-page-token' }),
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2F16115603-6c1b-4c45-b544-238a4e6c51b3&limit=10&sortfield=open_date&sortorder=descending&pageToken=next-page-token',
  )
  assert.equal(
    buildDetailUrl({ jobId: 23559227, slug: 'data-engineer-pune-mh' }),
    'https://careers.stellantis.com/job/23559227/data-engineer-pune-mh/',
  )
})

test('extractSearchResults maps India Stellantis rows and preserves feed apply URLs', async () => {
  const {
    extractSearchResults,
    extractSearchSummary,
  } = await loadStellantisModule()

  const jobs = extractSearchResults(firstPagePayload)

  assert.deepEqual(jobs, [
    {
      title: 'Data Engineer',
      company: 'Stellantis',
      department: 'ICT, Digital and Data',
      location: 'Pune, MH, India',
      city: 'Pune',
      state: 'MH',
      country: 'India',
      jobId: '23559227',
      requisitionId: '23559227',
      sourceUrl: 'https://careers.stellantis.com/job/23559227/data-engineer-pune-mh/',
      applyUrl: 'https://recruiting.adp.com/srccar/public/RTI.home?r=5001208608706&c=2183219&d=ExternalCareerSite&rb=SYMPHONYTALENT',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02T12:02:53',
      closingDate: '2036-07-02T12:02:53',
      jobDescription: '<p>Build connected vehicle data platforms.</p>',
    },
  ])

  assert.deepEqual(extractSearchSummary(firstPagePayload), {
    totalJobCount: 3,
    nextPageToken: 'next-page-token',
    pageSize: 2,
  })
})

test('run paginates the Stellantis public feed and returns only India jobs', async () => {
  const {
    createStellantisScraper,
  } = await loadStellantisModule()

  const requestedUrls = []
  const jobs = await createStellantisScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (requestedUrls.length === 1) return firstPagePayload
      if (requestedUrls.length === 2) return secondPagePayload

      throw new Error(`Unexpected Stellantis URL: ${url}`)
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2F16115603-6c1b-4c45-b544-238a4e6c51b3&limit=10&sortfield=open_date&sortorder=descending',
    'https://jobsapi-google.m-cloud.io/api/job/search?CompanyName=companies%2F16115603-6c1b-4c45-b544-238a4e6c51b3&limit=10&sortfield=open_date&sortorder=descending&pageToken=next-page-token',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'stellantis')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
  assert.equal(jobs[1].city, 'Chennai')
  assert.equal(
    jobs[1].applyUrl,
    'https://stellantis.wd3.myworkdayjobs.com/en-US/External/job/Chennai/Manufacturing-Systems-Engineer_23561385/apply',
  )
})
