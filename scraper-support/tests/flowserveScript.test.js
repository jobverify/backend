import assert from 'node:assert/strict'
import test from 'node:test'

const loadFlowserveModule = async () => {
  try {
    return await import('../../scraper/flowserve/script.js')
  } catch {
    return null
  }
}

const firstPage = {
  jobs: [
    {
      guid: '25A2857C96604620A16D443FD5D47D2A',
      reqid: 'R-012345',
      title_exact: 'Application Engineer',
      title_slug: 'application-engineer',
      location_exact: 'Coimbatore, Tamil Nadu, IND',
      country_exact: 'India',
      date_new: '2026-07-01T09:12:00Z',
      date_updated: '2026-07-01T09:12:00Z',
      description: 'Support pump and seal applications for India customers.',
      job_category: 'Engineering',
      job_shift: 'Full-time',
      job_type: 'Experienced',
      on_sites: [0],
    },
    {
      guid: '3F851955054C4F2BAA85A1E33D22A6C5',
      reqid: 'R-067890',
      title_exact: 'Order Engineering Associate',
      title_slug: 'order-engineering-associate',
      location_exact: 'Bengaluru, Karnataka, IND',
      country_exact: 'India',
      date_new: '2026-07-01T08:00:00Z',
      description: 'Coordinate order engineering deliverables.',
      job_category: 'Engineering',
      job_shift: 'Full-time',
      job_type: 'Early Career',
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

const secondPage = {
  jobs: [
    {
      guid: 'EC01CFE59B534882A78D99A6B44B957F',
      reqid: 'R-111213',
      title_exact: 'Procurement Analyst',
      title_slug: 'procurement-analyst',
      location_exact: 'Chennai, Tamil Nadu, IND',
      country_exact: 'India',
      date_updated: '2026-06-28T12:00:00Z',
      description: 'Drive sourcing and supplier coordination.',
      job_category: 'Supply Chain',
      job_shift: 'Full-time',
      job_type: 'Experienced',
      on_sites: [0],
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

test('mapFlowserveJob converts public Jobsyn records into shared scraper fields', async () => {
  const flowserve = await loadFlowserveModule()
  assert.ok(flowserve)

  const mapped = flowserve.mapFlowserveJob(firstPage.jobs[0])

  assert.deepEqual(mapped, {
    title: 'Application Engineer',
    company: 'Flowserve',
    department: 'Engineering',
    location: 'Coimbatore, Tamil Nadu, IND',
    city: 'Coimbatore',
    country: 'India',
    jobId: '25A2857C96604620A16D443FD5D47D2A',
    requisitionId: 'R-012345',
    sourceUrl: 'https://careers.flowserve.com/coimbatore-tamil-nadu-ind/application-engineer/25A2857C96604620A16D443FD5D47D2A/job/',
    applyUrl: 'https://careers.flowserve.com/coimbatore-tamil-nadu-ind/application-engineer/25A2857C96604620A16D443FD5D47D2A/job/',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T09:12:00Z',
    closingDate: null,
    jobDescription: 'Support pump and seal applications for India customers.',
    remoteStatus: 'On-site',
  })
})

test('Flowserve scraper paginates the public India Jobsyn feed with the required origin header', async () => {
  const flowserve = await loadFlowserveModule()
  assert.ok(flowserve)

  const requestedUrls = []
  const scraper = flowserve.createFlowserveScraper()

  const jobs = await scraper.run({
    fetchJson: async (url, options = {}) => {
      requestedUrls.push({
        url,
        headers: options.headers,
      })

      if (url.includes('page=1')) return firstPage
      if (url.includes('page=2')) return secondPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls.map((request) => request.url),
    [
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=1&location=ind&num_items=15',
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=2&location=ind&num_items=15',
    ],
  )
  assert.equal(requestedUrls[0].headers['X-Origin'], 'careers.flowserve.com')
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'flowserve')
  assert.equal(
    jobs[0].link,
    'https://careers.flowserve.com/coimbatore-tamil-nadu-ind/application-engineer/25A2857C96604620A16D443FD5D47D2A/job/',
  )
  assert.equal(jobs[1].requisitionId, 'R-067890')
  assert.equal(jobs[2].city, 'Chennai')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
