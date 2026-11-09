import assert from 'node:assert/strict'
import test from 'node:test'

const loadHindustanUnileverModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Hindustan Unilever scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search India Jobs at Unilever</title>
  </head>
  <body>
    <main>
      <h2 class="search-results__heading">Jobs in India</h2>
      <ul class="global-job-list">
        <li>
          <a href="/en/job/bengaluru/assistant-manager-it-controls-sme/34155/98568176624" data-job-id="98568176624">
            <h2 class="global-job-list__title">Assistant Manager - IT Controls SME</h2>
            <span class="job-location">Bengaluru, Karnataka</span>
          </a>
        </li>
        <li>
          <a href="/en/job/chennai/territory-sales-officer/34155/98558111584" data-job-id="98558111584">
            <h2 class="global-job-list__title">Territory Sales Officer</h2>
            <span class="job-location">Chennai, Tamil Nadu</span>
          </a>
        </li>
        <li>
          <a href="/en/job/kolkata/sr-strategic-account-executive/34155/98553005520" data-job-id="98553005520">
            <h2 class="global-job-list__title">Sr. Strategic Account Executive</h2>
            <span class="job-location">Kolkata, West Bengal</span>
          </a>
        </li>
        <li>
          <a href="/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504" data-job-id="98129095504">
            <h2 class="global-job-list__title">HR Capability and Culture Executive/Sr. Executive - B&amp;W</h2>
            <span class="job-location">Mumbai, Maharashtra</span>
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

test('Hindustan Unilever scraper validates the current official India careers surface', async () => {
  const hindustanUnilever = await loadHindustanUnileverModule()

  assert.equal(hindustanUnilever.SOURCE, 'hindustanunilever')
  assert.equal(hindustanUnilever.COMPANY, 'Hindustan Unilever Limited')
  assert.equal(
    hindustanUnilever.CAREERS_URL,
    'https://careers.unilever.com/en/location/india-jobs/34155/1269750/2/1',
  )
  assert.equal(
    hindustanUnilever.LOCATION_PAGE_URL,
    'https://careers.unilever.com/en/location/india-jobs/34155/1269750/2/1',
  )
  assert.equal(hindustanUnilever.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(
    hindustanUnilever.extractLocalJobs(officialCareersHtml).map((job) => ({
      title: job.title,
      location: job.location,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Assistant Manager - IT Controls SME',
        location: 'Bengaluru, Karnataka, India',
        applyUrl: 'https://careers.unilever.com/en/job/bengaluru/assistant-manager-it-controls-sme/34155/98568176624',
      },
      {
        title: 'Territory Sales Officer',
        location: 'Chennai, Tamil Nadu, India',
        applyUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
      },
      {
        title: 'Sr. Strategic Account Executive',
        location: 'Kolkata, West Bengal, India',
        applyUrl: 'https://careers.unilever.com/en/job/kolkata/sr-strategic-account-executive/34155/98553005520',
      },
      {
        title: 'HR Capability and Culture Executive/Sr. Executive - B&W',
        location: 'Mumbai, Maharashtra, India',
        applyUrl: 'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
      },
    ],
  )
})

test('Hindustan Unilever scraper returns the local jobs exposed on the current official India careers page', async () => {
  const hindustanUnilever = await loadHindustanUnileverModule()
  const requestedUrls = []

  const jobs = await hindustanUnilever.createHindustanUnileverScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hindustanUnilever.LOCATION_PAGE_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hindustanUnilever.LOCATION_PAGE_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Assistant Manager - IT Controls SME',
        location: 'Bengaluru, Karnataka, India',
        country: 'India',
        sourceUrl: 'https://careers.unilever.com/en/job/bengaluru/assistant-manager-it-controls-sme/34155/98568176624',
        applyUrl: 'https://careers.unilever.com/en/job/bengaluru/assistant-manager-it-controls-sme/34155/98568176624',
      },
      {
        title: 'HR Capability and Culture Executive/Sr. Executive - B&W',
        location: 'Mumbai, Maharashtra, India',
        country: 'India',
        sourceUrl: 'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
        applyUrl: 'https://careers.unilever.com/en/job/mumbai/hr-capability-and-culture-executive-sr-executive-b-and-w/34155/98129095504',
      },
      {
        title: 'Sr. Strategic Account Executive',
        location: 'Kolkata, West Bengal, India',
        country: 'India',
        sourceUrl: 'https://careers.unilever.com/en/job/kolkata/sr-strategic-account-executive/34155/98553005520',
        applyUrl: 'https://careers.unilever.com/en/job/kolkata/sr-strategic-account-executive/34155/98553005520',
      },
      {
        title: 'Territory Sales Officer',
        location: 'Chennai, Tamil Nadu, India',
        country: 'India',
        sourceUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
        applyUrl: 'https://careers.unilever.com/en/job/chennai/territory-sales-officer/34155/98558111584',
      },
    ],
  )
})

test('Hindustan Unilever scraper fails closed when the current official India careers surface changes', async () => {
  const hindustanUnilever = await loadHindustanUnileverModule()

  await assert.rejects(
    hindustanUnilever.createHindustanUnileverScraper().run({
      fetchText: async () => '<main><h1>India</h1><p>No local jobs section.</p></main>',
    }),
    /verified official india careers surface/i,
  )
})
