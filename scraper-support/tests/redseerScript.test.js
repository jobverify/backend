import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Join the Red Team | RedSeer</title>
    <meta
      name="description"
      content="Join RedSeer's team of consultants and help shape India's growth stories. Explore career opportunities and be part of our mission."
    />
  </head>
  <body>
    <h1>Challenge the Unchallenged</h1>
    <p>Work with a band of strategy consultants who have disrupted the 100+ year old legacy consulting industry</p>
    <h2>Job Openings</h2>
    <div class="careers-jobs-section">
      <div class="embed_jobs_head embed_jobs_with_style_1">
        <div class="embed_jobs_head2">
          <div class="embed_jobs_head3">
            <div id="rec_job_listing_div"></div>
          </div>
        </div>
      </div>
    </div>
    <h2>Campus Placements</h2>
    <p>This form is for placement cells. For job applications, please apply through the listings on this page.</p>
  </body>
</html>
`

const OFFICIAL_ARCHIVE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job openings Archive | Redseer Strategy Consultants</title>
    <link rel="canonical" href="https://redseer.com/jobopenings/" />
  </head>
  <body>
    <h1 class="heading">Job Openings</h1>
    <form class="openings-form" id="openings-form" method="get" action="/jobopenings/">
      <div class="filters">
        <select name="department" class="resizeselect">
          <option value="" selected>All industries</option>
          <option value="Consulting">Consulting</option>
          <option value="Sales - Marketing">Sales - Marketing</option>
          <option value="Finance">Finance</option>
          <option value="Benchmarks">Benchmarks</option>
        </select>
        <select name="location" class="resizeselect">
          <option value="" selected>Location</option>
          <option value="Bengaluru">Bengaluru</option>
          <option value="Gurgaon">Gurgaon</option>
          <option value="Singapore">Singapore</option>
          <option value="Dubai">Dubai</option>
        </select>
        <input class="search" value="" name="search" type="text" placeholder="Search" />
      </div>
    </form>
    <div class="job-openings">
    </div>
    <p id="insights-view-more">
      <a href="#" class="view-more-button">View More</a>
    </p>
  </body>
</html>
`

const ARCHIVE_WITH_JOBS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job openings Archive | Redseer Strategy Consultants</title>
    <link rel="canonical" href="https://redseer.com/jobopenings/" />
  </head>
  <body>
    <h1 class="heading">Job Openings</h1>
    <div class="job-openings">
      <article class="job-opening-card">
        <a href="https://redseer.com/jobopenings/senior-consultant/">
          <h3>Senior Consultant</h3>
        </a>
        <div class="job-meta">
          <span>Consulting</span>
          <span>Bengaluru</span>
        </div>
      </article>
    </div>
  </body>
</html>
`

const EMPTY_FEED_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Job openings Archive | Redseer Strategy Consultants</title>
    <link>https://redseer.com/jobopenings/</link>
    <description>Redseer Strategy Consultants</description>
    <lastBuildDate>Thu, 16 Jul 2026 09:51:08 +0000</lastBuildDate>
  </channel>
</rss>
`

const FEED_WITH_ITEM_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Job openings Archive | Redseer Strategy Consultants</title>
    <link>https://redseer.com/jobopenings/</link>
    <description>Redseer Strategy Consultants</description>
    <item>
      <title>Senior Consultant</title>
      <link>https://redseer.com/jobopenings/senior-consultant/</link>
    </item>
  </channel>
</rss>
`

const EMPTY_API_PAYLOAD = []
const API_WITH_JOB_PAYLOAD = [
  {
    id: 101,
    link: 'https://redseer.com/jobopenings/senior-consultant/',
    title: { rendered: 'Senior Consultant' },
  },
]

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/redseer/script.js')
  } catch {
    assert.fail('Expected Redseer scraper module at ../../scraper/redseer/script.js')
  }
}

test('Redseer sentinel helpers stay pinned to the verified official careers page and empty public job archive contract', async () => {
  const redseer = await loadScriptModule()

  assert.equal(redseer.SOURCE, 'redseer')
  assert.equal(redseer.COMPANY, 'Redseer')
  assert.equal(redseer.OFFICIAL_BRAND_NAME, 'RedSeer')
  assert.equal(redseer.VERIFIED_ON, '2026-07-17')
  assert.equal(redseer.HOMEPAGE_URL, 'https://redseer.com/')
  assert.equal(redseer.CAREERS_URL, 'https://redseer.com/careers/')
  assert.equal(redseer.PUBLIC_JOBS_ARCHIVE_URL, 'https://redseer.com/jobopenings/')
  assert.equal(redseer.JOBS_FEED_URL, 'https://redseer.com/jobopenings/feed/')
  assert.equal(redseer.JOBS_API_URL, 'https://redseer.com/wp-json/wp/v2/jobopenings?per_page=100')
  assert.equal(redseer.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(redseer.hasOfficialArchiveSignal(OFFICIAL_ARCHIVE_HTML), true)
  assert.equal(redseer.hasVisibleArchiveJobs(OFFICIAL_ARCHIVE_HTML), false)
  assert.equal(redseer.hasVisibleArchiveJobs(ARCHIVE_WITH_JOBS_HTML), true)
  assert.equal(redseer.hasEmptyJobFeedSignal(EMPTY_FEED_XML), true)
  assert.equal(redseer.hasEmptyJobFeedSignal(FEED_WITH_ITEM_XML), false)
  assert.equal(redseer.isEmptyJobsApiPayload(EMPTY_API_PAYLOAD), true)
  assert.equal(redseer.isEmptyJobsApiPayload(API_WITH_JOB_PAYLOAD), false)
})

test('Redseer returns [] only while the official careers page and first-party job archive remain verifiably empty', async () => {
  const redseer = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await redseer.createRedseerScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === redseer.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === redseer.PUBLIC_JOBS_ARCHIVE_URL) return OFFICIAL_ARCHIVE_HTML
      if (url === redseer.JOBS_FEED_URL) return EMPTY_FEED_XML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === redseer.JOBS_API_URL) return EMPTY_API_PAYLOAD
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    redseer.CAREERS_URL,
    redseer.PUBLIC_JOBS_ARCHIVE_URL,
    redseer.JOBS_FEED_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    redseer.JOBS_API_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Redseer fails closed when the verified official careers surface drifts or starts exposing public jobs', async () => {
  const redseer = await loadScriptModule()

  await assert.rejects(
    redseer.createRedseerScraper().run({
      fetchText: async (url) => {
        if (url === redseer.CAREERS_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        if (url === redseer.PUBLIC_JOBS_ARCHIVE_URL) return OFFICIAL_ARCHIVE_HTML
        return EMPTY_FEED_XML
      },
      fetchJson: async () => EMPTY_API_PAYLOAD,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    redseer.createRedseerScraper().run({
      fetchText: async (url) => {
        if (url === redseer.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === redseer.PUBLIC_JOBS_ARCHIVE_URL) return ARCHIVE_WITH_JOBS_HTML
        return EMPTY_FEED_XML
      },
      fetchJson: async () => EMPTY_API_PAYLOAD,
    }),
    /job archive now appears to expose public jobs/i,
  )

  await assert.rejects(
    redseer.createRedseerScraper().run({
      fetchText: async (url) => {
        if (url === redseer.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === redseer.PUBLIC_JOBS_ARCHIVE_URL) return OFFICIAL_ARCHIVE_HTML
        return FEED_WITH_ITEM_XML
      },
      fetchJson: async () => EMPTY_API_PAYLOAD,
    }),
    /job feed now appears to expose public jobs/i,
  )

  await assert.rejects(
    redseer.createRedseerScraper().run({
      fetchText: async (url) => {
        if (url === redseer.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === redseer.PUBLIC_JOBS_ARCHIVE_URL) return OFFICIAL_ARCHIVE_HTML
        return EMPTY_FEED_XML
      },
      fetchJson: async () => API_WITH_JOB_PAYLOAD,
    }),
    /job api now appears to expose public jobs/i,
  )
})
