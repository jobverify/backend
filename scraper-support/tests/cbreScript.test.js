import assert from 'node:assert/strict'
import test from 'node:test'

const loadCbreModule = async () => {
  try {
    return await import('../../scraper/cbre/script.js')
  } catch {
    return null
  }
}

const searchResponsePage1 = {
  jobs: [
    {
      guid: 'CBREIND0001',
      reqid: 'IN-1001',
      title_exact: 'Facilities Engineer',
      title_slug: 'facilities-engineer',
      location_exact: 'Bengaluru, IND',
      country_exact: 'India',
      date_new: '2026-07-01T07:30:00Z',
      date_updated: '2026-07-01T07:30:00Z',
      description: 'Maintain workplace systems for CBRE clients in India.',
      job_category: 'Engineering/Maintenance',
      job_shift: 'Full-time',
      job_type: 'Experienced',
      on_sites: [0],
    },
    {
      guid: 'CBREUSA0002',
      reqid: 'US-2002',
      title_exact: 'Property Accountant',
      title_slug: 'property-accountant',
      location_exact: 'Dallas, TX',
      country_exact: 'United States',
      date_new: '2026-07-01T08:00:00Z',
      date_updated: '2026-07-01T08:00:00Z',
      description: 'This row should be ignored by the India scraper.',
      job_category: 'Finance',
      job_shift: 'Full-time',
      job_type: 'Experienced',
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

const searchResponsePage2 = {
  jobs: [
    {
      guid: 'CBREIND0003',
      reqid: 'IN-1003',
      title_exact: 'Workplace Experience Coordinator',
      title_slug: 'workplace-experience-coordinator',
      location_exact: 'Mumbai, IND',
      country_exact: 'India',
      date_new: '2026-07-02T09:15:00Z',
      date_updated: '2026-07-02T09:15:00Z',
      description: 'Coordinate onsite workplace experience programs.',
      job_category: 'Workplace Experience',
      job_shift: 'Full-time',
      job_type: 'Experienced',
      on_sites: [0],
    },
  ],
  pagination: {
    page: 2,
    page_size: 2,
    total: 3,
    total_pages: 2,
    has_more_pages: false,
  },
}

test('mapCbreJob converts Jobsyn India results into shared scraper fields', async () => {
  const cbre = await loadCbreModule()
  assert.ok(cbre)

  const mapped = cbre.mapCbreJob(searchResponsePage1.jobs[0])

  assert.deepEqual(mapped, {
    title: 'Facilities Engineer',
    company: 'CBRE',
    department: 'Engineering/Maintenance',
    location: 'Bengaluru, IND',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'CBREIND0001',
    requisitionId: 'IN-1001',
    sourceUrl: 'https://cbre.dejobs.org/bengaluru-ind/facilities-engineer/CBREIND0001/job/',
    applyUrl: 'https://cbre.dejobs.org/bengaluru-ind/facilities-engineer/CBREIND0001/job/',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T07:30:00Z',
    closingDate: null,
    jobDescription: 'Maintain workplace systems for CBRE clients in India.',
    remoteStatus: 'On-site',
  })
})

test('run paginates across the CBRE India Jobsyn feed and skips non-India rows', async () => {
  const cbre = await loadCbreModule()
  assert.ok(cbre)

  const requestedUrls = []
  const scraper = cbre.createCbreScraper()

  const jobs = await scraper.run({
    fetchJson: async (url, options = {}) => {
      requestedUrls.push({
        url,
        headers: options.headers,
      })

      if (url.includes('page=1')) return searchResponsePage1
      if (url.includes('page=2')) return searchResponsePage2
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls.map((request) => request.url),
    [
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=1&location=ind&num_items=10',
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=2&location=ind&num_items=10',
    ],
  )
  assert.equal(requestedUrls[0].headers['X-Origin'], 'cbre.dejobs.org')
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cbre')
  assert.equal(jobs[0].link, 'https://cbre.dejobs.org/bengaluru-ind/facilities-engineer/CBREIND0001/job/')
  assert.equal(jobs[1].requisitionId, 'IN-1003')
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
