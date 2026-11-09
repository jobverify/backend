import assert from 'node:assert/strict'
import test from 'node:test'

const searchHtml = `
<!doctype html>
<html>
  <body>
    <h1>Job Search Results</h1>
    <p>Search All Jobs</p>
    <p>Recruitment Fraud Alert</p>
    <a href="/search/jobs/in/country/india">India (4 jobs)</a>
  </body>
</html>
`

const indiaSearchHtml = `
<!doctype html>
<html>
  <body>
    <h1>India Careers</h1>
    <p>Country India (4 jobs)</p>
    <div class="jobs-section__item" id="R26_00002003">
      <div class="row">
        <div class="column">
          <h4 class="heading-5 space-xsmall">
            <a href="https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2">Senior Data Engineer-2</a>
          </h4>
          <div class="row">
            <div class="columns medium-7">Technology</div>
            <div class="columns medium-5 text-right">Hyderabad, TS, India</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Senior Data Engineer-2</h1>
    <p>
      Job ID: CDW-100
      Team: Data Engineering
      Focus Area: Data & Analytics
      Location: Bengaluru, India
      Remote Type: Hybrid
      Date Posted: 2026-07-01
      Description Build data platforms for India delivery teams.
      About Us
    </p>
  </body>
</html>
`

const legacyIndiaSearchHtml = `
<!doctype html>
<html>
  <body>
    <h1>Job Search Results</h1>
    <p>Country India (5 jobs)</p>
    <article>
      <a href="/search/jobs/senior-data-engineer-2">Senior Data Engineer-2</a>
      <h4>Job Search Results</h4>
      <p>Data &amp; Analytics</p>
      <p>Bengaluru, India</p>
    </article>
  </body>
</html>
`

const currentIndiaSearchHtml = `
<!doctype html>
<html>
  <body>
    <h1>Job Search Results</h1>
    <p>Country Canada (6 jobs ) India (6 jobs ) United Kingdom (16 jobs ) United States (64 jobs )</p>
    <div class="jobs-section__item" id="R26_00002054">
      <div class="row">
        <div class="column">
          <h4 class="heading-5 space-xsmall">
            <a href="https://www.cdwjobs.com/jobs/18030353-senior-consultant-qa">Senior Consultant-QA</a>
          </h4>
          <div class="row">
            <div class="columns medium-7">Delivery Engineering</div>
            <div class="columns medium-5 text-right">Bangalore, KA, India</div>
          </div>
        </div>
      </div>
    </div>
    <div class="jobs-section__item" id="R26_00002003">
      <div class="row">
        <div class="column">
          <h4 class="heading-5 space-xsmall">
            <a href="https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2">Senior Data Engineer-2</a>
          </h4>
          <div class="row">
            <div class="columns medium-7">Technology</div>
            <div class="columns medium-5 text-right">Hyderabad, TS, India</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const blockedChallengeHtml = `
<!doctype html>
<html>
  <body>
    <h1>Just a moment...</h1>
    <p>Enable JavaScript and cookies to continue</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cdw/script.js')
  } catch {
    assert.fail('Expected CDW scraper module at ../../scraper/cdw/script.js')
  }
}

test('CDW parses the verified search results and India job details', async () => {
  const cdw = await loadModule()

  assert.equal(cdw.hasOfficialSearchResultsSignal(searchHtml), true)
  assert.equal(cdw.extractIndiaSearchUrl(searchHtml), cdw.INDIA_SEARCH_URL)
  assert.equal(cdw.hasOfficialIndiaResultsSignal(indiaSearchHtml), true)

  const jobs = await cdw.createCdwScraper({
    now: () => '2026-07-24T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === cdw.SEARCH_URL) return searchHtml
      if (url === cdw.INDIA_SEARCH_URL) return indiaSearchHtml
      if (url === 'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2') return detailHtml
      throw new Error(`Unexpected CDW URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Data Engineer-2')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].department, 'Data & Analytics')
  assert.equal(jobs[0].jobId, 'CDW-100')
})

test('CDW can recover with browser-backed listing and detail pages when direct requests are blocked', async () => {
  const cdw = await loadModule()
  const browserUrls = []

  const jobs = await cdw.createCdwScraper({
    now: () => '2026-07-24T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new Error(`HTTP 403 for ${cdw.SEARCH_URL}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)

      if (url === cdw.SEARCH_URL) return searchHtml
      if (url === cdw.INDIA_SEARCH_URL) return indiaSearchHtml
      if (url === 'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2') return detailHtml
      throw new Error(`Unexpected browser CDW URL: ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [
    cdw.SEARCH_URL,
    cdw.INDIA_SEARCH_URL,
    'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Data Engineer-2')
})

test('CDW accepts the current jobs-section layout and broader India country counts', async () => {
  const cdw = await loadModule()

  assert.equal(cdw.hasOfficialSearchResultsSignal(currentIndiaSearchHtml), true)
  assert.deepEqual(cdw.extractListingCards(currentIndiaSearchHtml), [
    {
      title: 'Senior Consultant-QA',
      detailUrl: 'https://www.cdwjobs.com/jobs/18030353-senior-consultant-qa',
      focusArea: 'Delivery Engineering',
      location: 'Bangalore, KA, India',
    },
    {
      title: 'Senior Data Engineer-2',
      detailUrl: 'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2',
      focusArea: 'Technology',
      location: 'Hyderabad, TS, India',
    },
  ])
})

test('CDW still accepts legacy article-based India result cards when the first-party page renders them directly', async () => {
  const cdw = await loadModule()

  assert.equal(cdw.hasOfficialSearchResultsSignal(legacyIndiaSearchHtml), true)
  assert.equal(cdw.hasOfficialIndiaResultsSignal(legacyIndiaSearchHtml), true)
  assert.deepEqual(cdw.extractListingCards(legacyIndiaSearchHtml), [
    {
      title: 'Senior Data Engineer-2',
      detailUrl: 'https://www.cdwjobs.com/search/jobs/senior-data-engineer-2',
      focusArea: 'Data & Analytics',
      location: 'Bengaluru, India',
    },
  ])
})

test('CDW accepts the live blocked search and India routes as a trusted empty state', async () => {
  const cdw = await loadModule()
  const requestedUrls = []

  assert.equal(cdw.hasBlockedSearchSurfaceSignal(blockedChallengeHtml), true)

  const jobs = await cdw.createCdwScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        html: blockedChallengeHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [cdw.SEARCH_URL, cdw.INDIA_SEARCH_URL])
  assert.deepEqual(jobs, [])
})
