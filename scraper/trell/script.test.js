import assert from 'node:assert/strict'
import test from 'node:test'

const loadTrellModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Trell scraper module at ./script.js')
  }
}

const companyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Trell | LinkedIn</title>
  </head>
  <body>
    <main>
      <p>Trell</p>
      <p>India's Largest Lifestyle Social Commerce platform. Empowering millions of storytellers &amp; Micro-Entrepreneurs.</p>
      <p>Bangalore, Karnataka</p>
      <a href="https://trell.co/">https://trell.co/</a>
      <div data-company-urn="urn:li:organization:10796691"></div>
    </main>
  </body>
</html>
`

const noMatchSearchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>LinkedIn</p>
      <p>Trell</p>
      <p>0 Jobs jobs in India</p>
      <p>You're now using AI-powered job search</p>
      <p>We couldn't find a match for Jobs jobs in India</p>
    </main>
  </body>
</html>
`

const searchResultsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>LinkedIn</p>
      <p>Trell</p>
      <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4431599124">
        <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/sample-trell-role-4431599124?position=1&amp;pageNum=0">
          <h3 class="base-search-card__title">Community Manager</h3>
        </a>
        <h4 class="base-search-card__subtitle"><a>Trell</a></h4>
        <span class="job-search-card__location">Bangalore, Karnataka, India</span>
        <time class="job-search-card__listdate" datetime="2026-07-30"></time>
      </div>
    </main>
  </body>
</html>
`

test('Trell accepts the current public LinkedIn company surface and zero-result India jobs shell', async () => {
  const trell = await loadTrellModule()

  assert.equal(trell.SOURCE, 'trell')
  assert.equal(trell.pageIndicatesTrellLinkedInCompany(companyPageHtml), true)
  assert.equal(trell.hasVerifiedLinkedInJobsPageSignal(noMatchSearchHtml), true)
  assert.deepEqual(trell.extractSearchResults(noMatchSearchHtml), [])
})

test('Trell extracts India job cards when LinkedIn exposes them', async () => {
  const trell = await loadTrellModule()
  const jobs = trell.extractSearchResults(searchResultsHtml)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Community Manager')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
})

test('Trell returns no jobs when the verified LinkedIn India search has no matches', async () => {
  const trell = await loadTrellModule()
  const requestedUrls = []

  const jobs = await trell.createTrellScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === trell.LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === trell.LINKEDIN_INDIA_JOBS_URL) return noMatchSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-02T20:15:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    trell.LINKEDIN_COMPANY_PAGE_URL,
    trell.LINKEDIN_INDIA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})
