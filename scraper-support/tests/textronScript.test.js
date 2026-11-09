import assert from 'node:assert/strict'
import test from 'node:test'

const loadTextronModule = async () => {
  try {
    return await import('../../scraper/textron/script.js')
  } catch {
    assert.fail('Expected Textron scraper module at ../../scraper/textron/script.js')
  }
}

const indiaDescription = `
**Engineer I**

**Description**

Support India engineering programs.

**Recruiting Company:**  Textron India PVT Limited  
**Primary Location:**  India-Bangalore  
**Job Function:**  Engineering  
**Schedule:**  Full-time  
**Job Level:**  Individual Contributor  
**Job Type:**  Experienced  
**Shift:**  First Shift  
**Travel:**  Yes, 25 % of the Time  
**Job Posting:**  07/03/2026, 6:24:58 AM  
**Job Number:**  341857
`

const kautexDescription = `
**Sr Engineer CBU2**

**Description**

Lead customer-facing product development work for India programs.

**Recruiting Company:**  Kautex  
**Primary Location:**  India-Bangalore  
**Job Function:**  Engineering  
**Schedule:**  Full-time  
**Job Level:**  Individual Contributor  
**Job Type:**  Standard  
**Shift:**  First Shift  
**Travel:**  Yes, 25 % of the Time  
**Job Posting:**  07/03/2026, 6:24:53 AM  
**Job Number:**  341776
`

const SEARCH_PAGE_1 = {
  jobs: [
    {
      guid: '4826DF3EAF8D427A95EE9755B6A1A0A4',
      reqid: '341857',
      title_exact: 'Engineer I',
      title_slug: 'engineer-i',
      location_exact: 'Bangalore, IND',
      country_exact: 'India',
      city_exact: 'Bangalore',
      date_new: '2026-07-03T11:51:25Z',
      date_updated: '2026-07-03T11:51:25Z',
      description: indiaDescription,
      job_category: 'Engineering',
      job_shift: 'First Shift',
      on_sites: [0],
      other: '{"recruiting_company":"Textron India PVT Limited","travel":"Yes, 25 % of the Time"}',
    },
    {
      guid: 'USROLE1234567890',
      reqid: '441000',
      title_exact: 'Senior Systems Engineer',
      title_slug: 'senior-systems-engineer',
      location_exact: 'Fort Worth, TX',
      country_exact: 'United States',
      city_exact: 'Fort Worth',
      date_new: '2026-07-02T12:00:00Z',
      date_updated: '2026-07-02T12:00:00Z',
      description: '**Schedule:**  Full-time  \n**Job Type:**  Experienced',
      job_category: 'Engineering',
      job_shift: 'First Shift',
      on_sites: [0],
    },
  ],
  pagination: {
    page: 1,
    page_size: 2,
    total: 3,
    total_pages: 2,
    has_more_pages: true,
  },
}

const SEARCH_PAGE_2 = {
  jobs: [
    {
      guid: '53DB057A223845EB9A2A45828615EC73',
      reqid: '341776',
      title_exact: 'Sr Engineer CBU2',
      title_slug: 'sr-engineer-cbu2',
      location_exact: 'Bangalore, IND',
      country_exact: 'India',
      city_exact: 'Bangalore',
      date_new: '2026-07-03T11:51:23Z',
      date_updated: '2026-07-03T11:51:23Z',
      description: kautexDescription,
      job_category: 'Engineering',
      job_shift: 'First Shift',
      on_sites: [0],
      other: '{"recruiting_company":"Kautex","travel":"Yes, 25 % of the Time"}',
    },
  ],
  pagination: {
    page: 2,
    page_size: 1,
    total: 3,
    total_pages: 2,
    has_more_pages: false,
  },
}

test('Textron URL builders and mappers stay on the verified official Jobsyn and public-detail surfaces', async () => {
  const textron = await loadTextronModule()

  assert.equal(textron.CAREER_PAGE_URL, 'https://careers.textron.com/locations/ind/jobs/')
  assert.equal(textron.API_ENDPOINT, 'https://prod-search-api.jobsyn.org/api/v1/solr/search')
  assert.equal(textron.REQUEST_HEADERS['X-Origin'], 'careers.textron.com')
  assert.equal(
    textron.buildSearchUrl(),
    'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=1&location=ind&num_items=10&source=google_talent&x-origin=careers.textron.com&use_solr_filters=true',
  )
  assert.equal(
    textron.buildSearchUrl({ page: 2, pageSize: 20 }),
    'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=2&location=ind&num_items=20&source=google_talent&x-origin=careers.textron.com&use_solr_filters=true',
  )
  assert.equal(
    textron.buildJobUrl({
      location_exact: 'Bangalore, IND',
      title_slug: 'engineer-i',
      guid: '4826DF3EAF8D427A95EE9755B6A1A0A4',
    }),
    'https://careers.textron.com/bangalore-ind/engineer-i/4826DF3EAF8D427A95EE9755B6A1A0A4/job/',
  )
  assert.deepEqual(textron.extractDescriptionMetadata(indiaDescription), {
    'Recruiting Company': 'Textron India PVT Limited',
    'Primary Location': 'India-Bangalore',
    'Job Function': 'Engineering',
    Schedule: 'Full-time',
    'Job Level': 'Individual Contributor',
    'Job Type': 'Experienced',
    Shift: 'First Shift',
    Travel: 'Yes, 25 % of the Time',
    'Job Posting': '07/03/2026, 6:24:58 AM',
    'Job Number': '341857',
  })
  assert.deepEqual(textron.mapTextronJob(SEARCH_PAGE_1.jobs[0]), {
    title: 'Engineer I',
    company: 'Textron',
    department: 'Engineering',
    location: 'Bangalore, IND',
    city: 'Bangalore',
    country: 'India',
    jobId: '4826DF3EAF8D427A95EE9755B6A1A0A4',
    requisitionId: '341857',
    sourceUrl: 'https://careers.textron.com/bangalore-ind/engineer-i/4826DF3EAF8D427A95EE9755B6A1A0A4/job/',
    applyUrl: 'https://careers.textron.com/bangalore-ind/engineer-i/4826DF3EAF8D427A95EE9755B6A1A0A4/job/',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-03T11:51:25Z',
    closingDate: null,
    jobDescription: indiaDescription,
    remoteStatus: 'On-site',
  })
  assert.equal(textron.mapTextronJob(SEARCH_PAGE_1.jobs[1]), null)
})

test('Textron scraper paginates the verified India Jobsyn feed, filters non-India leakage, and decorates runner fields', async () => {
  const textron = await loadTextronModule()
  const requests = []
  const scraper = textron.createTextronScraper()

  const jobs = await scraper.run({
    fetchJson: async (url, options = {}) => {
      requests.push({
        url,
        headers: options.headers,
      })

      if (url === textron.buildSearchUrl({ page: 1 })) return SEARCH_PAGE_1
      if (url === textron.buildSearchUrl({ page: 2 })) return SEARCH_PAGE_2
      throw new Error(`Unexpected Textron URL: ${url}`)
    },
  })

  assert.deepEqual(
    requests.map((request) => request.url),
    [
      textron.buildSearchUrl({ page: 1 }),
      textron.buildSearchUrl({ page: 2 }),
    ],
  )
  assert.deepEqual(
    requests.map((request) => request.headers?.['X-Origin'] ?? null),
    ['careers.textron.com', 'careers.textron.com'],
  )

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'textron')
  assert.equal(
    jobs[0].link,
    'https://careers.textron.com/bangalore-ind/engineer-i/4826DF3EAF8D427A95EE9755B6A1A0A4/job/',
  )
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, 'Experienced')
  assert.equal(jobs[1].requisitionId, '341776')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].experienceRequired, 'Standard')
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
