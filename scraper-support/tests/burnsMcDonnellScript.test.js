import assert from 'node:assert/strict'
import test from 'node:test'

const loadBurnsModule = async () => {
  try {
    return await import('../../scraper/burnsmcdonnell/script.js')
  } catch {
    return null
  }
}

const searchResponsePage1 = {
  jobs: [
    {
      guid: '0010E69A037C405785F92A99FD4560E7',
      reqid: '263068',
      title_exact: 'Project Controls Engineer - ENS (Contract)',
      title_slug: 'project-controls-engineer-ens-contract',
      location_exact: 'Mumbai, IND',
      country_exact: 'India',
      date_new: '2026-06-30T12:33:06Z',
      date_updated: '2026-06-30T12:33:06Z',
      description: '**Description** Lead project controls delivery for engineering programs.',
      job_category: 'Engineering',
      job_shift: 'Full-time',
      job_type: 'Contingent Worker (CWK)',
      on_sites: [0],
    },
    {
      guid: '5AC64A0CD10A40B1BB0E42123DCCD541',
      reqid: '263067',
      title_exact: 'Protection & Control Engineer - MBI',
      title_slug: 'protection-control-engineer-mbi',
      location_exact: 'Mumbai, IND',
      country_exact: 'India',
      date_new: '2026-06-30T11:33:06Z',
      date_updated: '2026-06-30T11:33:06Z',
      description: '**Description** Design protection and control systems.',
      job_category: 'Engineering',
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
      guid: 'FFEF733459084977AF0717FDAADAC04D',
      reqid: '262410',
      title_exact: 'Senior Civil Engineer - A&F',
      title_slug: 'senior-civil-engineer-af',
      location_exact: 'Bengaluru, IND',
      country_exact: 'India',
      date_new: '2026-06-16T12:33:12Z',
      date_updated: '2026-06-16T12:33:12Z',
      description: '**Description** Lead multidisciplinary civil engineering delivery.',
      job_category: 'Engineering',
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

test('mapBurnsJob converts Jobsyn India results into shared scraper fields', async () => {
  const burns = await loadBurnsModule()
  assert.ok(burns)

  const mapped = burns.mapBurnsJob(searchResponsePage1.jobs[0])

  assert.deepEqual(mapped, {
    title: 'Project Controls Engineer - ENS (Contract)',
    company: 'Burns & McDonnell',
    department: 'Engineering',
    location: 'Mumbai, IND',
    city: 'Mumbai',
    country: 'India',
    jobId: '0010E69A037C405785F92A99FD4560E7',
    requisitionId: '263068',
    sourceUrl: 'https://burnsmcd.jobs/mumbai-ind/project-controls-engineer-ens-contract/0010E69A037C405785F92A99FD4560E7/job/',
    applyUrl: 'https://burnsmcd.jobs/mumbai-ind/project-controls-engineer-ens-contract/0010E69A037C405785F92A99FD4560E7/job/',
    employmentType: 'Full-time',
    experienceRequired: 'Contingent Worker (CWK)',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30T12:33:06Z',
    closingDate: null,
    jobDescription: '**Description** Lead project controls delivery for engineering programs.',
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
  })
})

test('run paginates across the Burns & McDonnell India Jobsyn feed', async () => {
  const burns = await loadBurnsModule()
  assert.ok(burns)

  const requestedUrls = []
  const scraper = burns.createBurnsMcDonnellScraper()

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
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=1&location=ind&num_items=15',
      'https://prod-search-api.jobsyn.org/api/v1/solr/search?page=2&location=ind&num_items=15',
    ],
  )
  assert.equal(requestedUrls[0].headers['X-Origin'], 'burnsmcd.jobs')
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'burnsmcdonnell')
  assert.equal(jobs[0].link, 'https://burnsmcd.jobs/mumbai-ind/project-controls-engineer-ens-contract/0010E69A037C405785F92A99FD4560E7/job/')
  assert.equal(jobs[1].requisitionId, '263067')
  assert.equal(jobs[2].city, 'Bengaluru')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].publicExperienceChecked, true)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
