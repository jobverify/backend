import assert from 'node:assert/strict'
import test from 'node:test'

const LOCATION_PAGE_URL =
  'https://careers.unilever.com/en/location/india-jobs/34155/1269750/2/1'

const locationHtml = `
  <html>
    <head>
      <title>Search India Jobs at Unilever</title>
    </head>
    <body>
      <main>
        <h1>Jobs in India</h1>

        <a
          href="/en/job/chennai/territory-sales-officer/34155/98558111584"
          data-job-id="98558111584"
        >
          <h2 class="global-job-list__title">Territory Sales Officer</h2>
          <span class="job-location">Chennai, Tamil Nadu</span>
        </a>

        <a
          href="/en/job/chennai/territory-sales-officer/34155/98553005600"
          data-job-id="98553005600"
        >
          <h2 class="global-job-list__title">Territory Sales Officer</h2>
          <span class="job-location">Chennai, Tamil Nadu</span>
        </a>

        <a
          href="/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504"
          data-job-id="98129095504"
        >
          <h2 class="global-job-list__title">HR Capability and Culture Executive/Sr. Executive - B&amp;W</h2>
          <span class="job-location">Mumbai, Maharashtra, India</span>
        </a>
      </main>
    </body>
  </html>
`

const loadHindustanUnileverModule = async () => {
  try {
    return await import('../../scraper/hindustanunilever/script.js')
  } catch {
    assert.fail(
      'Expected Hindustan Unilever scraper module at ../../scraper/hindustanunilever/script.js',
    )
  }
}

test('Hindustan Unilever keeps the verified India location page contract', async () => {
  const hindustanUnilever = await loadHindustanUnileverModule()

  assert.equal(hindustanUnilever.SOURCE, 'hindustanunilever')
  assert.equal(hindustanUnilever.COMPANY, 'Hindustan Unilever Limited')
  assert.equal(hindustanUnilever.CAREERS_URL, LOCATION_PAGE_URL)
  assert.equal(hindustanUnilever.LOCATION_PAGE_URL, LOCATION_PAGE_URL)
  assert.equal(hindustanUnilever.hasOfficialCareersSignal(locationHtml), true)
})

test('Hindustan Unilever extracts real job ids and preserves duplicate title/location postings as distinct jobs', async () => {
  const { extractLocalJobs } = await loadHindustanUnileverModule()
  const jobs = extractLocalJobs(locationHtml)

  assert.deepEqual(jobs, [
    {
      jobId: '98558111584',
      title: 'Territory Sales Officer',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      sourceUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
      applyUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
    },
    {
      jobId: '98553005600',
      title: 'Territory Sales Officer',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      sourceUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98553005600',
      applyUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98553005600',
    },
    {
      jobId: '98129095504',
      title: 'HR Capability and Culture Executive/Sr. Executive - B&W',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      sourceUrl: 'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
      applyUrl: 'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
    },
  ])
})

test('Hindustan Unilever run keeps distinct live postings unique by job id', async () => {
  const { createHindustanUnileverScraper } = await loadHindustanUnileverModule()

  const jobs = await createHindustanUnileverScraper().run({
    fetchText: async (url) => {
      if (url === LOCATION_PAGE_URL) return locationHtml
      throw new Error(`Unexpected Hindustan Unilever fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      state: job.state,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        jobId: '98129095504',
        title: 'HR Capability and Culture Executive/Sr. Executive - B&W',
        state: 'Maharashtra',
        sourceUrl:
          'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
      },
      {
        jobId: '98558111584',
        title: 'Territory Sales Officer',
        state: 'Tamil Nadu',
        sourceUrl:
          'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
      },
      {
        jobId: '98553005600',
        title: 'Territory Sales Officer',
        state: 'Tamil Nadu',
        sourceUrl:
          'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98553005600',
      },
    ],
  )
})
