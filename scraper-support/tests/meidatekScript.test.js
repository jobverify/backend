import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOBS_PAGE_SIZE,
  buildJobsApiUrl,
  createMediatekScraper,
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
            id: 'MTB120250718000',
            title: 'Analog Mixed-Signal Design Verification Engineer',
            summary: null,
            location: null,
            jobPostStatus: 'posted',
            description: 'Verification role for MediaTek Bangalore.',
            publishedDate: '2025-07-17T16:00:00.000+00:00',
            applicationId: null,
            properties: {
              category: {
                label: 'Information Technology',
                code: '9013',
              },
              workExperience: {
                label: '0003',
                code: 'More than 2 Years Work Expe.',
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
                  educationDegree: "Bachelor's Degree",
                  educationMajor: 'Electrical Engineering',
                },
              ],
            },
            jobStatusInfo: null,
          },
        ],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 1,
        },
      },
    },
  },
}]

test('Meidatek alias recommendation depends on the current MediaTek jobs API contract staying stable', async () => {
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
  assert.equal(jobs[0].company, 'MediaTek')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].link, 'https://careers.mediatek.com/en/jobs/MTB120250718000')
})
