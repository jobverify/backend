import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Help shape the future of healthcare with AI</h1>
      <p>Join the Team</p>
      <p>Level-up your career by applying to opportunities at Suki.</p>
      <a href="https://www.suki.ai/open-positions/">See open positions</a>
      <footer>
        <p>Copyright 2026. Suki AI, Inc. All rights reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const OPEN_POSITIONS_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions at Suki | Healthcare AI Jobs</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <div id="grnhse_app"></div>
      <footer>
        <p>Company</p>
        <p>Careers</p>
        <p>Policies</p>
        <p>Trust Portal</p>
      </footer>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 7985192003,
      title: 'Clinical Quality Associate - II',
      company_name: 'Suki',
      absolute_url: 'https://www.suki.ai/open-positions?gh_jid=7985192003',
      location: { name: 'Bengaluru, Karnataka, India' },
      offices: [{ name: 'Suki India', location: null }],
      departments: [{ name: 'Clinical' }],
      requisition_id: '344',
      first_published: '2026-09-12T10:00:00-04:00',
      content: '&lt;p&gt;Review clinical quality.&lt;/p&gt;',
    },
    {
      id: 7824002003,
      title: 'Software Engineer II - Backend',
      company_name: 'Suki',
      absolute_url: 'https://www.suki.ai/open-positions?gh_jid=7824002003',
      location: { name: 'Bengaluru' },
      offices: [{ name: 'Suki India', location: null }],
      departments: [{ name: 'Engineering' }],
      requisition_id: '319',
      first_published: '2026-07-01T10:00:00-04:00',
      content: '&lt;p&gt;Build healthcare software.&lt;/p&gt;',
    },
    {
      id: 7627401003,
      title: 'Counsel, Commercial & Product (Hybrid)',
      company_name: 'Suki',
      absolute_url: 'https://www.suki.ai/open-positions?gh_jid=7627401003',
      location: { name: 'Redwood City, CA' },
      offices: [{ name: 'Suki HQ', location: 'Redwood City, California' }],
      departments: [{ name: 'Legal' }],
      requisition_id: '300',
      first_published: '2026-05-01T10:00:00-04:00',
      content: '&lt;p&gt;Support the US business.&lt;/p&gt;',
    },
  ],
  meta: { total: 3 },
}

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Positions @ Suki</h1>
    <h2>Business Operations Associate (SFDC)</h2>
    <a href="https://www.suki.ai/open-positions?gh_jid=6601892003">View job</a>
    <a href="https://www.suki.ai/open-positions?gh_jid=6601892003&weekdayJdUid=942792">Apply</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/suki/script.js')
  } catch {
    assert.fail('Expected Suki scraper module at ../../scraper/suki/script.js')
  }
}

test('Suki source contract stays pinned to its first-party page and verified Greenhouse board', async () => {
  const suki = await loadModule()

  assert.equal(suki.SOURCE, 'suki')
  assert.equal(suki.COMPANY, 'Suki')
  assert.equal(suki.OFFICIAL_BRAND_NAME, 'Suki AI, Inc.')
  assert.equal(suki.VERIFIED_ON, '2026-09-13')
  assert.equal(suki.CAREERS_PAGE_URL, 'https://www.suki.ai/careers/')
  assert.equal(suki.OFFICIAL_CAREERS_HANDOFF_URL, 'https://www.suki.ai/open-positions/')
  assert.equal(
    suki.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/suki/jobs?content=true',
  )
  assert.match(suki.VERIFIED_SURFACE_SUMMARY, /Greenhouse/i)
  assert.equal(suki.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    suki.extractOpenPositionsHandoffUrl(OFFICIAL_CAREERS_HTML),
    'https://www.suki.ai/open-positions/',
  )
  assert.equal(suki.pageExposesPublicJobListings(OFFICIAL_CAREERS_HTML), false)
  assert.equal(suki.pageExposesPublicJobListings(OPEN_POSITIONS_SHELL_HTML), false)
  assert.equal(suki.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(suki.hasVerifiedGreenhouseShell(OPEN_POSITIONS_SHELL_HTML), true)
})

test('Suki enumerates India jobs from the official Greenhouse feed, including structured India-office evidence', async () => {
  const suki = await loadModule()
  const requestedUrls = []

  const jobs = await suki.createSukiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === suki.CAREERS_PAGE_URL) {
        return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
      }

      if (url === suki.OFFICIAL_CAREERS_HANDOFF_URL) {
        return { status: 200, url, html: OPEN_POSITIONS_SHELL_HTML }
      }

      throw new Error(`Unexpected Suki URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, suki.GREENHOUSE_JOBS_API_URL)
      return GREENHOUSE_PAYLOAD
    },
    now: () => '2026-09-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    suki.CAREERS_PAGE_URL,
    suki.OFFICIAL_CAREERS_HANDOFF_URL,
    suki.GREENHOUSE_JOBS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => [job.jobId, job.location, job.city, job.country]), [
    ['7985192003', 'Bengaluru, Karnataka, India', 'Bengaluru', 'India'],
    ['7824002003', 'Bengaluru', 'Bengaluru', 'India'],
  ])
  assert.equal(jobs.every((job) => job.company === 'Suki'), true)
  assert.equal(jobs.every((job) => job.source === 'suki'), true)
  assert.equal(jobs.every((job) => job.scrapedAt === '2026-09-13T00:00:00.000Z'), true)
  assert.equal(
    jobs[1].sourceUrl,
    'https://www.suki.ai/open-positions?gh_jid=7824002003',
  )
  assert.equal(jobs.some((job) => job.title.includes('Counsel')), false)
})

test('Suki default fetch path uses bounded abort signals for each page request', async () => {
  const suki = await loadModule()
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const requestedUrls = []
  const timeoutMs = []
  const timeoutSignals = []

  AbortSignal.timeout = (ms) => {
    timeoutMs.push(ms)
    const signal = new AbortController().signal
    timeoutSignals.push(signal)
    return signal
  }

  globalThis.fetch = async (url, options = {}) => {
    requestedUrls.push(url)
    const expectedSignal = timeoutSignals.at(-1)

    assert.ok(expectedSignal, 'expected default fetch to request a timeout signal')
    assert.equal(options.signal, expectedSignal)

    if (url === suki.CAREERS_PAGE_URL) {
      return { status: 200, url, text: async () => OFFICIAL_CAREERS_HTML }
    }

    if (url === suki.OFFICIAL_CAREERS_HANDOFF_URL) {
      return { status: 200, url, text: async () => OPEN_POSITIONS_SHELL_HTML }
    }

    throw new Error(`Unexpected Suki URL: ${url}`)
  }

  try {
    const jobs = await suki.createSukiScraper().run({
      fetchJson: async () => ({ jobs: [], meta: { total: 0 } }),
    })

    assert.deepEqual(requestedUrls, [
      suki.CAREERS_PAGE_URL,
      suki.OFFICIAL_CAREERS_HANDOFF_URL,
    ])
    assert.deepEqual(timeoutMs, [15000, 15000])
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

test('Suki fails closed when the verified careers page or open positions shell drifts materially', async () => {
  const suki = await loadModule()

  await assert.rejects(
    suki.createSukiScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified suki careers page/i,
  )

  await assert.rejects(
    suki.createSukiScraper().run({
      fetchPage: async (url) => {
        if (url === suki.CAREERS_PAGE_URL) {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /open positions surface changed materially/i,
  )
})

test('Suki never treats an unreadable Greenhouse response as an authoritative empty inventory', async () => {
  const suki = await loadModule()

  await assert.rejects(
    suki.createSukiScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === suki.CAREERS_PAGE_URL ? OFFICIAL_CAREERS_HTML : OPEN_POSITIONS_SHELL_HTML,
      }),
      fetchJson: async () => ({ message: 'temporarily unavailable' }),
    }),
    /Greenhouse jobs API no longer exposes/i,
  )
})

test('Suki validates foreign rows and rejects city-only jobs without country or office scope', async () => {
  const suki = await loadModule()
  const foreignCompanyPayload = structuredClone(GREENHOUSE_PAYLOAD)
  foreignCompanyPayload.jobs[2].company_name = 'Different Company'

  assert.throws(
    () => suki.extractIndiaJobsFromGreenhousePayload(foreignCompanyPayload),
    /company identity/i,
  )

  const ambiguousLocationPayload = structuredClone(GREENHOUSE_PAYLOAD)
  ambiguousLocationPayload.jobs[1].offices = []

  assert.throws(
    () => suki.extractIndiaJobsFromGreenhousePayload(ambiguousLocationPayload),
    /location scope/i,
  )
})

test('Suki propagates cancellation and does not continue to the handoff or jobs feed', async () => {
  const suki = await loadModule()
  const controller = new AbortController()
  const requestedUrls = []
  const cancellation = new Error('stop Suki probe')

  await assert.rejects(
    suki.createSukiScraper().run({
      signal: controller.signal,
      fetchPage: async (url, options = {}) => {
        requestedUrls.push(url)
        assert.equal(options.signal, controller.signal)
        controller.abort(cancellation)
        return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
      },
      fetchJson: async () => {
        assert.fail('Suki must not fetch Greenhouse after cancellation')
      },
    }),
    cancellation,
  )

  assert.deepEqual(requestedUrls, [suki.CAREERS_PAGE_URL])
})
