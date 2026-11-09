import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T18:00:00.000Z'

const careersPageHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Careers at Kaseya | Open Positions &amp; Job Opportunities</title>
    <link rel="canonical" href="https://www.kaseya.com/careers/jobs/" />
  </head>
  <body>
    <nav>
      <a href="/careers/life-at-kaseya/">Life at Kaseya</a>
    </nav>
    <main>
      <a href="/careers/jobs/id/6015830004/?gh_jid=6015830004">Staff Software Engineer</a>
      <a href="https://my.greenhouse.io/users/sign_in?job_board=kaseya&amp;source=job_alert_board">Create alert</a>
    </main>
  </body>
</html>`

const loadKaseyaIndiaModule = async () => {
  try {
    return await import('../../scraper/kaseyaindia/script.js')
  } catch {
    assert.fail('Expected Kaseya India scraper module at ../../scraper/kaseyaindia/script.js')
  }
}

test('Kaseya India scraper constants and helpers stay pinned to the verified first-party careers and Greenhouse surfaces', async () => {
  const kaseyaIndia = await loadKaseyaIndiaModule()

  assert.equal(kaseyaIndia.SOURCE, 'kaseyaindia')
  assert.equal(kaseyaIndia.COMPANY, 'Kaseya India')
  assert.equal(kaseyaIndia.OFFICIAL_BRAND_NAME, 'Kaseya')
  assert.equal(kaseyaIndia.CAREERS_URL, 'https://www.kaseya.com/careers/jobs/')
  assert.equal(
    kaseyaIndia.GREENHOUSE_EMBED_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=kaseya',
  )
  assert.equal(
    kaseyaIndia.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/kaseya/jobs?content=true',
  )
  assert.equal(kaseyaIndia.COMPANY_DOMAIN, 'kaseya.com')
  assert.equal(kaseyaIndia.VERIFIED_ON, '2026-08-04')

  assert.equal(kaseyaIndia.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.equal(kaseyaIndia.hasVerifiedGreenhouseBoardSignal(careersPageHtml), true)
  assert.equal(
    kaseyaIndia.normalizeGreenhouseJobUrl(
      'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
      6015830004,
    ),
    'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
  )
})

test('Kaseya India run validates the verified first-party careers page and keeps only India jobs from the Greenhouse feed', async () => {
  const kaseyaIndia = await loadKaseyaIndiaModule()
  const requestedPages = []
  const requestedApis = []

  const jobs = await kaseyaIndia.createKaseyaIndiaScraper().run({
    fetchText: async (url) => {
      requestedPages.push(url)
      if (url === kaseyaIndia.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected Kaseya India page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedApis.push({ url, method: options.method ?? 'GET' })

      return {
        jobs: [
          {
            id: 6015830004,
            title: 'Staff Software Engineer',
            absolute_url: 'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
            company_name: 'Kaseya Careers',
            location: { name: 'Pune, India' },
            departments: [{ name: 'R&D Engineering' }],
            offices: [{ name: 'India - Remote', location: null }],
            requisition_id: '2155',
            updated_at: '2026-08-03T14:44:15-04:00',
            content: '<p>Own backend services in Pune.</p>',
            metadata: null,
          },
          {
            id: 5783414004,
            title: 'Lead Software Engineer',
            absolute_url: 'https://www.kaseya.com/careers/jobs/id/5783414004/?gh_jid=5783414004',
            company_name: 'Kaseya Careers',
            location: { name: 'India - Remote' },
            departments: [{ name: 'RMM' }],
            offices: [{ name: 'India - Remote', location: null }],
            requisition_id: '260128-3',
            updated_at: '2026-07-27T15:20:38-04:00',
            content: '<p>Remote-first role for engineers in India.</p>',
            metadata: null,
          },
          {
            id: 5969615004,
            title: 'Account Executive',
            absolute_url: 'https://www.kaseya.com/careers/jobs/id/5969615004/?gh_jid=5969615004',
            company_name: 'Kaseya Careers',
            location: { name: 'Miami, FL' },
            departments: [{ name: 'Sales' }],
            offices: [{ name: 'Miami', location: 'Miami, FL' }],
            requisition_id: '260414-4',
            updated_at: '2026-07-17T14:26:48-04:00',
            content: '<p>US-only role.</p>',
            metadata: null,
          },
        ],
      }
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedPages, [kaseyaIndia.CAREERS_URL])
  assert.deepEqual(requestedApis, [
    {
      url: kaseyaIndia.buildGreenhouseJobsApiUrl(),
      method: 'GET',
    },
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Staff Software Engineer',
        location: 'Pune, India',
        city: 'Pune',
        sourceUrl: 'https://www.kaseya.com/careers/jobs/id/6015830004/?gh_jid=6015830004',
        source: 'kaseyaindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Lead Software Engineer',
        location: 'Remote, India',
        city: 'Remote',
        sourceUrl: 'https://www.kaseya.com/careers/jobs/id/5783414004/?gh_jid=5783414004',
        source: 'kaseyaindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Kaseya India fails closed when the first-party careers page drifts or the Greenhouse payload breaks', async () => {
  const kaseyaIndia = await loadKaseyaIndiaModule()

  await assert.rejects(
    kaseyaIndia.createKaseyaIndiaScraper().run({
      fetchText: async () => '<html><body>Missing verified careers surface</body></html>',
    }),
    /careers page/i,
  )

  await assert.rejects(
    kaseyaIndia.createKaseyaIndiaScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async () => ({ total: 1, jobPostings: null }),
    }),
    /expected payload/i,
  )
})
