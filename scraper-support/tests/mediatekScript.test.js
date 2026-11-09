import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATS_PLATFORM,
  CAREERS_PAGE_URL,
  JOBS_PAGE_SIZE,
  buildDetailUrl,
  buildJobsApiUrl,
  createMediatekScraper,
  hasVerifiedCareersPageSignal,
  hasVerifiedJobsApiSignal,
  normalizeApiJob,
} from '../../scraper/mediatek/script.js'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Openings | MediaTek Careers</title>
  </head>
  <body>
    <main>
      <a href="/en/jobs">Openings</a>
      <input type="text" placeholder="Search by role or keyword..." />
      <div>Noida</div>
      <div>Bangalore</div>
    </main>
  </body>
</html>
`

const jobsApiPayload = [{
  result: {
    data: {
      json: {
        status: 'complete',
        message: null,
        jobs: [
          {
            id: 'MTB120240926001',
            title: 'Senior Staff Engineer - Power Integrity',
            summary: null,
            location: null,
            jobPostStatus: 'posted',
            description: 'Senior Staff Engineer - Power Integrity / IR drop analysis',
            publishedDate: '2026-07-28T16:00:00.000+00:00',
            applicationId: null,
            properties: {
              category: {
                label: 'Chip Design',
                code: '9009',
              },
              workExperience: {
                label: '0006',
                code: 'More than 8 Years Work Expe.',
              },
              location: {
                label: '0000168800',
                code: 'Bangalore\t',
              },
              program: {
                label: null,
                code: null,
              },
              jobEducationInfos: [
                {
                  educationDegree: "Master's Degree",
                  educationMajor: 'VLSI Design',
                },
              ],
            },
            jobStatusInfo: null,
          },
          {
            id: 'MTK120260105008',
            title: 'Engineer/Senior Engineer for AI/Machine Learning',
            summary: null,
            location: null,
            jobPostStatus: 'posted',
            description: 'AI and chip design role for HsinChu.',
            publishedDate: '2026-08-02T16:00:00.000+00:00',
            applicationId: null,
            properties: {
              category: {
                label: 'Software',
                code: '9020',
              },
              workExperience: {
                label: '0003',
                code: 'More than 2 Years Work Expe.',
              },
              location: {
                label: '0000009256',
                code: 'HsinChu',
              },
              program: {
                label: null,
                code: null,
              },
              jobEducationInfos: [
                {
                  educationDegree: "Master's Degree",
                  educationMajor: 'Any',
                },
              ],
            },
            jobStatusInfo: null,
          },
        ],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 2,
        },
      },
    },
  },
}]

test('MediaTek builds the verified first-party detail and jobs API URLs', () => {
  const detailUrl = buildDetailUrl('mtb120240926001')
  const apiUrl = new URL(buildJobsApiUrl({ page: 2, limit: 50 }))
  const input = JSON.parse(apiUrl.searchParams.get('input'))

  assert.equal(detailUrl, 'https://careers.mediatek.com/en/jobs/MTB120240926001')
  assert.equal(apiUrl.origin, 'https://careers.mediatek.com')
  assert.equal(apiUrl.pathname, '/api/trpc/job.getJobs')
  assert.equal(apiUrl.searchParams.get('batch'), '1')
  assert.equal(input[0].json.locales, 'en_US')
  assert.equal(input[0].json.page, 2)
  assert.equal(input[0].json.limit, 50)
  assert.equal(input[0].json.jobQueryInfo.relation, 'AND')
})

test('MediaTek validates the live openings shell and first-party jobs API envelope', () => {
  assert.equal(ATS_PLATFORM, 'nextjs-trpc-job-api')
  assert.equal(hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.equal(hasVerifiedJobsApiSignal(jobsApiPayload), true)
})

test('MediaTek normalizes only India jobs from the first-party jobs API payload', () => {
  const normalized = normalizeApiJob(jobsApiPayload[0].result.data.json.jobs[0])
  const nonIndia = normalizeApiJob(jobsApiPayload[0].result.data.json.jobs[1])

  assert.deepEqual(normalized, {
    title: 'Senior Staff Engineer - Power Integrity',
    company: 'MediaTek',
    department: 'Chip Design',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'MTB120240926001',
    requisitionId: 'MTB120240926001',
    sourceUrl: 'https://careers.mediatek.com/en/jobs/MTB120240926001',
    applyUrl: 'https://careers.mediatek.com/en/jobs/MTB120240926001',
    employmentType: null,
    experienceRequired: 'More than 8 Years Work Expe.',
    minimumQualification: "Master's Degree - VLSI Design",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-28T16:00:00.000+00:00',
    closingDate: null,
    jobDescription: [
      'Category: Chip Design',
      'Experience: More than 8 Years Work Expe.',
      "Education: Master's Degree - VLSI Design",
      'Senior Staff Engineer - Power Integrity / IR drop analysis',
    ].join('\n\n'),
  })
  assert.equal(nonIndia, null)
})

test('MediaTek scraper relies on the verified tRPC jobs API and returns only India jobs', async () => {
  const requestedJsons = []
  const scraper = createMediatekScraper({
    now: () => '2026-08-03T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async () => {
      throw new Error('fetchText should not be used during the live API path')
    },
    fetchJson: async (url) => {
      requestedJsons.push(url)
      return jobsApiPayload
    },
  })

  assert.deepEqual(requestedJsons, [buildJobsApiUrl({ page: 1, limit: JOBS_PAGE_SIZE })])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'mediatek')
  assert.equal(jobs[0].link, 'https://careers.mediatek.com/en/jobs/MTB120240926001')
  assert.equal(jobs[0].scrapedAt, '2026-08-03T00:00:00.000Z')
})

test('MediaTek can still enforce the verified openings shell when requested', async () => {
  const requestedTexts = []
  const scraper = createMediatekScraper({
    verifyCareersPage: true,
  })

  await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      return careersPageHtml
    },
    fetchJson: async () => jobsApiPayload,
  })

  assert.deepEqual(requestedTexts, [CAREERS_PAGE_URL])
})

test('MediaTek fails closed when the optional openings shell or required tRPC jobs payload drifts', async () => {
  const shellValidatedScraper = createMediatekScraper({
    verifyCareersPage: true,
  })
  const apiOnlyScraper = createMediatekScraper()

  await assert.rejects(
    shellValidatedScraper.run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
      fetchJson: async () => jobsApiPayload,
    }),
    /verified mediatek careers page/i,
  )

  await assert.rejects(
    apiOnlyScraper.run({
      fetchJson: async () => [{ result: { data: { json: { status: 'complete', jobs: [], pagination: { current_page: 1, total_pages: 1, total_items: 0 } } } } }],
    }),
    /verified mediatek jobs api/i,
  )
})
