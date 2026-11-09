import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
  <html>
    <head>
      <title>Unlock Your Potential with Kapture Careers - Join Us Today!</title>
      <link rel="canonical" href="https://www.kapture.cx/careers/" />
    </head>
    <body>
      <main>
        <h1>Kapture Careers</h1>
        <p>Build your career with Kapture CRM.</p>
        <script>
          window.khConfig = { identifier: "30315393-d861-4cad-851c-03e99c4fe979" }
        </script>
      </main>
    </body>
  </html>
`

const embedConfigScript = 'window.khConfig = { identifier: "30315393-d861-4cad-851c-03e99c4fe979" }'

const activeJobsPayload = [
  {
    id: 12345,
    title: 'Senior Backend Engineer',
    departmentId: 'engineering',
    description: '<p>Build reliable systems.</p>',
    jobLocations: [{ name: 'Bengaluru', city: 'Bengaluru', countryCode: 'IN', countryName: 'India' }],
    jobType: 2,
    publishedOn: '2026-07-09T10:00:00.000Z',
  },
]

const departmentsPayload = [
  { id: 'engineering', name: 'Engineering' },
]

const loadKaptureCrmModule = async () => {
  try {
    return await import('../../scraper/kapturecrm/script.js')
  } catch {
    assert.fail('Expected Kapture CRM scraper module at ../../scraper/kapturecrm/script.js')
  }
}

test('Kapture CRM exports a stable exact-name wrapper over the verified Kapture Keka contract', async () => {
  const kaptureCrm = await loadKaptureCrmModule()

  assert.equal(kaptureCrm.SOURCE, 'kapturecrm')
  assert.equal(kaptureCrm.COMPANY, 'Kapture CRM')
  assert.equal(kaptureCrm.OFFICIAL_BRAND_NAME, 'Kapture')
  assert.equal(kaptureCrm.CAREERS_URL, 'https://www.kapture.cx/careers/')
  assert.equal(kaptureCrm.EMBED_CONFIG_URL, 'https://kapturecrm.keka.com/careers/api/embedjobs/js/30315393-d861-4cad-851c-03e99c4fe979')
  assert.equal(kaptureCrm.ACTIVE_JOBS_URL, 'https://kapturecrm.keka.com/careers/api/embedjobs/default/active/30315393-d861-4cad-851c-03e99c4fe979')
  assert.equal(kaptureCrm.DEPARTMENTS_URL, 'https://kapturecrm.keka.com/careers/api/embedjobs/departments/30315393-d861-4cad-851c-03e99c4fe979')
  assert.equal(kaptureCrm.ATS_PLATFORM, 'keka-embed-api')
  assert.equal(kaptureCrm.COUNTRY_FILTER, 'India')
  assert.equal(kaptureCrm.PAGINATION_STRATEGY, 'single-keka-active-jobs-endpoint')
  assert.equal(kaptureCrm.VERIFIED_ON, '2026-08-02')
  assert.match(kaptureCrm.VERIFIED_SURFACE_SUMMARY, /Kapture CRM/i)
  assert.equal(kaptureCrm.hasVerifiedKaptureCrmCareersPageSignal(careersPageHtml), true)
  assert.equal(kaptureCrm.hasVerifiedKaptureCrmEmbedConfigSignal(embedConfigScript), true)
  assert.deepEqual(
    kaptureCrm.decorateKaptureCrmJob(
      {
        title: 'Senior Backend Engineer',
        company: 'Kapture',
        source: 'kapture',
        jobId: '12345',
        link: 'https://kapturecrm.keka.com/careers/applyjob/12345',
        applyUrl: 'https://kapturecrm.keka.com/careers/applyjob/12345',
        sourceUrl: 'https://kapturecrm.keka.com/careers/jobdetails/12345',
      },
      '2026-07-15T20:30:00.000Z',
    ),
    {
      title: 'Senior Backend Engineer',
      company: 'Kapture CRM',
      source: 'kapturecrm',
      jobId: '12345',
      link: 'https://kapturecrm.keka.com/careers/applyjob/12345',
      applyUrl: 'https://kapturecrm.keka.com/careers/applyjob/12345',
      sourceUrl: 'https://kapturecrm.keka.com/careers/jobdetails/12345',
      companyCareerPage: 'https://www.kapture.cx/careers/',
      companyDomain: 'kapture.cx',
      atsPlatform: 'keka-embed-api',
      scrapedAt: '2026-07-15T20:30:00.000Z',
    },
  )
})

test('Kapture CRM run validates the careers surface and decorates jobs from the existing Kapture scraper', async () => {
  const kaptureCrm = await loadKaptureCrmModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await kaptureCrm.createKaptureCrmScraper({
    maxJobs: 1,
    now: () => '2026-07-15T20:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === kaptureCrm.CAREERS_URL) return careersPageHtml
      if (url === kaptureCrm.EMBED_CONFIG_URL) return embedConfigScript
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === kaptureCrm.ACTIVE_JOBS_URL) return activeJobsPayload
      if (url === kaptureCrm.DEPARTMENTS_URL) return departmentsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    kaptureCrm.CAREERS_URL,
    kaptureCrm.EMBED_CONFIG_URL,
  ])
  assert.deepEqual(requestedJson, [
    kaptureCrm.ACTIVE_JOBS_URL,
    kaptureCrm.DEPARTMENTS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'kapturecrm')
  assert.equal(jobs[0].company, 'Kapture CRM')
  assert.equal(jobs[0].companyCareerPage, kaptureCrm.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'kapture.cx')
  assert.equal(jobs[0].atsPlatform, 'keka-embed-api')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T20:30:00.000Z')
})

test('Kapture CRM can recover with browser-backed careers and Keka payloads when direct requests time out', async () => {
  const kaptureCrm = await loadKaptureCrmModule()
  const browserTextUrls = []
  const browserJsonUrls = []

  const jobs = await kaptureCrm.createKaptureCrmScraper({
    maxJobs: 1,
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: www.kapture.cx:443, timeout: 10000ms)')
    },
    fetchJson: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: kapturecrm.keka.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      if (url === kaptureCrm.CAREERS_URL) return careersPageHtml
      if (url === kaptureCrm.EMBED_CONFIG_URL) return embedConfigScript
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      browserJsonUrls.push(url)
      if (url === kaptureCrm.ACTIVE_JOBS_URL) return activeJobsPayload
      if (url === kaptureCrm.DEPARTMENTS_URL) return departmentsPayload
      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
  })

  assert.deepEqual(browserTextUrls, [
    kaptureCrm.CAREERS_URL,
    kaptureCrm.EMBED_CONFIG_URL,
  ])
  assert.deepEqual(browserJsonUrls, [
    kaptureCrm.ACTIVE_JOBS_URL,
    kaptureCrm.DEPARTMENTS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'kapturecrm')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('Kapture CRM fails closed when the verified careers handoff drifts materially', async () => {
  const kaptureCrm = await loadKaptureCrmModule()

  await assert.rejects(
    kaptureCrm.createKaptureCrmScraper().run({
      fetchText: async (url) => {
        if (url === kaptureCrm.CAREERS_URL) return '<main>Different jobs page</main>'
        return embedConfigScript
      },
      fetchJson: async () => activeJobsPayload,
    }),
    /verified Kapture CRM careers page/i,
  )

  await assert.rejects(
    kaptureCrm.createKaptureCrmScraper().run({
      fetchText: async (url) => {
        if (url === kaptureCrm.CAREERS_URL) {
          return careersPageHtml.replace(
            '30315393-d861-4cad-851c-03e99c4fe979',
            'different-identifier',
          )
        }

        return careersPageHtml.replace(
          '30315393-d861-4cad-851c-03e99c4fe979',
          'different-identifier',
        )
      },
      fetchJson: async () => activeJobsPayload,
    }),
    /verified Kapture CRM careers page/i,
  )
})
