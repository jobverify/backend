import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'
const CAREERS_URL = 'https://www.fivetran.com/careers'
const GREENHOUSE_ALERT_URL = 'https://my.greenhouse.io/users/sign_in?job_board=fivetran'
const GREENHOUSE_BOARD_URL = 'https://job-boards.greenhouse.io/fivetran'
const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/fivetran/jobs?content=true'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Experience ownership, impact, and recognition at Fivetran | Careers at Fivetran</title>
    <link rel="canonical" href="https://www.fivetran.com/careers" />
  </head>
  <body>
    <main>
      <h1>Together, we power the data revolution</h1>
      <p>We believe every transformative idea begins with data.</p>
      <a href="#jobs">View open roles</a>
      <section aria-label="locations">
        <h2>Raised in the Bay, we’ve gone global</h2>
        <div>Bengaluru | India</div>
        <div>Sydney | Australia</div>
      </section>
      <section aria-label="jobs">
        <h2>We're better together</h2>
        <a href="https://my.greenhouse.io/users/sign_in?job_board=fivetran">
          Interested in building your career at Fivetran ? Get future opportunities sent straight to your email.
        </a>
        <p>Create job alert</p>
      </section>
      <section aria-label="fraud-warning">
        <p>All communication with Fivetran employees will come from an “@fivetran.com” email address.</p>
      </section>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 9100001002,
      title: 'Senior Software Engineer',
      location: { name: 'Bengaluru, India' },
      absolute_url: 'https://job-boards.greenhouse.io/fivetran/jobs/9100001002',
      requisition_id: 'ENG-9100001002',
      company_name: 'Fivetran',
      updated_at: '2026-07-10T15:32:40-04:00',
      content:
        '&lt;p&gt;Build reliable data pipelines from our Bengaluru office in a hybrid environment.&lt;/p&gt;&lt;p&gt;5+ years of backend engineering experience.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
    },
    {
      id: 9100002002,
      title: 'Account Executive',
      location: { name: 'Remote - United States' },
      absolute_url: 'https://boards.greenhouse.io/fivetran/jobs/9100002002?gh_jid=9100002002',
      requisition_id: 'GTM-9100002002',
      company_name: 'Fivetran',
      updated_at: '2026-07-12T11:10:05-04:00',
      content:
        '&lt;p&gt;Own expansion opportunities across North America in a remote role.&lt;/p&gt;&lt;p&gt;3+ years of enterprise sales experience.&lt;/p&gt;&lt;p&gt;#LI-Remote&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/fivetran/script.js')
  } catch {
    assert.fail('Expected Fivetran scraper module at ../../scraper/fivetran/script.js')
  }
}

test('Fivetran helpers stay pinned to the verified first-party careers page and Greenhouse handoff contract', async () => {
  const fivetran = await loadModule()

  assert.equal(fivetran.SOURCE, 'fivetran')
  assert.equal(fivetran.COMPANY, 'Fivetran')
  assert.equal(fivetran.OFFICIAL_BRAND_NAME, 'Fivetran')
  assert.equal(fivetran.VERIFIED_ON, '2026-08-02')
  assert.equal(fivetran.CAREERS_URL, CAREERS_URL)
  assert.equal(fivetran.GREENHOUSE_ALERT_URL, GREENHOUSE_ALERT_URL)
  assert.equal(fivetran.GREENHOUSE_BOARD_SLUG, 'fivetran')
  assert.equal(fivetran.GREENHOUSE_BOARD_URL, GREENHOUSE_BOARD_URL)
  assert.equal(
    fivetran.buildGreenhouseJobsApiUrl(),
    GREENHOUSE_JOBS_API_URL,
  )
  assert.equal(fivetran.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    fivetran.extractGreenhouseBoardSlug(officialCareersHtml),
    'fivetran',
  )
  assert.equal(
    fivetran.buildGreenhouseBoardUrl(),
    GREENHOUSE_BOARD_URL,
  )
  assert.equal(
    fivetran.isVerifiedGreenhouseBoardRedirect({
      status: 200,
      url: CAREERS_URL,
      html: officialCareersHtml,
    }),
    true,
  )
  assert.equal(
    fivetran.normalizeGreenhouseJobUrl('https://job-boards.greenhouse.io/fivetran/jobs/9100001002', 9100001002),
    'https://www.fivetran.com/careers/job?gh_jid=9100001002',
  )
  assert.equal(
    fivetran.normalizeGreenhouseJobUrl('https://boards.greenhouse.io/fivetran/jobs/9100002002?gh_jid=9100002002', 9100002002),
    'https://www.fivetran.com/careers/job?gh_jid=9100002002',
  )
})

test('Fivetran extracts jobs from the derived Greenhouse payload and preserves canonical public job URLs', async () => {
  const fivetran = await loadModule()

  const jobs = fivetran.extractJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
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
      postingDate: job.postingDate,
      remoteStatus: job.remoteStatus,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: 'Senior Software Engineer',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        link: 'https://www.fivetran.com/careers/job?gh_jid=9100001002',
        applyUrl: 'https://www.fivetran.com/careers/job?gh_jid=9100001002',
        department: 'Engineering',
        postingDate: '2026-07-10',
        remoteStatus: 'Hybrid',
        experienceRequired: '5+ years',
      },
      {
        title: 'Account Executive',
        location: 'Remote - United States',
        city: 'Remote - United States',
        country: 'United States',
        link: 'https://www.fivetran.com/careers/job?gh_jid=9100002002',
        applyUrl: 'https://www.fivetran.com/careers/job?gh_jid=9100002002',
        department: 'Sales',
        postingDate: '2026-07-12',
        remoteStatus: 'Remote',
        experienceRequired: '3+ years',
      },
    ],
  )
  assert.equal(jobs[0].source, 'fivetran')
  assert.match(jobs[0].jobDescription, /Bengaluru office in a hybrid environment/i)
  assert.match(jobs[1].jobDescription, /remote role/i)
})

test('Fivetran run validates the first-party careers page and Greenhouse board redirect before fetching the jobs API', async () => {
  const fivetran = await loadModule()
  const requested = []

  const jobs = await fivetran.createFivetranScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })
      if (url === CAREERS_URL) {
        return { status: 200, url: CAREERS_URL, html: officialCareersHtml }
      }
      if (url === GREENHOUSE_BOARD_URL) {
        return { status: 200, url: CAREERS_URL, html: officialCareersHtml }
      }
      throw new Error(`Unexpected Fivetran fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'page', url: CAREERS_URL },
    { type: 'page', url: GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: GREENHOUSE_JOBS_API_URL,
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'fivetran')
  assert.equal(
    jobs[0].link,
    'https://www.fivetran.com/careers/job?gh_jid=9100001002',
  )
})

test('Fivetran run fails closed when the careers page, Greenhouse board slug, or public job URL contract drift materially', async () => {
  const fivetran = await loadModule()

  await assert.rejects(
    fivetran.createFivetranScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url: CAREERS_URL,
            html: officialCareersHtml.replace('Together, we power the data revolution', 'Build with us'),
          }
        }
        throw new Error(`Unexpected Fivetran fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Fivetran careers page/i,
  )

  await assert.rejects(
    fivetran.createFivetranScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return {
            status: 200,
            url: CAREERS_URL,
            html: officialCareersHtml.replace('job_board=fivetran', 'job_board=other-company'),
          }
        }
        throw new Error(`Unexpected Fivetran fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Greenhouse board slug/i,
  )

  await assert.rejects(
    fivetran.createFivetranScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return { status: 200, url: CAREERS_URL, html: officialCareersHtml }
        }
        if (url === GREENHOUSE_BOARD_URL) {
          return {
            status: 200,
            url: 'https://job-boards.greenhouse.io/other-company',
            html: officialCareersHtml,
          }
        }
        throw new Error(`Unexpected Fivetran fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Greenhouse board redirect/i,
  )

  await assert.rejects(
    fivetran.createFivetranScraper().run({
      fetchPage: async (url) => {
        if (url === CAREERS_URL) {
          return { status: 200, url: CAREERS_URL, html: officialCareersHtml }
        }
        if (url === GREENHOUSE_BOARD_URL) {
          return { status: 200, url: CAREERS_URL, html: officialCareersHtml }
        }
        throw new Error(`Unexpected Fivetran fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/other-company/jobs/9100001002',
          },
        ],
      }),
    }),
    /verified public Greenhouse detail URLs/i,
  )
})
