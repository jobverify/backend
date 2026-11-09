import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_API_URL,
  createSensipleScraper,
  extractJobsApiUrl,
} from './script.js'

const FIXED_SCRAPED_AT = '2026-08-04T20:45:00.000Z'

const liveLikeCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Sensiple | Join Our Team of Innovators</title>
  </head>
  <body>
    <h1>Explore opportunities at Sensiple and take the next step in your career.</h1>
    <h2>Current Openings</h2>
    <div id="jobListings">Loading jobs...</div>
    <script>
      /* Load Jobs */
      fetch("https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure")
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data.length > 0) {
            allJobs = result.data.map(normalizeJob);
            populateFilterOptions(allJobs);
            renderJobs(allJobs);
          }
        });
    </script>
  </body>
</html>
`

const jobsPayload = {
  success: true,
  data: [
    {
      ReqIntID: 'RQ00000112',
      ReqID: 'Job-0112',
      JobTitle: 'Business Development Executive',
      JobType: 'Experienced',
      Location: 'Chennai',
      TotalExp: '4 to 8 years',
      PrimarySkills: 'US Sales,Inside Sales,Cold Calling,Cloud Sales',
      Status: 'Active',
      Description:
        '<p><strong>Role:</strong> Business Development Executive</p><p>Work timings - US EST timings (6.30 PM to 3.30 AM IST)</p>',
    },
  ],
}

test('extractJobsApiUrl accepts the live double-quoted jobs fetch call', () => {
  assert.equal(extractJobsApiUrl(liveLikeCareersPageHtml), JOBS_API_URL)
})

test('run accepts the verified careers page when the jobs fetch uses double quotes', async () => {
  const jobs = await createSensipleScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return liveLikeCareersPageHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, JOBS_API_URL)
      return jobsPayload
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'RQ00000112')
  assert.equal(jobs[0].title, 'Business Development Executive')
  assert.equal(jobs[0].link, 'https://www.sensiple.com/careers/#RQ00000112')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})
