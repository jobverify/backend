import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const listingsPageOne = {
  jobs: [
    {
      id: 8502781,
      job_requisition_id: 'R-158414',
      job_posting_title: 'Finance Systems Delivery Lead',
      job_description: '<h2>Overview</h2><p>Deliver finance systems change across Oracle platforms.</p>',
      person_requirements: '<h2>About you</h2><p>Proven Oracle delivery experience.</p>',
      time_type: 'Full time',
      external_posting_url: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/GBUnited-Kingdom/Finance-Systems-Delivery-Lead_R-158414',
      cities: 'Bangalore',
      locations: [
        { city: 'UK', region: '', country: 'United Kingdom' },
        { city: 'Bangalore', region: 'Karnataka', country: 'India' },
      ],
      job_area: 'Digital',
      is_remote: false,
      created_at: '2026-06-26T19:02:18.313Z',
      updated_at: '2026-06-29T19:02:20.547Z',
    },
    {
      id: 8506209,
      job_requisition_id: 'R-158821',
      job_posting_title: 'Security Engineer - Cloud and Infrastructure',
      job_description: '<h2>Overview</h2><p>Protect cloud and infrastructure platforms.</p>',
      person_requirements: '<h2>About you</h2><p>Experience in cloud security engineering.</p>',
      time_type: 'Full time',
      external_posting_url: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/INIndia/Cloud-Security-Engineer_R-158821',
      cities: 'Chennai',
      locations: [
        { city: 'Chennai', region: 'Tamil Nadu', country: 'India' },
      ],
      job_area: 'Digital',
      is_remote: true,
      created_at: '2026-06-27T10:15:00.000Z',
      updated_at: '2026-06-29T09:00:00.000Z',
    },
  ],
  facets: {
    sector: [],
    jobArea: [],
    jobType: [],
    location: [],
  },
  meta: {
    totalCount: 2,
    perPage: 100,
    totalPages: 1,
    currentPage: 1,
  },
}

test('AtkinsRealis api portal scraper fetches a bearer token once and maps India jobs from the ConnectID API', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'atkinsrealis')
  assert.ok(provider)

  const scraper = buildScrapers().find((item) => item.name === 'atkinsrealis')
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

    if (url === 'https://atkinsats-prod-api.connectid.cloud/api/jobs/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ token: 'token-123' }),
      }
    }

    if (url === 'https://atkinsats-prod-api.connectid.cloud/api/jobs/jobs' && options.method === 'POST') {
      assert.equal(options.headers.Authorization, 'Bearer token-123')
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), {
        limit: 100,
        page: 1,
        language: 'en',
        country: 'India',
        is_early_careers: false,
      })

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
      title: 'Finance Systems Delivery Lead',
      company: 'AtkinsRéalis',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/GBUnited-Kingdom/Finance-Systems-Delivery-Lead_R-158414',
      applyUrl: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/GBUnited-Kingdom/Finance-Systems-Delivery-Lead_R-158414',
      sourceUrl: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/GBUnited-Kingdom/Finance-Systems-Delivery-Lead_R-158414',
      source: 'atkinsrealis',
      jobId: 8502781,
      requisitionId: 'R-158414',
      department: 'Digital',
      employmentType: 'Full-time',
      experienceRequired: null,
      postingDate: '2026-06-26T19:02:18.313Z',
      jobDescription: jobs[0].jobDescription,
      minimumQualification: jobs[0].minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'On-site',
      scrapedAt: jobs[0].scrapedAt,
      companyCareerPage: provider.companyCareerPage,
      companyDomain: provider.companyDomain,
      atsPlatform: provider.atsPlatform,
    })
    assert.match(jobs[0].jobDescription, /finance systems change/i)
    assert.match(jobs[0].minimumQualification, /oracle delivery experience/i)
    assert.equal(jobs[1].city, 'Chennai')
    assert.equal(jobs[1].remoteStatus, 'Remote')
    assert.equal(jobs[1].employmentType, 'Full-time')
    assert.equal(jobs[1].requisitionId, 'R-158821')
    assert.equal(jobs[1].link, jobs[1].applyUrl)
    assert.equal(typeof jobs[1].scrapedAt, 'string')

    assert.deepEqual(fetchCalls.map((call) => call.url), [
      'https://atkinsats-prod-api.connectid.cloud/api/jobs/token',
      'https://atkinsats-prod-api.connectid.cloud/api/jobs/jobs',
    ])
  } finally {
    global.fetch = originalFetch
  }
})
