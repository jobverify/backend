import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_API_URL,
  createUrbanCompanyScraper,
  extractJobsFromPayload,
  hasOfficialCareersPageSignal,
} from '../../scraper/urbancompany/script.js'

const CAREERS_HTML = `
<!doctype html>
<html>
  <head>
    <title>Urban Company</title>
  </head>
  <body>
    <div id="root"></div>
    <script>
      const baseUrl = 'https://www.urbanclap.com/api/v2/platform-gateway';
      fetch('/getAllJobs');
      fetch('/getJobDetails');
    </script>
    <script src="/static/js/main.cede5508.chunk.js"></script>
  </body>
</html>
`

const JOBS_PAYLOAD = {
  jobs: [
    {
      job_id: 'job-1',
      job_code: 'UCL-1',
      parent_department: 'Engineering & Data',
      location: ['Bengaluru, Karnataka, India'],
      location_city: ['Bengaluru'],
      job_title: 'Software Development Engineer III - Backend',
      job_description: '<p>Build backend systems.</p>',
      apply_url: 'https://urbancompany.turbohire.co/job/publicjobs/job-1',
    },
    {
      job_id: 'job-2',
      job_code: 'UCL-2',
      parent_department: 'Business',
      location: ['Remote, India'],
      location_city: ['Remote'],
      job_title: 'Category Manager',
      job_description: '<p>Support category expansion.</p>',
      apply_url: 'https://urbancompany.turbohire.co/job/publicjobs/job-2',
    },
    {
      job_id: 'job-3',
      job_code: 'UCL-3',
      parent_department: 'International',
      location: ['Dubai, United Arab Emirates'],
      location_city: ['Dubai'],
      job_title: 'Regional Operations Lead',
      job_description: '<p>Outside India.</p>',
      apply_url: 'https://urbancompany.turbohire.co/job/publicjobs/job-3',
    },
  ],
}

test('Urban Company careers page signal requires the verified first-party API markers', () => {
  assert.equal(hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(hasOfficialCareersPageSignal('<html><title>Other</title></html>'), false)
})

test('extractJobsFromPayload keeps only India jobs and maps the public API fields', () => {
  const jobs = extractJobsFromPayload(JOBS_PAYLOAD)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Software Development Engineer III - Backend',
    'Category Manager',
  ])
  assert.equal(jobs[0].company, 'Urban Company')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].department, 'Engineering & Data')
  assert.equal(jobs[0].sourceUrl, 'https://urbancompany.turbohire.co/job/publicjobs/job-1')
  assert.equal(jobs[1].remoteStatus, 'Remote')
})

test('Urban Company scraper validates the careers page and returns mapped India jobs from the first-party API', async () => {
  let fetchedCareersUrl = null
  let fetchedApiUrl = null

  const jobs = await createUrbanCompanyScraper().run({
    fetchText: async (url) => {
      fetchedCareersUrl = url
      return CAREERS_HTML
    },
    fetchJson: async (url) => {
      fetchedApiUrl = url
      return JOBS_PAYLOAD
    },
  })

  assert.equal(fetchedCareersUrl, CAREERS_URL)
  assert.equal(fetchedApiUrl, JOBS_API_URL)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, 'job-1')
  assert.equal(jobs[1].requisitionId, 'UCL-2')
})
