import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  COMPANY,
  SOURCE,
  WORKDAY_JOBS_API_URL,
  WORKDAY_SEARCH_URL,
  createManhattenScraper,
  extractIndiaLocationFacetIds,
  extractWorkdayJobs,
} from './script.js'

const INDIA_LOCATION_ID = 'ba9cd6cb4b2310c69665202f09dbe48e'

const locationsPayload = (values, total = 39) => ({
  total,
  jobPostings: [],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locations',
          descriptor: 'Locations',
          values,
        },
      ],
    },
  ],
})

const validManhattanPosting = {
  title: 'Senior/Finance Administrator',
  externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
  locationsText: 'Bangalore',
  bulletFields: ['16924'],
}

test('uses the verified Manhattan Associates official Workday surface', () => {
  assert.equal(SOURCE, 'manhatten')
  assert.equal(COMPANY, 'Manhattan Associates')
  assert.equal(CAREERS_PAGE_URL, 'https://www.manh.com/en-in/about-us/careers')
  assert.equal(WORKDAY_SEARCH_URL, 'https://manh.wd5.myworkdayjobs.com/en-US/External/jobs')
  assert.equal(
    WORKDAY_JOBS_API_URL,
    'https://manh.wd5.myworkdayjobs.com/wday/cxs/manh/External/jobs',
  )
})

test('discovers only India location ids from the Workday locations facet', () => {
  const payload = locationsPayload([
    { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 3 },
    { descriptor: 'Jaipur', id: 'jaipur-location', count: 1 },
    { descriptor: 'Delhi, NY', id: 'ambiguous-us-location', count: 1 },
    { descriptor: 'Atlanta, GA', id: 'us-location', count: 28 },
  ])

  assert.deepEqual(extractIndiaLocationFacetIds(payload), [
    INDIA_LOCATION_ID,
    'jaipur-location',
  ])
})

test('maps the live Senior/Finance Administrator opening and rejects non-India jobs', () => {
  const jobs = extractWorkdayJobs({
    jobPostings: [
      {
        title: 'Senior/Finance Administrator',
        externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
        locationsText: 'Bangalore',
        bulletFields: ['16924'],
      },
      {
        title: 'Staff Accountant',
        externalPath: '/job/Atlanta-GA/Staff-Accountant_16909',
        locationsText: 'Atlanta, GA',
        bulletFields: ['16909'],
      },
      {
        title: 'Engineer in New York',
        externalPath: '/job/Delhi-NY/Engineer_16999',
        locationsText: 'Delhi, NY',
        bulletFields: ['16999'],
      },
    ],
  }, { scrapedAt: '2026-07-23T00:00:00.000Z' })

  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    jobId: job.jobId,
    company: job.company,
    location: job.location,
    city: job.city,
    link: job.link,
    source: job.source,
    remoteStatus: job.remoteStatus,
    scrapedAt: job.scrapedAt,
  })), [
    {
      title: 'Senior/Finance Administrator',
      jobId: '16924',
      company: 'Manhattan Associates',
      location: 'Bangalore, India',
      city: 'Bangalore',
      link: 'https://manh.wd5.myworkdayjobs.com/en-US/External/job/Bangalore/Senior-Finance-Administrator_16924',
      source: 'manhatten',
      remoteStatus: null,
      scrapedAt: '2026-07-23T00:00:00.000Z',
    },
  ])
  assert.equal(jobs[0].postingDate, null)
  assert.equal('postedAt' in jobs[0], false)
})

test('discovers the India facet then paginates every Manhattan result page', async () => {
  const requests = []
  const scraper = createManhattenScraper({
    now: () => '2026-07-23T00:00:00.000Z',
    pageSize: 2,
  })

  const jobs = await scraper.run({
    fetchJobsPage: async (request) => {
      requests.push(request)

      if (Object.keys(request.appliedFacets).length === 0) {
        return locationsPayload([
          { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 3 },
          { descriptor: 'Paris', id: 'fr-location', count: 4 },
        ])
      }

      if (request.offset === 0) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Senior/Finance Administrator',
              externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
              locationsText: 'Bangalore',
              bulletFields: ['16924'],
            },
            {
              title: 'Senior Engineer - SharePoint Administration',
              externalPath: '/job/Bangalore/Senior-Lead-SharePoint-Administration_16848',
              locationsText: 'Bangalore',
              bulletFields: ['16848'],
            },
          ],
        }
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Senior/Finance Administrator',
            externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
            locationsText: 'Bangalore',
            bulletFields: ['16924'],
          },
          {
            title: 'Senior Engineer - AI',
            externalPath: '/job/Bangalore/Senior-Engineer---AI_16887',
            locationsText: 'Bangalore',
            bulletFields: ['16887'],
          },
        ],
      }
    },
  })

  assert.deepEqual(jobs.map((job) => job.jobId), ['16887', '16848', '16924'])
  assert.deepEqual(requests.map((request) => ({
    appliedFacets: request.appliedFacets,
    offset: request.offset,
    limit: request.limit,
    searchText: request.searchText,
  })), [
    { appliedFacets: {}, offset: 0, limit: 2, searchText: '' },
    { appliedFacets: { locations: [INDIA_LOCATION_ID] }, offset: 0, limit: 2, searchText: '' },
    { appliedFacets: { locations: [INDIA_LOCATION_ID] }, offset: 2, limit: 2, searchText: '' },
  ])
})

test('returns no jobs when the official feed has no India location facet', async () => {
  let calls = 0
  const jobs = await createManhattenScraper().run({
    fetchJobsPage: async () => {
      calls += 1
      return locationsPayload([
        { descriptor: 'Atlanta, GA', id: 'us-location', count: 2 },
      ], 2)
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(calls, 1)
})

test('rejects a Workday payload whose jobPostings field is not an array', () => {
  assert.throws(
    () => extractWorkdayJobs({ jobPostings: null }),
    /jobPostings must be an array/i,
  )
})

test('requires maxPages to be a positive integer', () => {
  assert.throws(
    () => createManhattenScraper({ maxPages: 0 }),
    /maxPages must be a positive integer/i,
  )
  assert.throws(
    () => createManhattenScraper({ maxPages: 1.5 }),
    /maxPages must be a positive integer/i,
  )
})

test('throws when maxPages is exhausted while Workday reports more results', async () => {
  let calls = 0
  const scraper = createManhattenScraper({ pageSize: 2, maxPages: 1 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 3 },
        ])
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Senior/Finance Administrator',
            externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
            locationsText: 'Bangalore',
            bulletFields: ['16924'],
          },
          {
            title: 'Senior Engineer - AI',
            externalPath: '/job/Bangalore/Senior-Engineer---AI_16887',
            locationsText: 'Bangalore',
            bulletFields: ['16887'],
          },
        ],
      }
    },
  }), /maxPages exhausted.*more results/i)
})

test('rejects a repeated Workday page instead of silently deduplicating forever', async () => {
  let calls = 0
  const repeatedPosting = {
    title: 'Senior/Finance Administrator',
    externalPath: '/job/Bangalore/Senior-Finance-Administrator_16924',
    locationsText: 'Bangalore',
    bulletFields: ['16924'],
  }
  const scraper = createManhattenScraper({ pageSize: 1, maxPages: 3 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 3 },
        ])
      }

      return { total: 3, jobPostings: [repeatedPosting] }
    },
  }), /repeated Workday page/i)
})

test('rejects an empty page when Workday total says pagination must continue', async () => {
  let calls = 0
  const scraper = createManhattenScraper({ pageSize: 2, maxPages: 3 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 2 },
        ])
      }

      return { total: 2, jobPostings: [] }
    },
  }), /declared total|pagination progress/i)
})

test('rejects invalid, changing, or prematurely truncated Workday totals', async () => {
  const facet = locationsPayload([
    { descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 4 },
  ])
  const posting = (id) => ({
    title: `Role ${id}`,
    externalPath: `/job/Bangalore/Role_${id}`,
    locationsText: 'Bangalore',
    bulletFields: [id],
  })

  await assert.rejects(createManhattenScraper().run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facet
      : { total: 'not-a-number', jobPostings: [posting('1')] },
  }), /invalid total/i)

  let page = 0
  await assert.rejects(createManhattenScraper({ pageSize: 2 }).run({
    fetchJobsPage: async (request) => {
      if (Object.keys(request.appliedFacets).length === 0) return facet
      page += 1
      return page === 1
        ? { total: 4, jobPostings: [posting('1'), posting('2')] }
        : { total: 3, jobPostings: [posting('3')] }
    },
  }), /total changed/i)

  await assert.rejects(createManhattenScraper({ pageSize: 2 }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facet
      : { total: 4, jobPostings: [posting('1')] },
  }), /short page|declared total/i)
})

for (const { label, posting, errorPattern } of [
  {
    label: 'title',
    posting: { ...validManhattanPosting, title: ' ', locationsText: 'Atlanta, GA' },
    errorPattern: /posting title/i,
  },
  {
    label: 'stable job id',
    posting: {
      ...validManhattanPosting,
      externalPath: '/job/Bangalore/Senior-Finance-Administrator',
      bulletFields: [],
    },
    errorPattern: /stable job id/i,
  },
  {
    label: '/job/ externalPath',
    posting: {
      ...validManhattanPosting,
      externalPath: '/jobs/Bangalore/Senior-Finance-Administrator_16924',
    },
    errorPattern: /externalPath.*\/job\//i,
  },
  {
    label: 'location',
    posting: { ...validManhattanPosting, locationsText: ' ' },
    errorPattern: /posting location/i,
  },
]) {
  test(`rejects a filtered Manhattan Workday row without ${label}`, () => {
    assert.throws(
      () => extractWorkdayJobs({ jobPostings: [posting] }),
      errorPattern,
    )
  })
}

test('rejects contradictory URL identities and grouped foreign locations', async () => {
  assert.throws(
    () => extractWorkdayJobs({ jobPostings: [{
      ...validManhattanPosting,
      externalPath: '/job/Bangalore/Role_PATH',
      bulletFields: ['BULLET'],
    }] }),
    /identity|contradicts/i,
  )

  await assert.rejects(createManhattenScraper({ pageSize: 1 }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? locationsPayload([{ descriptor: 'Bangalore', id: INDIA_LOCATION_ID, count: 1 }])
      : { total: 1, jobPostings: [{
          title: 'Paris Engineer', externalPath: '/job/Paris/Engineer_1',
          locationsText: '2 locations', bulletFields: ['1'],
        }] },
  }), /foreign|ambiguous|location/i)
})
