import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_JOB_OPENINGS = [
  {
    job_id: 'a6a560cbbba247',
    location: ['Noida, Delhi, Delhi, India (SB_NCR)'],
    location_city: ['Delhi'],
    location_country: 'India',
    job_title: 'Associate',
    employee_type: 'Full Time',
    experience_from: 0,
    experience_to: 2,
    post_on_careers_page: 1,
  },
  {
    job_id: 'a69e5d49b8a0ef',
    location: ['Bangalore, Bangalore, Karnataka, India (SB_CO)'],
    location_city: ['Bangalore'],
    location_country: 'India',
    job_title: 'Software Development Engineer in Test',
    employee_type: 'Full Time',
    experience_from: 3,
    experience_to: 5,
    post_on_careers_page: 1,
  },
  {
    job_id: 'a6a13d4b05c2eb',
    location: ['Pune, Pune, Maharashtra, India (SB_PUNE)'],
    location_city: ['Pune'],
    location_country: 'India',
    job_title: 'Senior Relationship Manager',
    employee_type: 'Full Time',
    experience_from: 4,
    experience_to: 7,
    post_on_careers_page: 1,
  },
  {
    job_id: 'sg-004',
    location: ['Singapore'],
    location_city: ['Singapore'],
    location_country: 'Singapore',
    job_title: 'International Wealth Specialist',
    employee_type: 'Full Time',
    experience_from: 5,
    experience_to: 8,
    post_on_careers_page: 1,
  },
  {
    job_id: 'hidden-005',
    location: ['Bangalore, Bangalore, Karnataka, India (SB_CO)'],
    location_city: ['Bangalore'],
    location_country: 'India',
    job_title: 'Hidden Internal Role',
    employee_type: 'Full Time',
    experience_from: 1,
    experience_to: 3,
    post_on_careers_page: 0,
  },
]

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Scripbox</title>
    <link href="https://scripbox.com/pages/careers" rel="canonical" />
  </head>
  <body>
    <main>
      <h1>Join us in helping make every Indian financially secure</h1>
      <section>
        <h2>Job Openings</h2>
        <a href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all">Associate</a>
        <a href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all">Software Development Engineer in Test</a>
        <a href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a13d4b05c2eb?from=all">Senior Relationship Manager</a>
      </section>
      <section>
        <h2>Get In Touch</h2>
        <p>For queries regarding job openings, email us at our recruiting desk.</p>
      </section>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      page: '/pages/careers',
      props: {
        pageProps: {
          jobOpenings: VERIFIED_JOB_OPENINGS,
        },
      },
    })}</script>
  </body>
</html>
`

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No verified jobs surface.</p></main>
  </body>
</html>
`

const INVALID_DETAIL_LINKS_HTML = VERIFIED_CAREERS_HTML.replace(
  'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
  'https://example.com/jobs/a69e5d49b8a0ef',
)

const loadScripboxModule = async () => {
  try {
    return await import('../../scraper/scripbox/script.js')
  } catch {
    assert.fail('Expected Scripbox scraper module at ../../scraper/scripbox/script.js')
  }
}

test('Scripbox helpers pin the verified first-party careers page and extract India openings from embedded next data', async () => {
  const scripbox = await loadScripboxModule()

  assert.equal(scripbox.SOURCE, 'scripbox')
  assert.equal(scripbox.COMPANY, 'Scripbox')
  assert.equal(scripbox.HOMEPAGE_URL, 'https://scripbox.com/')
  assert.equal(scripbox.CAREERS_URL, 'https://scripbox.com/pages/careers')
  assert.equal(scripbox.PUBLIC_BOARD_URL, 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(
    scripbox.VERIFIED_SAMPLE_JOB_URL,
    'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
  )
  assert.equal(scripbox.VERIFIED_ON, '2026-07-19')
  assert.equal(scripbox.hasVerifiedCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(
    scripbox.extractEmbeddedJobOpenings(VERIFIED_CAREERS_HTML).map((job) => job.job_id),
    ['a6a560cbbba247', 'a69e5d49b8a0ef', 'a6a13d4b05c2eb', 'sg-004', 'hidden-005'],
  )

  const jobs = scripbox.extractIndiaJobsFromCareersPage(VERIFIED_CAREERS_HTML, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Associate',
      company: 'Scripbox',
      location: 'Delhi, India',
      city: 'Delhi',
      country: 'India',
      employmentType: 'Full Time',
      experienceRequired: '0-2 years',
      jobId: 'a6a560cbbba247',
      requisitionId: 'a6a560cbbba247',
      sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all',
      applyUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all',
      link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all',
      source: 'scripbox',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Software Development Engineer in Test',
      company: 'Scripbox',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      employmentType: 'Full Time',
      experienceRequired: '3-5 years',
      jobId: 'a69e5d49b8a0ef',
      requisitionId: 'a69e5d49b8a0ef',
      sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
      applyUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
      link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69e5d49b8a0ef?from=all',
      source: 'scripbox',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Senior Relationship Manager',
      company: 'Scripbox',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      employmentType: 'Full Time',
      experienceRequired: '4-7 years',
      jobId: 'a6a13d4b05c2eb',
      requisitionId: 'a6a13d4b05c2eb',
      sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a13d4b05c2eb?from=all',
      applyUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a13d4b05c2eb?from=all',
      link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a13d4b05c2eb?from=all',
      source: 'scripbox',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
  ])
})

test('Scripbox run validates the verified careers page before returning India roles', async () => {
  const scripbox = await loadScripboxModule()
  const requestedUrls = []

  const jobs = await scripbox.createScripboxScraper().run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scripbox.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected Scripbox fixture URL: ${url}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [scripbox.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Associate')
  assert.equal(jobs[0].source, 'scripbox')
})

test('Scripbox fails closed when the verified careers shell drifts or the public detail links stop matching the Darwinbox handoff', async () => {
  const scripbox = await loadScripboxModule()

  await assert.rejects(
    scripbox.createScripboxScraper().run({
    detailEnrichmentBudgetMs: 0,
      fetchText: async () => DRIFTED_CAREERS_HTML,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    scripbox.createScripboxScraper().run({
    detailEnrichmentBudgetMs: 0,
      fetchText: async () => INVALID_DETAIL_LINKS_HTML,
    }),
    /verified first-party careers page|darwinbox detail links/i,
  )
})

// Captured anonymous first-party job API response, 2026-10-29. Removing
// native hydration must fail this source-content regression.
test('Scripbox hydrates authoritative native descriptions without granting listing cleanup authority', async () => {
  const { readFileSync } = await import('node:fs')
  const provider = await loadScripboxModule()
  const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/scripbox-native-detail.json', import.meta.url), 'utf8'))
  const careersHtml = VERIFIED_CAREERS_HTML.replaceAll('Associate', 'Associate Relationship manager')
  const jobs = await provider.createScripboxScraper().run({
    fetchText: async () => careersHtml,
    fetchJobDetail: async ({ jobId }) => {
      if (jobId !== 'a6a560cbbba247') throw new Error('Fixture role unavailable')
      return payload
    },
  })
  const hydrated = jobs.find(job => job.jobId === 'a6a560cbbba247')
  assert.equal(hydrated.sourceDetailComplete, true)
  assert.equal(hydrated.sourcePostingDate, '2026-07-13T18:30:00.000Z')
  assert.equal(hydrated.postingDate, '2026-07-13T18:30:00.000Z')
  assert.equal(hydrated.sourceDateEvidence, 'darwinbox-native-posted-on-v1')
  assert.ok(hydrated.sourceDescription.length > 6000)
  assert.equal(hydrated.jobDescription, hydrated.sourceDescription)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.ok(jobs.filter(job => job !== hydrated).every(job => job.sourceDetailComplete === false && !job.sourceDescription))

  const empty = structuredClone(payload)
  empty.message.job[0].jd = ''
  const dateOnlyJobs = await provider.createScripboxScraper().run({
    fetchText: async () => careersHtml, fetchJobDetail: async () => empty,
  })
  const dateOnly = dateOnlyJobs.find(job => job.jobId === 'a6a560cbbba247')
  assert.equal(dateOnly.sourceDetailComplete, false)
  assert.equal(dateOnly.postingDate, '2026-07-13T18:30:00.000Z')
  assert.ok(!dateOnly.sourceDescription)

  const mismatch = structuredClone(payload)
  mismatch.message.job[0].title = 'A different employer role'
  const rejected = await provider.createScripboxScraper().run({
    fetchText: async () => careersHtml, fetchJobDetail: async () => mismatch,
  })
  assert.ok(rejected.every(job => job.sourceDetailComplete === false && !job.sourceDescription))
})

test('Scripbox cancellation stops before requesting listing or native details', async () => {
  const provider = await loadScripboxModule()
  const controller = new AbortController()
  controller.abort(new Error('Caller cancelled'))
  let requested = false
  await assert.rejects(provider.createScripboxScraper().run({
    signal: controller.signal, fetchText: async () => { requested = true; return VERIFIED_CAREERS_HTML },
    fetchJobDetail: async () => { requested = true },
  }), /Caller cancelled/)
  assert.equal(requested, false)
})
