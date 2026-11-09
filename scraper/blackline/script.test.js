import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  COMPANY,
  SOURCE,
  WORKDAY_JOBS_API_URL,
  WORKDAY_SEARCH_URL,
  createBlackLineScraper,
  extractIndiaLocationFacetIds,
  extractWorkdayJobs,
} from './script.js'

const INDIA_LOCATION_ID = '9574f3b33005100115a9633a90c20000'

const locationsPayload = (values, total = 116) => ({
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

const validBlackLinePosting = {
  title: 'Senior Software Engineer',
  externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
  locationsText: 'Bengaluru',
  bulletFields: ['000117'],
}

test('uses BlackLine official careers redirect and public Workday jobs API', () => {
  assert.equal(SOURCE, 'blackline')
  assert.equal(COMPANY, 'BlackLine')
  assert.equal(CAREERS_PAGE_URL, 'https://careers.blackline.com/careers-home/')
  assert.equal(WORKDAY_SEARCH_URL, 'https://blackline.wd108.myworkdayjobs.com/BlackLineCareers')
  assert.equal(
    WORKDAY_JOBS_API_URL,
    'https://blackline.wd108.myworkdayjobs.com/wday/cxs/blackline/BlackLineCareers/jobs',
  )
})

test('discovers only India location ids from the Workday locations facet', () => {
  const payload = locationsPayload([
    { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 20 },
    { descriptor: 'Coimbatore', id: 'coimbatore-location', count: 1 },
    { descriptor: 'Delhi, NY', id: 'ambiguous-us-location', count: 1 },
    { descriptor: 'Pleasanton', id: 'us-location', count: 29 },
  ])

  assert.deepEqual(extractIndiaLocationFacetIds(payload), [
    INDIA_LOCATION_ID,
    'coimbatore-location',
  ])
})

test('maps only India postings to canonical BlackLine jobs', () => {
  const jobs = extractWorkdayJobs({
    jobPostings: [
      {
        title: 'Senior Software Engineer',
        externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
        locationsText: 'Bengaluru',
        bulletFields: ['000117'],
      },
      {
        title: 'Senior Cloud Engineer',
        externalPath: '/job/Pleasanton/Senior-Cloud-Engineer_001371',
        locationsText: 'Pleasanton',
        bulletFields: ['001371'],
      },
      {
        title: 'Engineer in New York',
        externalPath: '/job/Delhi-NY/Engineer_001999',
        locationsText: 'Delhi, NY',
        bulletFields: ['001999'],
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
    postingDate: job.postingDate,
    scrapedAt: job.scrapedAt,
  })), [
    {
      title: 'Senior Software Engineer',
      jobId: '000117',
      company: 'BlackLine',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      link: 'https://blackline.wd108.myworkdayjobs.com/BlackLineCareers/job/Bengaluru/Senior-Software-Engineer_000117',
      source: 'blackline',
      remoteStatus: null,
      postingDate: null,
      scrapedAt: '2026-07-23T00:00:00.000Z',
    },
  ])
  assert.equal(Object.hasOwn(jobs[0], 'postedAt'), false)
})

test('discovers the India facet then paginates every BlackLine result page', async () => {
  const requests = []
  const scraper = createBlackLineScraper({
    now: () => '2026-07-23T00:00:00.000Z',
    pageSize: 2,
  })

  const jobs = await scraper.run({
    fetchPage: async () => { throw new Error('Controlled optional detail unavailable in pagination fixture') },
    fetchJobsPage: async (request) => {
      requests.push(request)

      if (Object.keys(request.appliedFacets).length === 0) {
        return locationsPayload([
          { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 3 },
          { descriptor: 'Los Angeles', id: 'us-location', count: 10 },
        ])
      }

      if (request.offset === 0) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Senior Software Engineer',
              externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
              locationsText: 'Bengaluru',
              bulletFields: ['000117'],
            },
            {
              title: 'Staff II Software Engineer',
              externalPath: '/job/Bengaluru/Staff-II-Software-Engineer_000963',
              locationsText: 'Bengaluru',
              bulletFields: ['000963'],
            },
          ],
        }
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Senior Software Engineer',
            externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
            locationsText: 'Bengaluru',
            bulletFields: ['000117'],
          },
          {
            title: 'AI Engineer',
            externalPath: '/job/Bengaluru/AI-Engineer_001447-1',
            locationsText: 'Bengaluru',
            bulletFields: ['001447'],
          },
        ],
      }
    },
  })

  assert.deepEqual(jobs.map((job) => job.jobId), ['001447', '000117', '000963'])
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
  const jobs = await createBlackLineScraper().run({
    fetchJobsPage: async () => {
      calls += 1
      return locationsPayload([
        { descriptor: 'Pleasanton', id: 'us-location', count: 2 },
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
    () => createBlackLineScraper({ maxPages: 0 }),
    /maxPages must be a positive integer/i,
  )
  assert.throws(
    () => createBlackLineScraper({ maxPages: 1.5 }),
    /maxPages must be a positive integer/i,
  )
})

test('throws when maxPages is exhausted while Workday reports more results', async () => {
  let calls = 0
  const scraper = createBlackLineScraper({ pageSize: 2, maxPages: 1 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 3 },
        ])
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Senior Software Engineer',
            externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
            locationsText: 'Bengaluru',
            bulletFields: ['000117'],
          },
          {
            title: 'AI Engineer',
            externalPath: '/job/Bengaluru/AI-Engineer_001447-1',
            locationsText: 'Bengaluru',
            bulletFields: ['001447'],
          },
        ],
      }
    },
  }), /maxPages exhausted.*more results/i)
})

test('rejects a repeated Workday page instead of silently deduplicating forever', async () => {
  let calls = 0
  const repeatedPosting = {
    title: 'Senior Software Engineer',
    externalPath: '/job/Bengaluru/Senior-Software-Engineer_000117',
    locationsText: 'Bengaluru',
    bulletFields: ['000117'],
  }
  const scraper = createBlackLineScraper({ pageSize: 1, maxPages: 3 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 3 },
        ])
      }

      return { total: 3, jobPostings: [repeatedPosting] }
    },
  }), /repeated Workday page/i)
})

test('rejects an empty page when Workday total says pagination must continue', async () => {
  let calls = 0
  const scraper = createBlackLineScraper({ pageSize: 2, maxPages: 3 })

  await assert.rejects(scraper.run({
    fetchJobsPage: async () => {
      calls += 1
      if (calls === 1) {
        return locationsPayload([
          { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 2 },
        ])
      }

      return { total: 2, jobPostings: [] }
    },
  }), /declared total|pagination progress/i)
})

test('rejects invalid, changing, or prematurely truncated Workday totals', async () => {
  const facet = locationsPayload([
    { descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 4 },
  ])
  const posting = (id) => ({
    title: `Role ${id}`,
    externalPath: `/job/Bengaluru/Role_${id}`,
    locationsText: 'Bengaluru',
    bulletFields: [id],
  })

  await assert.rejects(createBlackLineScraper().run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facet
      : { total: 'not-a-number', jobPostings: [posting('1')] },
  }), /invalid total/i)

  let page = 0
  await assert.rejects(createBlackLineScraper({ pageSize: 2 }).run({
    fetchJobsPage: async (request) => {
      if (Object.keys(request.appliedFacets).length === 0) return facet
      page += 1
      return page === 1
        ? { total: 4, jobPostings: [posting('1'), posting('2')] }
        : { total: 3, jobPostings: [posting('3')] }
    },
  }), /total changed/i)

  await assert.rejects(createBlackLineScraper({ pageSize: 2 }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? facet
      : { total: 4, jobPostings: [posting('1')] },
  }), /short page|declared total/i)
})

for (const { label, posting, errorPattern } of [
  {
    label: 'title',
    posting: { ...validBlackLinePosting, title: ' ', locationsText: 'Pleasanton' },
    errorPattern: /posting title/i,
  },
  {
    label: 'stable job id',
    posting: {
      ...validBlackLinePosting,
      externalPath: '/job/Bengaluru/Senior-Software-Engineer',
      bulletFields: [],
    },
    errorPattern: /stable job id/i,
  },
  {
    label: '/job/ externalPath',
    posting: {
      ...validBlackLinePosting,
      externalPath: '/jobs/Bengaluru/Senior-Software-Engineer_000117',
    },
    errorPattern: /externalPath.*\/job\//i,
  },
  {
    label: 'location',
    posting: { ...validBlackLinePosting, locationsText: ' ' },
    errorPattern: /posting location/i,
  },
]) {
  test(`rejects a filtered BlackLine Workday row without ${label}`, () => {
    assert.throws(
      () => extractWorkdayJobs({ jobPostings: [posting] }),
      errorPattern,
    )
  })
}

test('rejects contradictory URL identities and grouped foreign locations', async () => {
  assert.throws(
    () => extractWorkdayJobs({ jobPostings: [{
      ...validBlackLinePosting,
      externalPath: '/job/Bengaluru/Role_PATH',
      bulletFields: ['BULLET'],
    }] }),
    /identity|contradicts/i,
  )

  await assert.rejects(createBlackLineScraper({ pageSize: 1 }).run({
    fetchJobsPage: async (request) => Object.keys(request.appliedFacets).length === 0
      ? locationsPayload([{ descriptor: 'Bengaluru', id: INDIA_LOCATION_ID, count: 1 }])
      : { total: 1, jobPostings: [{
          title: 'Paris Engineer', externalPath: '/job/Paris/Engineer_1',
          locationsText: '2 locations', bulletFields: ['1'],
        }] },
  }), /foreign|ambiguous|location/i)
})
