import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  buildJobsApiUrl,
  buildJobDetailUrl,
  createKalviumScraper,
  extractCompanyContext,
  hasCareersSurfaceSignal,
} from './script.js'

const companyContext = {
  companyName: 'Kalvium',
  companySlug: 'kalvium',
  companyUuid: 'DBE8CE5737',
}

const careersShellHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <body>
      <h4>Careers at Kalvium</h4>
      <div>Loading jobs...</div>
      <div>Hiring Powered By</div>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        companyDetails: {
          name: companyContext.companyName,
          slug: companyContext.companySlug,
          uuid: companyContext.companyUuid,
          allow_resume_drop_when_no_jobs: false,
        },
      },
    },
    query: {
      company: companyContext.companyName,
      company_uuid: companyContext.companyUuid,
    },
  })}</script>
    </body>
  </html>
`

const currentCareersShellHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Kalvium</title>
    </head>
    <body>
      <p>Kalvium is an ed-tech company that provides India's Best Undergraduate Computer Science Program.</p>
      <div>Loading jobs...</div>
      <div>Hiring Powered By</div>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        companyDetails: {
          name: companyContext.companyName,
          slug: companyContext.companySlug,
          uuid: companyContext.companyUuid,
          allow_resume_drop_when_no_jobs: false,
        },
      },
    },
    query: {
      company: companyContext.companyName,
      company_uuid: companyContext.companyUuid,
    },
  })}</script>
    </body>
  </html>
`

const jobsApiPayload = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 291495,
      slug: 'academic-relationship-management-intern-prospectingcounselling-internshipppo-5',
      title: 'Academic Relationship Management Intern-Prospecting/Counselling (Internship+PPO)',
      max_experience: 1,
      min_experience: 0,
      country: 'India',
      location: 'Chennai, Tamil Nadu, India',
      other_locations: [],
      department_name: 'Business Development',
      published_internally: false,
      workplace_type: 'ON_SITE',
      product: null,
    },
  ],
}

const detailPageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        companyDetails: {
          name: companyContext.companyName,
          slug: companyContext.companySlug,
          uuid: companyContext.companyUuid,
        },
        jobDetails: {
          id: 291495,
          title: 'Academic Relationship Management Intern-Prospecting/Counselling (Internship+PPO)',
          job_type: 'FULLTIME',
          description: '<p><strong>About the role</strong><br/>Help students through admissions.</p>',
          max_salary: 500000,
          min_salary: 400000,
          max_experience: 1,
          min_experience: 0,
          skill: ['prospecting', 'counselling', 'admissions'],
          education: ["Bachelor's Degree"],
          seniority: ['entry-level'],
          country: 'India',
          location: 'Chennai, Tamil Nadu, India',
          other_locations: [],
          department_name: 'Business Development',
          remote: false,
          created_at: '2025-11-24T17:11:30.216703+05:30',
          salary_type: 'ANNUAL',
          is_salary_visible: true,
          published_internally: false,
          workplace_type: 'ON_SITE',
          currency: 'INR',
          valid_through: '2026-01-23T17:11:30.216703+05:30',
        },
      },
    },
    query: {
      company: companyContext.companySlug,
      jobId: 'academic-relationship-management-intern-prospectingcounselling-internshipppo-5',
    },
  })}</script>
    </body>
  </html>
`

test('extracts the Kalvium PyjamaHR company context from the public careers shell', () => {
  assert.equal(CAREERS_PAGE_URL, 'https://app.pyjamahr.com/careers?company=Kalvium&company_uuid=DBE8CE5737')
  assert.equal(hasCareersSurfaceSignal(careersShellHtml), true)
  assert.deepEqual(extractCompanyContext(careersShellHtml), companyContext)
  assert.equal(
    buildJobsApiUrl(companyContext.companyUuid, 1),
    'https://api.pyjamahr.com/api/career/jobs/?company_uuid=DBE8CE5737&page=1&is_careers_page=false',
  )
})

test('accepts the current Kalvium PyjamaHR shell with the simplified title', () => {
  assert.equal(hasCareersSurfaceSignal(currentCareersShellHtml), true)
  assert.deepEqual(extractCompanyContext(currentCareersShellHtml), companyContext)
})

test('run uses the public PyjamaHR API and detail page to normalize Kalvium jobs', async () => {
  const detailUrl = buildJobDetailUrl(
    companyContext.companySlug,
    jobsApiPayload.results[0].slug,
  )

  const jobs = await createKalviumScraper().run({
    fetchText: async (url) => {
      if (url === CAREERS_PAGE_URL) return careersShellHtml
      if (url === detailUrl) return detailPageHtml
      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(
        url,
        'https://api.pyjamahr.com/api/career/jobs/?company_uuid=DBE8CE5737&page=1&is_careers_page=false',
      )
      return jobsApiPayload
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Academic Relationship Management Intern-Prospecting/Counselling (Internship+PPO)',
      company: 'Kalvium',
      department: 'Business Development',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: '291495',
      requisitionId: '291495',
      sourceUrl: detailUrl,
      applyUrl: 'https://app.pyjamahr.com/careers?company=Kalvium&job_id=291495&company_uuid=DBE8CE5737&source=DIRECT&apply_now=true',
      employmentType: 'Internship',
      experienceRequired: '0 - 1 years',
      minimumQualification: "Bachelor's Degree",
      preferredQualification: null,
      requiredSkills: ['prospecting', 'counselling', 'admissions'],
      postingDate: '2025-11-24T17:11:30.216703+05:30',
      closingDate: '2026-01-23T17:11:30.216703+05:30',
      jobDescription: 'About the role Help students through admissions.',
      attachmentUrl: null,
      source: 'kalvium',
      link: 'https://app.pyjamahr.com/careers?company=Kalvium&job_id=291495&company_uuid=DBE8CE5737&source=DIRECT&apply_now=true',
      scrapedAt: '2026-07-10T00:00:00.000Z',
    },
  ])
})
