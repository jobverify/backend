import assert from 'node:assert/strict'
import test from 'node:test'

const loadAivenModule = async () => {
  try {
    return await import('../../scraper/aiven/script.js')
  } catch {
    assert.fail('Expected Aiven scraper module at ../../scraper/aiven/script.js')
  }
}

const listingHtml = `
  <html>
    <head>
      <title>Careers & Jobs at Aiven | Join our team today!</title>
      <meta property="og:url" content="https://aiven.io/careers/job">
      <link rel="canonical" href="https://aiven.io/careers/job">
    </head>
    <body>
      <h1>Open positions</h1>
      <p>35 jobs</p>
      <a href="/careers/job/4921030101">Account Executive Bengaluru, Karnataka, India</a>
      <a href="/careers/job/4899390101">Associate Solution Architect Austin, Texas, United States</a>
      <a href="/careers/job/4866392101">Technical Support Engineer - Bengaluru Bengaluru, Karnataka, India</a>
    </body>
  </html>
`

const accountExecutiveHtml = `
  <html>
    <head>
      <title>Account Executive at Bengaluru, Karnataka, India | Careers & Jobs at Aiven</title>
    </head>
    <body>
      <a href="/careers/job">See all job listings</a>
      <h1>Account Executive Bengaluru, Karnataka, India</h1>
      <p>Apply now</p>
      <p>Our sales team is growing quickly across APAC.</p>
      <h2>The Role:</h2>
      <p>Drive net-new business for Aiven in India.</p>
      <h2>What you'll do:</h2>
      <ul>
        <li>Build a pipeline across enterprise accounts.</li>
      </ul>
    </body>
  </html>
`

const supportEngineerHtml = `
  <html>
    <head>
      <title>Technical Support Engineer - Bengaluru at Bengaluru, Karnataka, India | Careers & Jobs at Aiven</title>
    </head>
    <body>
      <a href="/careers/job">See all job listings</a>
      <h1>Technical Support Engineer - Bengaluru Bengaluru, Karnataka, India</h1>
      <p>Apply now</p>
      <p>Our support team thrives on tackling complex challenges.</p>
      <h2>The Role:</h2>
      <p>Troubleshoot customer issues on the Aiven platform.</p>
      <h2>What You’ll Do:</h2>
      <ul>
        <li>Learn PostgreSQL, MySQL, Kafka, and OpenSearch.</li>
      </ul>
    </body>
  </html>
`

const listingHtmlWithoutIndiaJobs = `
  <html>
    <head>
      <title>Careers & Jobs at Aiven | Join our team today!</title>
      <meta property="og:url" content="https://aiven.io/careers/job">
      <link rel="canonical" href="https://aiven.io/careers/job">
    </head>
    <body>
      <h1>Open positions</h1>
      <p>37 jobs</p>
      <a href="/careers/job/6001001001">Account Executive, SMB Austin, Texas, United States</a>
      <a href="/careers/job/6001001002">Backend Engineer, ClickHouse Helsinki, Uusimaa, Finland</a>
      <a href="/careers/job/6001001003">Enterprise Account Executive United Kingdom</a>
    </body>
  </html>
`

test('Aiven constants stay pinned to the verified first-party careers listing', async () => {
  const aiven = await loadAivenModule()

  assert.equal(aiven.CAREERS_URL, 'https://aiven.io/careers/job')
  assert.equal(aiven.hasOfficialCareersSignal(listingHtml), true)
})

test('extractIndiaJobUrls keeps only India detail pages from the verified Aiven listing surface', async () => {
  const aiven = await loadAivenModule()

  assert.deepEqual(aiven.extractIndiaJobUrls(listingHtml), [
    'https://aiven.io/careers/job/4921030101',
    'https://aiven.io/careers/job/4866392101',
  ])
})

test('extractJobFromDetail maps first-party Aiven India role pages into normalized jobs', async () => {
  const aiven = await loadAivenModule()

  assert.deepEqual(
    aiven.extractJobFromDetail(
      'https://aiven.io/careers/job/4866392101',
      supportEngineerHtml,
    ),
    {
      title: 'Technical Support Engineer - Bengaluru',
      company: 'Aiven',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '4866392101',
      requisitionId: '4866392101',
      sourceUrl: 'https://aiven.io/careers/job/4866392101',
      applyUrl: 'https://aiven.io/careers/job/4866392101',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Our support team thrives on tackling complex challenges. The Role: Troubleshoot customer issues on the Aiven platform. What You’ll Do: Learn PostgreSQL, MySQL, Kafka, and OpenSearch.',
    },
  )
})

test('run validates the official Aiven listing page and decorates India jobs from first-party detail pages', async () => {
  const aiven = await loadAivenModule()
  const requestedUrls = []

  const jobs = await aiven.createAivenScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aiven.CAREERS_URL) return listingHtml
      if (url === 'https://aiven.io/careers/job/4921030101') return accountExecutiveHtml
      if (url === 'https://aiven.io/careers/job/4866392101') return supportEngineerHtml

      throw new Error(`Unexpected Aiven URL: ${url}`)
    },
    now: () => '2026-07-25T12:34:56.000Z',
  })

  assert.deepEqual(requestedUrls, [
    aiven.CAREERS_URL,
    'https://aiven.io/careers/job/4921030101',
    'https://aiven.io/careers/job/4866392101',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aiven')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-25T12:34:56.000Z')
  assert.equal(jobs[1].title, 'Technical Support Engineer - Bengaluru')
})

test('run fails closed when the verified Aiven listing surface or India detail pages disappear', async () => {
  const aiven = await loadAivenModule()

  await assert.rejects(
    aiven.createAivenScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official aiven careers listing/i,
  )

  await assert.rejects(
    aiven.createAivenScraper().run({
      fetchText: async (url) => {
        if (url === aiven.CAREERS_URL) return listingHtml
        return '<html><body>No role details here</body></html>'
      },
    }),
    /trusted public aiven india jobs/i,
  )
})

test('run returns no jobs when the verified Aiven listing currently exposes no India roles', async () => {
  const aiven = await loadAivenModule()

  const jobs = await aiven.createAivenScraper().run({
    fetchText: async (url) => {
      if (url === aiven.CAREERS_URL) {
        return listingHtmlWithoutIndiaJobs
      }

      throw new Error(`Unexpected Aiven URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
