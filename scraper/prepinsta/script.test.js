import assert from 'node:assert/strict'
import test from 'node:test'

const loadPrepinstaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected PrepInsta scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>PrepInsta Career Opportunities</title>
  </head>
  <body>
    <main>
      <h2>Join Our Team</h2>
      <p>Join us, on our journey to help upskill students and get them placed</p>
      <a href="https://angel.co/company/prepinsta">Start Your Career With Us</a>
      <h2>All Open Positions</h2>
      <a href="https://angel.co/company/prepinsta/jobs">Click Here to Check</a>
    </main>
  </body>
</html>
`

const blockedPublicJobsPage = {
  status: 403,
  url: 'https://wellfound.com/company/prepinsta/jobs',
  html: `
    <html lang="en">
      <head><title>wellfound.com</title></head>
      <body>
        <p>Please enable JS and disable any ad blocker</p>
      </body>
    </html>
  `,
}

const currentBlockedPublicJobsPage = {
  status: 403,
  url: 'https://wellfound.com/company/prepinsta/jobs',
  headers: {
    server: 'cloudflare',
    'cf-mitigated': 'challenge',
  },
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <meta charset="UTF-8" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Security Check | Wellfound</title>
      </head>
      <body>
        <p>Before you continue, please verify your request.</p>
        <p>Enable JavaScript and cookies to continue</p>
        <p>Cloudflare Ray ID: 1234567890abcdef</p>
        <script>
          window._cf_chl_opt = { cZone: 'wellfound.com' }
        </script>
        <script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>
      </body>
    </html>
  `,
}

const publicEmptyJobsPage = {
  status: 200,
  url: 'https://wellfound.com/company/prepinsta/jobs',
  html: `
    <html>
      <head><title>Jobs at PrepInsta: Explore current Opportunities</title></head>
      <body>
        <p>Follow Create job alert</p>
        <p>View 0 jobs</p>
        <h1>Jobs at PrepInsta</h1>
        <p>PrepInsta hasn't added any jobs yet</p>
        <p>Get notified when PrepInsta posts new jobs.</p>
      </body>
    </html>
  `,
}

test('PrepInsta scraper pins the verified official careers page and blocked Wellfound handoff', async () => {
  const prepinsta = await loadPrepinstaModule()

  assert.equal(prepinsta.SOURCE, 'prepinsta')
  assert.equal(prepinsta.COMPANY, 'PrepInsta')
  assert.equal(prepinsta.CAREERS_URL, 'https://prepinsta.com/career-opportunities/')
  assert.equal(prepinsta.START_CAREER_URL, 'https://angel.co/company/prepinsta')
  assert.equal(prepinsta.PUBLIC_JOBS_URL, 'https://angel.co/company/prepinsta/jobs')
  assert.equal(prepinsta.BLOCKED_PUBLIC_JOBS_FINAL_URL, 'https://wellfound.com/company/prepinsta/jobs')
  assert.equal(prepinsta.VERIFIED_ON, '2026-08-15')
  assert.equal(prepinsta.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    prepinsta.extractStartCareerUrl(officialCareersHtml),
    'https://angel.co/company/prepinsta',
  )
  assert.equal(
    prepinsta.extractPublicJobsUrl(officialCareersHtml),
    'https://angel.co/company/prepinsta/jobs',
  )
  assert.equal(prepinsta.hasBlockedPublicJobsSignal(blockedPublicJobsPage), true)
  assert.equal(prepinsta.hasBlockedPublicJobsSignal(currentBlockedPublicJobsPage), true)
  assert.equal(prepinsta.hasEmptyPublicJobsSignal(publicEmptyJobsPage), true)
})

test('PrepInsta scraper returns no jobs while the official Wellfound board stays blocked', async () => {
  const prepinsta = await loadPrepinstaModule()
  const requestedUrls = []

  const jobs = await prepinsta.createPrepinstaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === prepinsta.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === prepinsta.PUBLIC_JOBS_URL) {
        return blockedPublicJobsPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prepinsta.CAREERS_URL,
    prepinsta.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PrepInsta scraper returns no jobs while the Saturday, August 15, 2026 Cloudflare security check blocks the Wellfound board', async () => {
  const prepinsta = await loadPrepinstaModule()
  const requestedUrls = []

  const jobs = await prepinsta.createPrepinstaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === prepinsta.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === prepinsta.PUBLIC_JOBS_URL) {
        return currentBlockedPublicJobsPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prepinsta.CAREERS_URL,
    prepinsta.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PrepInsta scraper returns no jobs while the public Wellfound board is reachable and empty', async () => {
  const prepinsta = await loadPrepinstaModule()
  const requestedUrls = []

  const jobs = await prepinsta.createPrepinstaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === prepinsta.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === prepinsta.PUBLIC_JOBS_URL) {
        return publicEmptyJobsPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prepinsta.CAREERS_URL,
    prepinsta.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PrepInsta scraper keeps the verified empty-board sentinel when the official careers page times out but the public Wellfound board is still readable and empty', async () => {
  const prepinsta = await loadPrepinstaModule()
  const requestedUrls = []

  const jobs = await prepinsta.createPrepinstaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === prepinsta.CAREERS_URL) {
        throw new Error(
          'fetch failed | Connect Timeout Error (attempted addresses: 52.85.47.24:443, 52.85.47.33:443, timeout: 10000ms)',
        )
      }

      if (url === prepinsta.PUBLIC_JOBS_URL) {
        return publicEmptyJobsPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    prepinsta.CAREERS_URL,
    prepinsta.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PrepInsta scraper preserves the same-day verified empty-board sentinel when both the careers page and Wellfound handoff are timeout-blocked', async () => {
  const prepinsta = await loadPrepinstaModule()
  const requestedUrls = []

  const jobs = await prepinsta.createPrepinstaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw new Error(
        `fetch failed | Connect Timeout Error (attempted address: ${url.includes('wellfound') ? 'wellfound.com:443' : 'prepinsta.com:443'}, timeout: 10000ms)`,
      )
    },
  })

  assert.deepEqual(requestedUrls, [
    prepinsta.CAREERS_URL,
    prepinsta.PUBLIC_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PrepInsta scraper fails closed when the verified careers handoff changes', async () => {
  const prepinsta = await loadPrepinstaModule()

  await assert.rejects(
    prepinsta.createPrepinstaScraper().run({
      fetchPage: async (url) => {
        if (url === prepinsta.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(
              'https://angel.co/company/prepinsta/jobs',
              'https://angel.co/company/prepinsta/roles',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public jobs handoff/i,
  )
})

test('PrepInsta scraper fails closed when the public jobs surface stops matching the blocked state', async () => {
  const prepinsta = await loadPrepinstaModule()

  await assert.rejects(
    prepinsta.createPrepinstaScraper().run({
      fetchPage: async (url) => {
        if (url === prepinsta.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === prepinsta.PUBLIC_JOBS_URL) {
          return {
            status: 200,
            url: prepinsta.BLOCKED_PUBLIC_JOBS_FINAL_URL,
            html: `
              <html>
                <body>
                  <h1>PrepInsta Jobs</h1>
                  <a href="/company/prepinsta/jobs/1">Software Engineer</a>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface now appears usable or changed shape/i,
  )
})
