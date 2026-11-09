import assert from 'node:assert/strict'
import test from 'node:test'

const officialJobListingsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Open Job Opportunities in the Identity Verification Industry | Jumio</title>
  </head>
  <body class="page-job-listings">
    <section class="job-listings">
      <h1>Help build the future of digital identity.</h1>
      <option value="0" selected disabled>Filter by Office</option>
      <option value="all">All departments</option>
      <div class="wrapper-jobs"></div>
    </section>
    <script>
      var JUM = {"base_url":"https://www.jumio.com","rest":{"job":"https://www.jumio.com/wp-json/jobs/","nonce":"cd82537696"}};
    </script>
  </body>
</html>
`

const greenhouseDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <a href="/jumio">Back to jobs</a>
    <h1>DevOps Engineer IV (Obs)</h1>
    <div>India (remote)</div>
    <button>Apply</button>
    <h3>Role Purpose</h3>
    <p>As a DevOps Engineer IV at Jumio, you are expected to be strong in both the “Dev” and “Ops” aspects of DevOps.</p>
    <h3>Experience &amp; Qualifications</h3>
    <ul>
      <li>8+ years of professional DevOps / Infrastructure management experience, with 5+ years in AWS.</li>
      <li>Strong scripting and automation skills.</li>
    </ul>
    <h2>Apply for this job</h2>
    <form></form>
  </body>
</html>
`

const unavailableGreenhouseDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current openings at Jumio</h1>
    <p>Create a Job Alert</p>
    <a href="https://job-boards.greenhouse.io/jumio/jobs/4640303005">DevOps Engineer IV (Obs)</a>
  </body>
</html>
`

const jumioJobsPayload = {
  departments: {
    engineeringGroup: {
      id: 4018894005,
      name: 'PEM',
      childs: {
        engineering: {
          id: 4019093005,
          name: 'Engineering',
          jobs: [
            {
              absolute_url: 'https://job-boards.greenhouse.io/jumio/jobs/4640303005',
              id: 4640303005,
              updated_at: '2026-07-12T17:30:59-04:00',
              requisition_id: '563',
              title: 'DevOps Engineer IV (Obs)',
              company_name: 'Jumio',
              first_published: '2026-03-08T04:36:41-04:00',
              location: { name: 'India (remote)' },
              metadata: [
                { name: 'Workplace Types', value: ['Hybrid', 'Onsite', 'Remote'] },
              ],
            },
            {
              absolute_url: 'https://job-boards.greenhouse.io/jumio/jobs/4713778005',
              id: 4713778005,
              updated_at: '2026-07-16T03:28:04-04:00',
              requisition_id: '642',
              title: 'Principal iOS Engineer',
              company_name: 'Jumio',
              first_published: '2026-07-15T06:27:46-04:00',
              location: { name: 'India (remote)' },
              metadata: [
                { name: 'Workplace Types', value: ['Hybrid', 'Onsite', 'Remote'] },
              ],
            },
          ],
        },
        machineLearning: {
          id: 4028806005,
          name: 'Machine Learning',
          jobs: [
            {
              absolute_url: 'https://job-boards.greenhouse.io/jumio/jobs/4630737005',
              id: 4630737005,
              updated_at: '2026-07-16T03:58:08-04:00',
              requisition_id: '553',
              title: 'SDE III - MLOps',
              company_name: 'Jumio',
              first_published: '2025-11-21T06:49:33-05:00',
              location: { name: 'India (remote)' },
              metadata: [
                { name: 'Workplace Types', value: ['Remote'] },
              ],
            },
            {
              absolute_url: 'https://job-boards.greenhouse.io/jumio/jobs/4664041005',
              id: 4664041005,
              updated_at: '2026-02-23T08:02:07-05:00',
              requisition_id: '592',
              title: 'Machine Learning Engineer - IV (Biometrics)',
              company_name: 'Jumio',
              first_published: '2026-02-23T08:02:07-05:00',
              location: { name: 'Bangalore' },
              metadata: [
                { name: 'Workplace Types', value: ['Remote'] },
              ],
            },
            {
              absolute_url: 'https://job-boards.greenhouse.io/jumio/jobs/4685786005',
              id: 4685786005,
              updated_at: '2026-07-13T11:13:10-04:00',
              requisition_id: '603',
              title: 'Senior Machine Learning Engineer - (Biometrics)',
              company_name: 'Jumio',
              first_published: '2026-04-22T16:41:29-04:00',
              location: { name: 'Montreal' },
              metadata: [
                { name: 'Workplace Types', value: ['Remote'] },
              ],
            },
          ],
        },
      },
    },
  },
}

const loadJumioModule = async () => {
  try {
    return await import('../../scraper/jumio/script.js')
  } catch {
    assert.fail('Expected Jumio scraper module at ../../scraper/jumio/script.js')
  }
}

test('Jumio scraper pins the verified official openings page and first-party jobs API', async () => {
  const jumio = await loadJumioModule()

  assert.equal(jumio.CAREERS_URL, 'https://www.jumio.com/careers/job-listings/')
  assert.equal(jumio.JOBS_API_URL, 'https://www.jumio.com/wp-json/jobs/filter')
  assert.equal(jumio.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/jumio')
  assert.equal(jumio.hasOfficialJobListingsSignal(officialJobListingsHtml), true)
  assert.equal(
    jumio.extractJobsApiBaseUrl(officialJobListingsHtml),
    'https://www.jumio.com/wp-json/jobs/',
  )
})

test('Jumio extracts only India jobs from the verified first-party jobs payload', async () => {
  const jumio = await loadJumioModule()
  const jobs = jumio.extractJumioIndiaJobsFromPayload(jumioJobsPayload, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'DevOps Engineer IV (Obs)',
        department: 'Engineering',
        location: 'India (remote)',
        city: 'Remote',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/jumio/jobs/4640303005',
        applyUrl: 'https://job-boards.greenhouse.io/jumio/jobs/4640303005#application',
        remoteStatus: 'Remote',
      },
      {
        title: 'Principal iOS Engineer',
        department: 'Engineering',
        location: 'India (remote)',
        city: 'Remote',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/jumio/jobs/4713778005',
        applyUrl: 'https://job-boards.greenhouse.io/jumio/jobs/4713778005#application',
        remoteStatus: 'Remote',
      },
      {
        title: 'SDE III - MLOps',
        department: 'Machine Learning',
        location: 'India (remote)',
        city: 'Remote',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/jumio/jobs/4630737005',
        applyUrl: 'https://job-boards.greenhouse.io/jumio/jobs/4630737005#application',
        remoteStatus: 'Remote',
      },
      {
        title: 'Machine Learning Engineer - IV (Biometrics)',
        department: 'Machine Learning',
        location: 'Bangalore',
        city: 'Bangalore',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/jumio/jobs/4664041005',
        applyUrl: 'https://job-boards.greenhouse.io/jumio/jobs/4664041005#application',
        remoteStatus: 'Remote',
      },
    ],
  )
  assert.equal(jobs[0].source, 'jumio')
})

test('Jumio run validates the official openings page before reading the first-party jobs API', async () => {
  const jumio = await loadJumioModule()
  const requested = []

  const jobs = await jumio.createJumioScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === jumio.CAREERS_URL) return officialJobListingsHtml
      if (/^https:\/\/job-boards\.greenhouse\.io\/jumio\/jobs\/\d+$/i.test(url)) {
        return greenhouseDetailHtml
      }
      throw new Error(`Unexpected Jumio fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push({ type: 'json', url })
      return jumioJobsPayload
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: 'https://www.jumio.com/careers/job-listings/' },
    { type: 'json', url: 'https://www.jumio.com/wp-json/jobs/filter' },
    { type: 'text', url: 'https://job-boards.greenhouse.io/jumio/jobs/4640303005' },
    { type: 'text', url: 'https://job-boards.greenhouse.io/jumio/jobs/4713778005' },
    { type: 'text', url: 'https://job-boards.greenhouse.io/jumio/jobs/4630737005' },
    { type: 'text', url: 'https://job-boards.greenhouse.io/jumio/jobs/4664041005' },
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'jumio')
})

test('Jumio run enriches Greenhouse detail pages to recover public experience evidence', async () => {
  const jumio = await loadJumioModule()
  const jobs = await jumio.createJumioScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === jumio.CAREERS_URL) return officialJobListingsHtml
      if (url === 'https://job-boards.greenhouse.io/jumio/jobs/4640303005') return greenhouseDetailHtml
      throw new Error(`Unexpected Jumio fixture URL: ${url}`)
    },
    fetchJson: async () => jumioJobsPayload,
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription, /8\+ years of professional DevOps/i)
})

test('Jumio marks redirected Greenhouse detail pages as publicly checked when experience is unavailable', async () => {
  const jumio = await loadJumioModule()
  const jobs = await jumio.createJumioScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === jumio.CAREERS_URL) return officialJobListingsHtml
      if (url === 'https://job-boards.greenhouse.io/jumio/jobs/4640303005') return unavailableGreenhouseDetailHtml
      throw new Error(`Unexpected Jumio fixture URL: ${url}`)
    },
    fetchJson: async () => jumioJobsPayload,
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('Jumio fails closed when the verified openings page or jobs payload drifts materially', async () => {
  const jumio = await loadJumioModule()

  await assert.rejects(
    jumio.createJumioScraper().run({
      fetchText: async () => officialJobListingsHtml.replace('wrapper-jobs', 'wrapper-roles'),
      fetchJson: async () => jumioJobsPayload,
    }),
    /verified official job listings surface/i,
  )

  await assert.rejects(
    jumio.createJumioScraper().run({
      fetchText: async () => officialJobListingsHtml,
      fetchJson: async () => ({ departments: null }),
    }),
    /first-party jobs payload/i,
  )
})
