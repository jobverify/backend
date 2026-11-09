import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join the Dremio Team | Career Opportunities | Dremio</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>The next wave of data analytics is here.</p>
    <a href="/careers/job-postings/">Search Jobs</a>
    <a href="/careers/job-postings/">Open Roles</a>
  </body>
</html>
`

const jobPostingsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Postings | Career Opportunities | Dremio</title>
  </head>
  <body>
    <p>Dremio is now part of SAP</p>
    <p>Working at Dremio</p>
    <h1>Job Postings</h1>
    <p>Open Roles</p>
  </body>
</html>
`

const cloudflareBlockHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Sorry, you have been blocked</h1>
    <p>Please enable cookies.</p>
    <p>You are unable to access wpewaf.com</p>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      absolute_url: 'https://www.dremio.com/careers/job-postings/?gh_jid=6314003003',
      id: 6314003003,
      requisition_id: '952',
      title: 'Future Opportunities',
      company_name: 'Dremio',
      updated_at: '2025-06-04T19:46:25-04:00',
      first_published: '2025-01-02T16:59:26-05:00',
      location: {
        name: 'Remote',
      },
      departments: [
        {
          name: 'General & Administrative',
        },
      ],
      content:
        '&lt;p&gt;Join the Dremio talent network for future openings.&lt;/p&gt;&lt;p&gt;7+ years of experience building high-growth teams.&lt;/p&gt;',
    },
  ],
}

const loadDremioModule = async () => {
  try {
    return await import('../../scraper/dremio/script.js')
  } catch {
    assert.fail('Expected Dremio scraper module at ../../scraper/dremio/script.js')
  }
}

test('Dremio scraper helpers stay pinned to the Sunday, August 2, 2026 first-party and Greenhouse contract', async () => {
  const dremio = await loadDremioModule()

  assert.equal(dremio.SOURCE, 'dremio')
  assert.equal(dremio.COMPANY, 'Dremio')
  assert.equal(dremio.CAREERS_LANDING_URL, 'https://www.dremio.com/careers/')
  assert.equal(dremio.JOB_POSTINGS_URL, 'https://www.dremio.com/careers/job-postings/')
  assert.equal(
    dremio.GREENHOUSE_EMBED_SCRIPT_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=dremio',
  )
  assert.equal(
    dremio.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/dremio/jobs?content=true',
  )
  assert.equal(dremio.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(dremio.hasOfficialJobPostingsSignal(jobPostingsHtml), true)
  assert.equal(
    dremio.hasCloudflareBlockSignal({
      status: 403,
      html: cloudflareBlockHtml,
    }),
    true,
  )

  const jobs = dremio.extractJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Future Opportunities',
      company: 'Dremio',
      location: 'Remote',
      city: null,
      country: null,
      link: 'https://www.dremio.com/careers/job-postings/?gh_jid=6314003003',
      applyUrl: 'https://www.dremio.com/careers/job-postings/?gh_jid=6314003003',
      sourceUrl: 'https://www.dremio.com/careers/job-postings/?gh_jid=6314003003',
      source: 'dremio',
      jobId: 6314003003,
      requisitionId: '952',
      department: 'General & Administrative',
      employmentType: null,
      experienceRequired: '7+ years',
      postingDate: '2025-06-04T19:46:25-04:00',
      jobDescription: 'Join the Dremio talent network for future openings. 7+ years of experience building high-growth teams.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'Remote',
      scrapedAt: '2026-08-02T00:00:00.000Z',
    },
  ])
})

test('Dremio run accepts Cloudflare-blocked first-party pages and still extracts the live Greenhouse job feed', async () => {
  const dremio = await loadDremioModule()
  const requested = []

  const jobs = await dremio.createDremioScraper().run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })
      return {
        status: 403,
        url,
        html: cloudflareBlockHtml,
      }
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'page', url: 'https://www.dremio.com/careers/' },
    { type: 'page', url: 'https://www.dremio.com/careers/job-postings/' },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/dremio/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Future Opportunities')
  assert.equal(jobs[0].source, 'dremio')
})

test('Dremio fails closed when the first-party pages are neither official nor Cloudflare-blocked, or when the Greenhouse payload drifts', async () => {
  const dremio = await loadDremioModule()

  await assert.rejects(
    dremio.createDremioScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://www.dremio.com/careers/',
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
      fetchJson: async () => greenhousePayload,
    }),
    /verified Dremio careers landing page/i,
  )

  await assert.rejects(
    dremio.createDremioScraper().run({
      fetchPage: async (url) => ({
        status: 403,
        url,
        html: cloudflareBlockHtml,
      }),
      fetchJson: async () => ({ jobs: null }),
    }),
    /Greenhouse jobs payload/i,
  )
})
