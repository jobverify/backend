import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work with us - Graviton</title>
  </head>
  <body class="workWithUS">
    <main>
      <p class="banner-intro">Work with us</p>
      <h2>Looking for exceptional people</h2>
      <h2>At Graviton, we are looking for talented individuals who have expertise in solving problems and have a data driven mindset.</h2>
      <iframe
        id="grnhse_iframe"
        title="Current job openings"
        src="greenhouse-embed-local.html"
      ></iframe>
    </main>
  </body>
</html>
`

const EMBEDDED_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings</title>
  </head>
  <body>
    <h1>Graviton Research Capital LLP</h1>
    <h2 id="board_title">Current Job Openings</h2>
    <div id="gh-board" aria-label="Job openings"></div>
    <script src="javascripts/greenhouse-embed-local.js"></script>
  </body>
</html>
`

const FIRST_PARTY_JOBS_PAYLOAD = {
  board: {
    departments: {
      4002120002: 'Core Engineering',
      4002130002: 'Finance',
    },
    offices: {},
  },
  jobs: [
    {
      title: 'Application Reliability Engineer',
      url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8185148002?gh_jid=8185148002',
      gh_jid: '8185148002',
      location_text: 'Gurugram, Haryana, India',
      department_id: '4002120002',
      department: 'Core Engineering',
      office_id: null,
      office: null,
      details: {
        url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8185148002?gh_jid=8185148002',
        description_text: 'Monitor production services and respond quickly to alerts and incidents.',
      },
    },
    {
      title: 'Accountant',
      url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8559378002?gh_jid=8559378002',
      gh_jid: '8559378002',
      location_text: 'Singapore',
      department_id: '4002130002',
      department: 'Finance',
      office_id: null,
      office: null,
      details: {
        url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8559378002?gh_jid=8559378002',
        description_text: 'Singapore finance role.',
      },
    },
    {
      title: 'Intern - Software Engineer - Ultra Low Latency (2028 Graduates)',
      url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8630909002?gh_jid=8630909002',
      gh_jid: '8630909002',
      location_text: 'Gurugram, Haryana, India; Singapore',
      department_id: '4002120002',
      department: 'Core Engineering',
      office_id: null,
      office: null,
      details: {
        url: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8630909002?gh_jid=8630909002',
        description_text: 'Build software where every nanosecond matters.',
      },
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/graviton/script.js')
  } catch {
    assert.fail('Expected Graviton scraper module at ../../scraper/graviton/script.js')
  }
}

test('Graviton verifies the first-party careers shell, embedded jobs page, and first-party jobs JSON before extracting India jobs', async () => {
  const graviton = await loadScriptModule()

  assert.equal(graviton.SOURCE, 'graviton')
  assert.equal(graviton.COMPANY, 'Graviton')
  assert.equal(graviton.OFFICIAL_BRAND_NAME, 'Graviton Research Capital LLP')
  assert.equal(graviton.CAREERS_URL, 'https://www.gravitontrading.com/careers')
  assert.equal(graviton.EMBEDDED_JOBS_PAGE_URL, 'https://www.gravitontrading.com/greenhouse-embed-local.html')
  assert.equal(graviton.FIRST_PARTY_JOBS_JSON_URL, 'https://www.gravitontrading.com/data/greenhouse_jobs.json')
  assert.equal(graviton.buildFirstPartyJobsJsonUrl(), 'https://www.gravitontrading.com/data/greenhouse_jobs.json')
  assert.equal(graviton.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(graviton.hasVerifiedEmbeddedJobsSignal(EMBEDDED_JOBS_HTML), true)

  const jobs = graviton.extractIndiaJobsFromFirstPartyPayload(FIRST_PARTY_JOBS_PAYLOAD, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      department: job.department,
    })),
    [
      {
        title: 'Application Reliability Engineer',
        location: 'Gurugram, Haryana, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8185148002?gh_jid=8185148002',
        applyUrl: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8185148002?gh_jid=8185148002',
        department: 'Core Engineering',
      },
      {
        title: 'Intern - Software Engineer - Ultra Low Latency (2028 Graduates)',
        location: 'Gurugram, Haryana, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8630909002?gh_jid=8630909002',
        applyUrl: 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8630909002?gh_jid=8630909002',
        department: 'Core Engineering',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Monitor production services/i)
})

test('Graviton run validates the verified first-party pages before fetching the first-party jobs JSON and fails closed on drift', async () => {
  const graviton = await loadScriptModule()
  const requested = []

  const jobs = await graviton.createGravitonScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === graviton.CAREERS_URL) return CAREERS_HTML
      if (url === graviton.EMBEDDED_JOBS_PAGE_URL) return EMBEDDED_JOBS_HTML
      throw new Error(`Unexpected Graviton fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return FIRST_PARTY_JOBS_PAYLOAD
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: graviton.CAREERS_URL },
    { type: 'text', url: graviton.EMBEDDED_JOBS_PAGE_URL },
    {
      type: 'json',
      url: 'https://www.gravitontrading.com/data/greenhouse_jobs.json',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'graviton')
  assert.equal(jobs[0].link, 'https://boards.greenhouse.io/gravitonresearchcapital/jobs/8185148002?gh_jid=8185148002')

  await assert.rejects(
    graviton.createGravitonScraper().run({
      fetchText: async (url) => {
        if (url === graviton.CAREERS_URL) {
          return CAREERS_HTML.replace('Current job openings', 'Open roles')
        }
        throw new Error(`Unexpected Graviton fixture URL: ${url}`)
      },
      fetchJson: async () => FIRST_PARTY_JOBS_PAYLOAD,
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    graviton.createGravitonScraper().run({
      fetchText: async (url) => {
        if (url === graviton.CAREERS_URL) return CAREERS_HTML
        if (url === graviton.EMBEDDED_JOBS_PAGE_URL) {
          return EMBEDDED_JOBS_HTML.replace('javascripts/greenhouse-embed-local.js', 'javascripts/other.js')
        }
        throw new Error(`Unexpected Graviton fixture URL: ${url}`)
      },
      fetchJson: async () => FIRST_PARTY_JOBS_PAYLOAD,
    }),
    /embedded jobs page/i,
  )
})
