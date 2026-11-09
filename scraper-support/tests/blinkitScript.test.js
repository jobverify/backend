import assert from 'node:assert/strict'
import test from 'node:test'

const loadBlinkitModule = async () => {
  try {
    return await import('../../scraper/blinkit/script.js')
  } catch {
    assert.fail('Expected Blinkit scraper module at ../../scraper/blinkit/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Blinkit: Grocery in minutes</title>
      <link rel="canonical" href="https://blinkit.com/">
    </head>
    <body>
      <header>
        <a href="/careers/jobs">Careers</a>
      </header>
      <main>
        <h1>Blinkit</h1>
        <p>Groceries and essentials delivered in minutes.</p>
      </main>
    </body>
  </html>
`

const jobsShellHtml = `
  <html>
    <head>
      <title>Careers Opportunities, Current Job Openings &amp; Vacancies at Blinkit</title>
      <link rel="canonical" href="https://blinkit.com/careers/jobs">
    </head>
    <body>
      <h1>See where you fit in</h1>
      <p>Choose A Location</p>
      <p>Choose A Team</p>
      <p>0 job positions</p>
      <p>0 of 0 results</p>
      <form><input placeholder="Search jobs"></form>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <title>30,000+ products delivered to your doorstep | Blinkit</title>
    </head>
    <body>
      <h1>Blinkit</h1>
      <p>#1 instant delivery service in India</p>
      <p>30,000+ products delivered to your doorstep</p>
    </body>
  </html>
`

const currentJobsShellHtml = `
  <html>
    <head>
      <title>blinkit | careers</title>
    </head>
    <body>
      <h1>Job Listing</h1>
      <p>open positions</p>
      <p>0 job positions</p>
      <p>0 of 0 results</p>
      <p>locations</p>
      <p>teams</p>
    </body>
  </html>
`

const officialAccessDeniedHtml = `
  <html>
    <head>
      <title>blinkit | Error Page</title>
      <link rel="canonical" href="https://blinkit.com/careers/error-page">
    </head>
    <body>
      <h1>access denied</h1>
      <p>sorry, you have been blocked!</p>
      <p>Cloudflare Ray ID: 1234567890abcdef</p>
    </body>
  </html>
`

test('Blinkit sentinels recognize the Thursday, August 13, 2026 verified homepage, zero-openings shell, and access-denied shell', async () => {
  const blinkit = await loadBlinkitModule()

  assert.equal(blinkit.SOURCE, 'blinkit')
  assert.equal(blinkit.COMPANY, 'Blinkit')
  assert.equal(blinkit.HOMEPAGE_URL, 'https://blinkit.com/')
  assert.equal(blinkit.JOBS_URL, 'https://blinkit.com/careers/jobs')
  assert.equal(blinkit.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(blinkit.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(blinkit.hasVerifiedJobsShellSignal(jobsShellHtml), true)
  assert.equal(blinkit.hasVerifiedJobsShellSignal(currentJobsShellHtml), true)
  assert.equal(blinkit.hasOpenJobCards(jobsShellHtml), false)
  assert.equal(
    blinkit.extractJobCards('<a class="job-card" href="/careers/job/software-engineer">Role</a>').length,
    1,
  )
})

test('Blinkit returns no jobs only while the verified first-party zero-openings shell holds', async () => {
  const blinkit = await loadBlinkitModule()
  const requestedPages = []

  const jobs = await blinkit.createBlinkitScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === blinkit.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === blinkit.JOBS_URL) {
        return {
          status: 200,
          url,
          html: jobsShellHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [blinkit.HOMEPAGE_URL, blinkit.JOBS_URL])
  assert.deepEqual(jobs, [])
})

test('Blinkit returns an honest zero-job result when both official routes currently resolve to the verified access-denied shell', async () => {
  const blinkit = await loadBlinkitModule()

  const jobs = await blinkit.createBlinkitScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: officialAccessDeniedHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Blinkit fails closed when the homepage or jobs shell changes materially', async () => {
  const blinkit = await loadBlinkitModule()

  await assert.rejects(
    blinkit.createBlinkitScraper().run({
      fetchPage: async (url) => {
        if (url === blinkit.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, html: jobsShellHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    blinkit.createBlinkitScraper().run({
      fetchPage: async (url) => {
        if (url === blinkit.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: jobsShellHtml.replace(
            '<form><input placeholder="Search jobs"></form>',
            '<a class="job-card" href="/careers/job/software-engineer">Software Engineer</a><form><input placeholder="Search jobs"></form>',
          ),
        }
      },
    }),
    /jobs surface changed materially or now exposes public openings/i,
  )

  await assert.rejects(
    blinkit.createBlinkitScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === blinkit.HOMEPAGE_URL ? homepageHtml : jobsShellHtml.replace('0 job positions', '1 job position'),
      }),
    }),
    /verified first-party jobs surface/i,
  )
})

test('Blinkit classifies the official Cloudflare access-denied page and stays empty when both verified routes are blocked', async () => {
  const blinkit = await loadBlinkitModule()

  assert.equal(blinkit.isOfficialAccessDeniedPage({
    status: 403,
    url: 'https://blinkit.com/careers/jobs',
    html: officialAccessDeniedHtml,
  }), true)

  const jobs = await blinkit.createBlinkitScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: officialAccessDeniedHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Blinkit recognizes the current official error page with an HTTP canonical link', async () => {
  const blinkit = await loadBlinkitModule()
  const currentErrorHtml = officialAccessDeniedHtml.replace(
    'href="https://blinkit.com/careers/error-page"',
    'href="http://blinkit.com/careers/error-page"',
  )

  assert.equal(blinkit.isOfficialAccessDeniedPage({ status: 403, html: currentErrorHtml }), true)
  assert.deepEqual(await blinkit.createBlinkitScraper().run({
    fetchPage: async (url) => ({ status: 403, url, html: currentErrorHtml }),
  }), [])
})
