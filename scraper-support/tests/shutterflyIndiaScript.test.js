import assert from 'node:assert/strict'
import test from 'node:test'

const OVERVIEW_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Overview | SHUTTERFLY</title>
  </head>
  <body>
    <nav>
      <a href="/overview/">Overview</a>
      <a href="https://shutterflycareers.ttcportals.com/">Careers</a>
    </nav>
    <h2>Careers</h2>
    <p>Wants to join our team ?</p>
    <p>Search our job openings to find a role that's right for you.</p>
    <a href="https://jobs.jobvite.com/shutterfly">Join our team</a>
  </body>
</html>
`

const CAREERS_CHALLENGE_PAGE = {
  status: 403,
  url: 'https://shutterflycareers.ttcportals.com/?p=jobs&nl=1',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Just a moment...</title>
      </head>
      <body>
        <main>
          <p>Enable JavaScript and cookies to continue</p>
        </main>
      </body>
    </html>
  `,
}

const SEARCH_RESULTS_CHALLENGE_PAGE = {
  status: 403,
  url: 'https://shutterflycareers.ttcportals.com/search/jobs',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Just a moment...</title>
      </head>
      <body>
        <main>
          <p>Enable JavaScript and cookies to continue</p>
        </main>
      </body>
    </html>
  `,
}

const SEARCH_RESULTS_WITH_INDIA_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search Results</title>
  </head>
  <body>
    <h1>Job Search Results</h1>
    <p>Showing 1-25 of 491 results</p>
    <h4>Country</h4>
    <p>Canada 2 jobs</p>
    <p>India 1 jobs</p>
    <p>United States 488 jobs</p>
    <article>
      <h2>Software Engineer</h2>
      <p>Location: Bengaluru, Karnataka, India</p>
    </article>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/shutterflyindia/script.js')
  } catch {
    assert.fail('Expected Shutterfly India scraper module at ../../scraper/shutterflyindia/script.js')
  }
}

test('Shutterfly India helpers stay pinned to the verified overview page and Cloudflare-challenged TTC careers surfaces', async () => {
  const shutterflyIndia = await loadScriptModule()

  assert.equal(shutterflyIndia.SOURCE, 'shutterflyindia')
  assert.equal(shutterflyIndia.COMPANY, 'Shutterfly India')
  assert.equal(shutterflyIndia.OFFICIAL_BRAND_NAME, 'Shutterfly')
  assert.equal(shutterflyIndia.VERIFIED_ON, '2026-07-27')
  assert.equal(shutterflyIndia.OVERVIEW_URL, 'https://shutterflyinc.com/overview/')
  assert.equal(shutterflyIndia.CAREERS_ENTRY_URL, 'https://jobs.jobvite.com/shutterfly')
  assert.equal(
    shutterflyIndia.SEARCH_RESULTS_URL,
    'https://shutterflycareers.ttcportals.com/search/jobs',
  )
  assert.equal(shutterflyIndia.hasOfficialOverviewSignal(OVERVIEW_HTML), true)
  assert.equal(typeof shutterflyIndia.hasVerifiedCloudflareChallengeSignal, 'function')
  assert.equal(shutterflyIndia.hasVerifiedCloudflareChallengeSignal(CAREERS_CHALLENGE_PAGE), true)
  assert.equal(
    shutterflyIndia.hasVerifiedCloudflareChallengeSignal(SEARCH_RESULTS_CHALLENGE_PAGE),
    true,
  )
  assert.equal(shutterflyIndia.hasIndiaJobsSignal(OVERVIEW_HTML), false)
  assert.equal(shutterflyIndia.hasIndiaJobsSignal(CAREERS_CHALLENGE_PAGE.html), false)
  assert.equal(shutterflyIndia.hasIndiaJobsSignal(SEARCH_RESULTS_WITH_INDIA_HTML), true)
})

test('Shutterfly India returns [] only while the verified official overview is live and both TTC job routes remain Cloudflare-challenged', async () => {
  const shutterflyIndia = await loadScriptModule()
  const requestedUrls = []

  const jobs = await shutterflyIndia.createShutterflyIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, shutterflyIndia.OVERVIEW_URL)
      return OVERVIEW_HTML
    },
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === shutterflyIndia.CAREERS_ENTRY_URL) return CAREERS_CHALLENGE_PAGE
      if (url === shutterflyIndia.SEARCH_RESULTS_URL) return SEARCH_RESULTS_CHALLENGE_PAGE
      throw new Error(`Unexpected Shutterfly India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shutterflyIndia.OVERVIEW_URL,
    shutterflyIndia.CAREERS_ENTRY_URL,
    shutterflyIndia.SEARCH_RESULTS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Shutterfly India fails closed when the verified overview drifts or a TTC route stops matching the challenge contract or exposes India jobs', async () => {
  const shutterflyIndia = await loadScriptModule()

  await assert.rejects(
    shutterflyIndia.createShutterflyIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchPage: async () => CAREERS_CHALLENGE_PAGE,
    }),
    /verified official overview page/i,
  )

  await assert.rejects(
    shutterflyIndia.createShutterflyIndiaScraper().run({
      fetchText: async () => OVERVIEW_HTML,
      fetchPage: async (url) => {
        if (url === shutterflyIndia.CAREERS_ENTRY_URL) {
          return {
            status: 200,
            url: 'https://shutterflycareers.ttcportals.com/?p=jobs&nl=1',
            html: '<html><body><h1>Careers at Shutterfly</h1><p>Where We Work</p></body></html>',
          }
        }
        return SEARCH_RESULTS_CHALLENGE_PAGE
      },
    }),
    /verified careers entry page/i,
  )

  await assert.rejects(
    shutterflyIndia.createShutterflyIndiaScraper().run({
      fetchText: async () => OVERVIEW_HTML,
      fetchPage: async (url) => {
        if (url === shutterflyIndia.CAREERS_ENTRY_URL) return CAREERS_CHALLENGE_PAGE
        return {
          status: 200,
          url,
          html: SEARCH_RESULTS_WITH_INDIA_HTML,
        }
      },
    }),
    /public India jobs/i,
  )
})
