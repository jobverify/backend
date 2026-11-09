import assert from 'node:assert/strict'
import test from 'node:test'

const loadAtlanModule = async () => {
  try {
    return await import('../../scraper/atlan/script.js')
  } catch {
    assert.fail('Expected Atlan scraper module at ../../scraper/atlan/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head><title>Careers | Atlan</title></head>
    <body>
      <h1>Careers at Atlan</h1>
      <script type="module" src="/_astro/CareersJobListings.bBTkdBwm.js"></script>
      <script>
        fetch("https://api.ashbyhq.com/posting-api/job-board/atlan")
      </script>
      <a href="https://jobs.ashbyhq.com/atlan">See all jobs</a>
    </body>
  </html>
`

const currentCareersPageHtml = `
  <html>
    <head><title>Careers | Atlan</title></head>
    <body>
      <h1>Careers</h1>
      <p>Ready to apply? Browse open roles</p>
      <section>
        <h2>Open positions</h2>
        <p>Do your life's best work with us.</p>
        <p>Remote-first across 15+ countries</p>
        <p>Loading positions...</p>
      </section>
      <footer>[Website env: production]</footer>
    </body>
  </html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'atl-1',
      isListed: true,
      title: 'Software Engineer',
      department: 'Engineering',
      jobUrl: 'https://jobs.ashbyhq.com/atlan/atl-1',
      applyUrl: 'https://jobs.ashbyhq.com/atlan/atl-1/application',
      employmentType: 'FullTime',
      publishedAt: '2026-07-14T00:00:00.000Z',
      location: 'Bengaluru, India',
      address: {
        addressLocality: 'Bengaluru',
        addressRegion: 'Karnataka',
        addressCountry: 'India',
      },
      secondaryLocations: [],
      descriptionHtml: '<p>Build data products.</p>',
    },
    {
      id: 'atl-2',
      isListed: true,
      title: 'Revenue Operations Manager',
      department: 'Operations',
      jobUrl: 'https://jobs.ashbyhq.com/atlan/atl-2',
      applyUrl: 'https://jobs.ashbyhq.com/atlan/atl-2/application',
      employmentType: 'FullTime',
      publishedAt: '2026-07-14T00:00:00.000Z',
      location: 'New York, United States',
      address: {
        addressLocality: 'New York',
        addressRegion: 'New York',
        addressCountry: 'United States',
      },
      secondaryLocations: [],
      descriptionHtml: '<p>Support GTM systems.</p>',
    },
  ],
}

test('Atlan scraper pins the verified first-party careers surface and Ashby job-board API handoff', async () => {
  const atlan = await loadAtlanModule()

  assert.equal(atlan.CAREERS_PAGE_URL, 'https://atlan.com/careers/')
  assert.equal(atlan.ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/atlan')
  assert.equal(atlan.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(atlan.hasOfficialCareersSignal(currentCareersPageHtml), true)
  assert.equal(
    atlan.extractVerifiedAshbyJobBoardUrl(careersPageHtml),
    'https://api.ashbyhq.com/posting-api/job-board/atlan',
  )
})

test('Atlan run validates the official careers page and returns only listed India jobs from Ashby', async () => {
  const atlan = await loadAtlanModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await atlan.createAtlanScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      return currentCareersPageHtml
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ashbyPayload
    },
  })

  assert.deepEqual(requestedTexts, [atlan.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [atlan.ASHBY_JOB_BOARD_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer',
      company: 'Atlan',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'atl-1',
      requisitionId: 'atl-1',
      sourceUrl: 'https://jobs.ashbyhq.com/atlan/atl-1',
      applyUrl: 'https://jobs.ashbyhq.com/atlan/atl-1/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build data products.',
      source: 'atlan',
      link: 'https://jobs.ashbyhq.com/atlan/atl-1/application',
      scrapedAt: '2026-07-14T00:00:00.000Z',
    },
  ])
})

test('Atlan run fails closed when the official careers handoff changes', async () => {
  const atlan = await loadAtlanModule()

  await assert.rejects(
    atlan.createAtlanScraper().run({
      fetchText: async () => '<html><body><h1>Careers at Atlan</h1></body></html>',
      fetchJson: async () => ashbyPayload,
    }),
    /verified ashby job-board handoff/i,
  )
})
