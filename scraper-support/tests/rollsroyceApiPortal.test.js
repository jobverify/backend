import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const listingsPageOne = {
  jobs: [
    {
      id: 1118242,
      jobRequisitionId: 'JR6146849',
      jobPostingId: 'JOB_POSTING-3-155159',
      jobTitle: 'Field Service Engineer',
      jobDescription:
        '<h2><b>Job Description</b></h2><p><b>Job Title:</b> Field Service Engineer-Electronics</p><p><b>Location:</b> Pune</p>',
      department: 'Field Services',
      employmentType: 'Full_time',
      employmentTypeDesc: 'Full time',
      jobTypeDesc: 'Permanent',
      applyUrl:
        'https://rollsroyce.wd3.myworkdayjobs.com/professional/job/Pune/Field-Service-Engineer_JR6146849/apply',
      postingDate: '2026-07-09T00:00:00.000Z',
      primaryCountry: 'India',
      primaryCity: 'Pune',
      seniority: 'professional',
      seniorityDesc: 'External - Mid Career and Exec',
    },
    {
      id: 1118193,
      jobRequisitionId: 'JR6156725',
      jobPostingId: 'JOB_POSTING-3-154994',
      jobTitle: 'Group Property - Capital Controller',
      jobDescription:
        '<h2><b>Job Description</b></h2><p><b>Full time</b></p><p><b>Location:</b> Bengaluru, India</p>',
      department: 'Project Management',
      employmentType: 'Full_time',
      employmentTypeDesc: 'Full time',
      jobTypeDesc: 'Permanent',
      applyUrl:
        'https://rollsroyce.wd3.myworkdayjobs.com/professional/job/Bangalore/Group-Property---Capital-Controller_JR6156725-1/apply',
      postingDate: '2026-07-07T00:00:00.000Z',
      primaryCountry: 'India',
      primaryCity: 'Bangalore',
      seniority: 'professional',
      seniorityDesc: 'External - Mid Career and Exec',
    },
  ],
  facetCounts: {
    primaryCity: [
      { value: 'Bangalore', count: 1 },
      { value: 'Pune', count: 1 },
    ],
  },
  meta: {
    totalCount: 2,
    totalPages: 1,
    pageNumber: 1,
    perPage: 10,
    nextPage: null,
    prevPage: null,
  },
}

test('Rolls Royce api portal scraper fetches a bearer token and maps India jobs from the official ConnectID API', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rollsroyce')
  assert.ok(provider)

  const scraper = buildScrapers().find((item) => item.name === 'rollsroyce')
  assert.ok(scraper)

  const fetchCalls = []
  const originalFetch = global.fetch

  global.fetch = async (url, options = {}) => {
    fetchCalls.push({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ?? null,
    })

    if (url === 'https://rollsroyceats-prod-api.connectid.cloud/auth/gettoken') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ token: 'token-123' }),
      }
    }

    if (
      url.startsWith('https://rollsroyceats-prod-api.connectid.cloud/api/jobs?')
      && options.method === 'POST'
    ) {
      const requestUrl = new URL(url)
      assert.equal(requestUrl.searchParams.get('page'), '1')
      assert.equal(requestUrl.searchParams.get('perPage'), '10')
      assert.equal(requestUrl.searchParams.get('primaryCountry'), 'India')
      assert.equal(options.headers.Authorization, 'Bearer token-123')
      assert.equal(options.body, undefined)

      return {
        ok: true,
        status: 200,
        json: async () => listingsPageOne,
      }
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const jobs = await scraper.run()

    assert.equal(jobs.length, 2)
    assert.deepEqual(jobs[0], {
      title: 'Field Service Engineer',
      company: 'Rolls Royce',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      link:
        'https://rollsroyce.wd3.myworkdayjobs.com/professional/job/Pune/Field-Service-Engineer_JR6146849/apply',
      applyUrl:
        'https://rollsroyce.wd3.myworkdayjobs.com/professional/job/Pune/Field-Service-Engineer_JR6146849/apply',
      sourceUrl:
        'https://rollsroyce.wd3.myworkdayjobs.com/professional/job/Pune/Field-Service-Engineer_JR6146849/apply',
      source: 'rollsroyce',
      jobId: 1118242,
      requisitionId: 'JR6146849',
      department: 'Field Services',
      employmentType: 'Full-time',
      experienceRequired: null,
      postingDate: '2026-07-09T00:00:00.000Z',
      jobDescription: jobs[0].jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'On-site',
      scrapedAt: jobs[0].scrapedAt,
      companyCareerPage: provider.companyCareerPage,
      companyDomain: provider.companyDomain,
      atsPlatform: provider.atsPlatform,
    })
    assert.match(jobs[0].jobDescription, /field service engineer-electronics/i)
    assert.equal(jobs[1].title, 'Group Property - Capital Controller')
    assert.equal(jobs[1].location, 'Bangalore, India')
    assert.equal(jobs[1].department, 'Project Management')
    assert.equal(jobs[1].employmentType, 'Full-time')
    assert.equal(typeof jobs[1].scrapedAt, 'string')

    assert.equal(fetchCalls[0].url, 'https://rollsroyceats-prod-api.connectid.cloud/auth/gettoken')
    assert.ok(fetchCalls[1].url.startsWith('https://rollsroyceats-prod-api.connectid.cloud/api/jobs?'))
  } finally {
    global.fetch = originalFetch
  }
})
