import assert from 'node:assert/strict'
import test from 'node:test'

const loadPivotricsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Pivotrics scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Welcome to Pivotrics | Software Product Engineering</title>
    <meta
      name="description"
      content="We build and run elite AI-native product engineering teams for payments and high-volume B2B SaaS — on Pivot Stack, our enterprise-grade application framework. Yours to own when you're ready."
    />
    <link rel="stylesheet" href="/_astro/BaseLayout.ZsT8gi-3.css" />
  </head>
  <body>
    <header>
      <nav>
        <a href="/#engagement">Services</a>
        <a href="/#system">Pivot System</a>
        <a href="/#markets">Domains</a>
        <a href="/#about">About us</a>
        <a href="/blog">Blog</a>
        <a href="/#contact">Connect with us</a>
      </nav>
    </header>
    <main>
      <h1>Offshore product teams - yours to own</h1>
      <p>
        AI raised the bar. We build the offshore team that clears it. We help global product
        companies build new offshore teams in India through Build-Operate-Transfer, or raise
        the performance of existing teams through Consulting.
      </p>
      <a href="mailto:info@pivotrics.com?subject=2-week%20Blueprint%20enquiry">Book a 2-week blueprint</a>
      <section>
        <h2>How we work - The Pivot System</h2>
        <p>One system. Three pillars. Everything we do runs on one operating system - the Pivot System.</p>
      </section>
      <section>
        <h2>About us</h2>
        <p>We build the team you can't hire on your own.</p>
      </section>
      <footer>
        <p>Prefer email? info@pivotrics.com</p>
        <p>pivotrics.com | pivotmodel.org</p>
        <p>Bengaluru, India | Lawrenceville, GA, USA</p>
        <p>Copyright 2026 Pivotrics Technologies LLP - The Pivot System - Model - Flow - Stack</p>
        <a href="https://pivotmodel.org">The Pivot Model field manual</a>
      </footer>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Pivotrics Careers</title>
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>
      <a href="https://jobs.lever.co/pivotrics/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Pivotrics sentinel pins the verified homepage and missing-route contract', async () => {
  const pivotrics = await loadPivotricsModule()

  assert.equal(pivotrics.SOURCE, 'pivotrics')
  assert.equal(pivotrics.COMPANY, 'Pivotrics')
  assert.equal(pivotrics.HOMEPAGE_URL, 'https://www.pivotrics.com/')
  assert.equal(pivotrics.ROBOTS_URL, 'https://www.pivotrics.com/robots.txt')
  assert.equal(pivotrics.SITEMAP_URL, 'https://www.pivotrics.com/sitemap.xml')
  assert.deepEqual(pivotrics.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.pivotrics.com/careers',
    'https://www.pivotrics.com/careers/',
    'https://www.pivotrics.com/career',
    'https://www.pivotrics.com/career/',
    'https://www.pivotrics.com/jobs',
    'https://www.pivotrics.com/jobs/',
    'https://www.pivotrics.com/join-us',
    'https://www.pivotrics.com/join-us/',
    'https://www.pivotrics.com/openings',
    'https://www.pivotrics.com/openings/',
    'https://www.pivotrics.com/hiring',
    'https://www.pivotrics.com/hiring/',
    'https://www.pivotrics.com/work-with-us',
    'https://www.pivotrics.com/work-with-us/',
  ])
  assert.deepEqual(pivotrics.VERIFIED_MISSING_ROUTE_URLS, [
    pivotrics.ROBOTS_URL,
    pivotrics.SITEMAP_URL,
    ...pivotrics.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.equal(pivotrics.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(pivotrics.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(pivotrics.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(
    pivotrics.isVerifiedMissingRoute({
      status: 404,
      url: pivotrics.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Pivotrics sentinel returns no jobs only while the verified first-party surface stays empty', async () => {
  const pivotrics = await loadPivotricsModule()
  const requestedUrls = []

  const jobs = await pivotrics.createPivotricsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pivotrics.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (pivotrics.VERIFIED_MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pivotrics.HOMEPAGE_URL,
    ...pivotrics.VERIFIED_MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Pivotrics sentinel fails closed when the homepage or any checked route changes materially', async () => {
  const pivotrics = await loadPivotricsModule()

  await assert.rejects(
    pivotrics.createPivotricsScraper().run({
      fetchPage: async (url) => {
        if (url === pivotrics.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    pivotrics.createPivotricsScraper().run({
      fetchPage: async (url) => {
        if (url === pivotrics.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${officialHomepageHtml}<a href="https://jobs.lever.co/pivotrics/platform-engineer">Careers</a>`,
          }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    pivotrics.createPivotricsScraper().run({
      fetchPage: async (url) => {
        if (url === pivotrics.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === pivotrics.ROBOTS_URL) {
          return { status: 200, url, html: 'User-agent: *\nAllow: /' }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /missing robots\.txt or sitemap surface changed/i,
  )

  await assert.rejects(
    pivotrics.createPivotricsScraper().run({
      fetchPage: async (url) => {
        if (url === pivotrics.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === pivotrics.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
