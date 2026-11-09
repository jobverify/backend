import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join a team of People with Purpose</title>
  </head>
  <body>
    <main>
      <h1>Career Opportunities</h1>
      <h2>Let's Build from Here</h2>
      <p>Explore our open roles for working totally remotely, from the office, or somewhere in between.</p>
      <a href="https://job-boards.greenhouse.io/eltropyinc">See open Roles</a>
      <a href="https://eltropy.bamboohr.com/careers">See open Roles</a>
    </main>
  </body>
</html>
`

const blockedFirstPartyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <style>
      .spinner {
        border-top: 4px solid #3498db;
      }
    </style>
    <div class="spinner"></div>
  </body>
</html>
`

const currentCloudflareForbiddenHtml = `<html>
<head>
<title>Error 403 Forbidden</title>
</head>
<body>
<h1>403 Forbidden</h1>
</body>
</html>
`

const greenhouseBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Eltropy Inc.</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009">AI Optimization Specialist (India)</a>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4244858009,
      title: 'AI Optimization Specialist (India)',
      location: { name: 'Remote' },
      absolute_url: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009',
      requisition_id: 'JR2639',
      company_name: 'Eltropy Inc.',
      updated_at: '2026-05-11T07:47:31-04:00',
      content: '&lt;p&gt;Optimize AI agents and onboarding workflows across India.&lt;/p&gt;',
      departments: [{ name: 'SIPS - Implementation' }],
      offices: [{ name: 'India Remote', location: 'India' }],
      metadata: [{ name: 'Employment Type', value: 'Full Time' }],
    },
    {
      id: 4242000001,
      title: 'Product Technical Specialist',
      location: { name: 'Hyderabad' },
      absolute_url: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4242000001',
      requisition_id: 'JR2601',
      company_name: 'Eltropy Inc.',
      updated_at: '2026-07-10T05:30:00-04:00',
      content: '&lt;p&gt;Support technical product delivery from Hyderabad.&lt;/p&gt;',
      departments: [{ name: 'Customer Success' }],
      offices: [{ name: 'Hyderabad', location: 'Hyderabad' }],
      metadata: [{ name: 'Employment Type', value: 'Full Time' }],
    },
    {
      id: 4242999999,
      title: 'Account Executive',
      location: { name: 'Santa Clara, California, United States' },
      absolute_url: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4242999999',
      requisition_id: 'JR2500',
      company_name: 'Eltropy Inc.',
      updated_at: '2026-07-11T05:30:00-04:00',
      content: '&lt;p&gt;United States role only.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ name: 'Santa Clara', location: 'Santa Clara, California, United States' }],
      metadata: [{ name: 'Employment Type', value: 'Full Time' }],
    },
  ],
}

const loadEltropyModule = async () => {
  try {
    return await import('../../scraper/eltropy/script.js')
  } catch {
    assert.fail('Expected Eltropy scraper module at ../../scraper/eltropy/script.js')
  }
}

test('Eltropy helpers keep the verified first-party careers page and Greenhouse jobs API pinned', async () => {
  const eltropy = await loadEltropyModule()

  assert.equal(eltropy.SOURCE, 'eltropy')
  assert.equal(eltropy.COMPANY, 'Eltropy')
  assert.equal(eltropy.OFFICIAL_BRAND_NAME, 'Eltropy')
  assert.equal(eltropy.VERIFIED_ON, '2026-10-03')
  assert.equal(eltropy.HOMEPAGE_URL, 'https://eltropy.com/')
  assert.equal(eltropy.CAREERS_URL, 'https://eltropy.com/careers/')
  assert.equal(eltropy.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/eltropyinc')
  assert.equal(
    eltropy.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/eltropyinc/jobs?content=true',
  )
  assert.equal(eltropy.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(eltropy.hasBlockedFirstPartySurfaceSignal(blockedFirstPartyHtml), true)
  assert.equal(eltropy.hasBlockedFirstPartySurfaceSignal(currentCloudflareForbiddenHtml, { server: 'cloudflare' }), true)
  assert.equal(eltropy.hasBlockedFirstPartySurfaceSignal(currentCloudflareForbiddenHtml), false)
  assert.equal(eltropy.hasBlockedFirstPartySurfaceSignal(currentCloudflareForbiddenHtml.replace('<h1>403 Forbidden</h1>', '<h1>Open roles</h1>'), { server: 'cloudflare' }), false)
  assert.equal(eltropy.hasOfficialGreenhouseBoardSignal(greenhouseBoardHtml), true)
  assert.equal(
    eltropy.extractGreenhouseBoardUrl(officialCareersHtml),
    'https://job-boards.greenhouse.io/eltropyinc',
  )
  assert.equal(
    eltropy.extractBambooCareersUrl(officialCareersHtml),
    'https://eltropy.bamboohr.com/careers',
  )
  assert.equal(
    eltropy.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009',
      4244858009,
    ),
    'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009',
  )
})

test('Eltropy extracts only India jobs from the verified Greenhouse payload and preserves the public Greenhouse detail URLs', async () => {
  const eltropy = await loadEltropyModule()

  const jobs = eltropy.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-15T00:00:00.000Z',
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
      employmentType: job.employmentType,
      postingDate: job.postingDate,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'AI Optimization Specialist (India)',
        location: 'India',
        city: 'Remote',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009',
        applyUrl: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009',
        department: 'SIPS - Implementation',
        employmentType: 'Full Time',
        postingDate: '2026-05-11',
        remoteStatus: 'Remote',
      },
      {
        title: 'Product Technical Specialist',
        location: 'Hyderabad',
        city: 'Hyderabad',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4242000001',
        applyUrl: 'https://job-boards.greenhouse.io/eltropyinc/jobs/4242000001',
        department: 'Customer Success',
        employmentType: 'Full Time',
        postingDate: '2026-07-10',
        remoteStatus: 'On-site',
      },
    ],
  )
  assert.equal(jobs[0].source, 'eltropy')
  assert.match(jobs[0].jobDescription, /AI agents and onboarding workflows/i)
  assert.match(jobs[1].jobDescription, /technical product delivery from Hyderabad/i)
})

test('run validates the verified first-party careers page before fetching the Greenhouse jobs API', async () => {
  const eltropy = await loadEltropyModule()
  const requested = []

  const jobs = await eltropy.createEltropyScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })
      if (url === eltropy.HOMEPAGE_URL) {
        return { status: 200, url, html: officialCareersHtml }
      }
      if (url === eltropy.CAREERS_URL) {
        return { status: 200, url, html: officialCareersHtml }
      }
      if (url === eltropy.GREENHOUSE_BOARD_URL) {
        return { status: 200, url, html: greenhouseBoardHtml }
      }
      throw new Error(`Unexpected Eltropy fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'page', url: eltropy.HOMEPAGE_URL },
    { type: 'page', url: eltropy.CAREERS_URL },
    { type: 'page', url: eltropy.GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/eltropyinc/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'eltropy')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/eltropyinc/jobs/4244858009')
})

test('run supports the blocked first-party surface while the verified Greenhouse board and jobs API remain live', async () => {
  const eltropy = await loadEltropyModule()
  const requested = []

  const jobs = await eltropy.createEltropyScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === eltropy.HOMEPAGE_URL || url === eltropy.CAREERS_URL) {
        return { status: 403, url, html: blockedFirstPartyHtml }
      }
      if (url === eltropy.GREENHOUSE_BOARD_URL) {
        return { status: 200, url, html: greenhouseBoardHtml }
      }
      throw new Error(`Unexpected blocked-surface Eltropy fixture URL: ${url}`)
    },
    fetchJson: async () => greenhousePayload,
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    eltropy.HOMEPAGE_URL,
    eltropy.CAREERS_URL,
    eltropy.GREENHOUSE_BOARD_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'AI Optimization Specialist (India)')
})

test('run accepts the current Cloudflare 403 on both official URLs while verifying the exact Greenhouse board', async () => {
  const eltropy = await loadEltropyModule()
  const requested = []

  const jobs = await eltropy.createEltropyScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === eltropy.HOMEPAGE_URL || url === eltropy.CAREERS_URL) {
        return { status: 403, url, html: currentCloudflareForbiddenHtml, server: 'cloudflare' }
      }
      if (url === eltropy.GREENHOUSE_BOARD_URL) {
        return { status: 200, url, html: greenhouseBoardHtml }
      }
      throw new Error(`Unexpected current Eltropy fixture URL: ${url}`)
    },
    fetchJson: async () => greenhousePayload,
  })

  assert.deepEqual(requested, [eltropy.HOMEPAGE_URL, eltropy.CAREERS_URL, eltropy.GREENHOUSE_BOARD_URL])
  assert.equal(jobs.length, 2)
})

test('run fails closed when the verified Eltropy surface or Greenhouse detail route drift materially', async () => {
  const eltropy = await loadEltropyModule()

  await assert.rejects(
    eltropy.createEltropyScraper().run({
      fetchPage: async (url) => {
        if (url === eltropy.HOMEPAGE_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }
        if (url === eltropy.CAREERS_URL) {
          return { status: 200, url, html: officialCareersHtml.replace('Career Opportunities', 'Open Careers') }
        }
        throw new Error(`Unexpected Eltropy drift fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    eltropy.createEltropyScraper().run({
      fetchPage: async (url) => {
        if (url === eltropy.HOMEPAGE_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }
        if (url === eltropy.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(
              'https://job-boards.greenhouse.io/eltropyinc',
              'https://job-boards.greenhouse.io/other-eltropy-board',
            ),
          }
        }
        throw new Error(`Unexpected Eltropy board-drift fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    eltropy.createEltropyScraper().run({
      fetchPage: async (url) => {
        if (url === eltropy.HOMEPAGE_URL || url === eltropy.CAREERS_URL) {
          return { status: 403, url, html: blockedFirstPartyHtml }
        }
        if (url === eltropy.GREENHOUSE_BOARD_URL) {
          return { status: 200, url, html: '<html><body>No openings</body></html>' }
        }
        throw new Error(`Unexpected Eltropy greenhouse drift fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified public Greenhouse board/i,
  )

  await assert.rejects(
    eltropy.createEltropyScraper().run({
      fetchPage: async (url) => {
        if (url === eltropy.HOMEPAGE_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }
        if (url === eltropy.CAREERS_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }
        if (url === eltropy.GREENHOUSE_BOARD_URL) {
          return { status: 200, url, html: greenhouseBoardHtml }
        }
        throw new Error(`Unexpected Eltropy detail-drift fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/other-company/jobs/4244858009',
          },
        ],
      }),
    }),
    /verified public Greenhouse job detail URLs/i,
  )
})
