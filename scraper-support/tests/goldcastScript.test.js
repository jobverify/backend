import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Goldcast | The AI-first Video Content Platform for B2B Videos, Webinars, and Events</title>
  </head>
  <body>
    <main>
      <h1>You’re invisible without video</h1>
      <p>Goldcast’s agentic workflows put it at the heart of your GTM strategy.</p>
    </main>
    <footer>
      <p>Stay In Touch</p>
      <nav>
        <a href="/company/careers">Careers</a>
        <a href="/company/about">About</a>
      </nav>
      <p>© 2026 Copyright Goldcast, Inc. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Goldcast | The AI-first Video Content Platform for B2B Videos, Webinars, and Events</title>
  </head>
  <body>
    <main>
      <h1>You’re invisible without video</h1>
      <p>Goldcast’s agentic workflows put it at the heart of your GTM strategy—curating the right clips, making them production-ready, and keeping you in the spotlight.</p>
    </main>
    <footer>
      <p>Stay In Touch</p>
      <nav>
        <a href="/company/careers">Careers</a>
        <a href="/company/about">About</a>
      </nav>
      <p>© 2026 Copyright Goldcast, Inc. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join The Gold Standard of B2B Event Tech | Goldcast Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers @ Goldcast</h1>
      <p>Goldcast is a tailored B2B events platform that transforms marketing through the effortless hosting of engaging digital and in-person events.</p>
      <h2>Great team backed by exceptional investors/advisors</h2>
      <p>The Goldcast team is comprised of employees from leading companies like HBS, BCG, Davita, Jet, Walmart, and InMobi.</p>
      <h2>Opportunity to be part of rocket ship as an early team</h2>
      <p>We are growing rapidly and see an enormous potential in the market for disruption.</p>
      <h2>Autonomy</h2>
      <p>We believe in complete autonomy for teammates.</p>
      <h2>Great signs of success</h2>
      <p>Customers love our product, and in the last few weeks we have been overwhelmed by a huge number of inbound requests!</p>
    </main>
    <footer>
      <p>Stay In Touch</p>
      <a href="/company/careers">Careers</a>
      <p>© 2026 Copyright Goldcast, Inc. All rights reserved.</p>
      <p>marketing@goldcast.io</p>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join The Gold Standard of B2B Event Tech | Goldcast Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Product Marketer"}
    </script>
  </head>
  <body>
    <main>
      <h1>Careers @ Goldcast</h1>
      <p>Open positions</p>
      <a href="https://boards.greenhouse.io/goldcast/jobs/123">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/goldcast/script.js')
  } catch {
    assert.fail('Expected Goldcast scraper module at ../../scraper/goldcast/script.js')
  }
}

test('Goldcast helpers stay pinned to the verified no-public-jobs careers shell', async () => {
  const goldcast = await loadModule()

  assert.equal(goldcast.SOURCE, 'goldcast')
  assert.equal(goldcast.COMPANY, 'Goldcast')
  assert.equal(goldcast.HOMEPAGE_URL, 'https://www.goldcast.io/')
  assert.equal(goldcast.CAREERS_URL, 'https://www.goldcast.io/company/careers')
  assert.equal(goldcast.COMPANY_DOMAIN, 'goldcast.io')
  assert.equal(goldcast.VERIFIED_ON, '2026-07-16')
  assert.equal(goldcast.hasVerifiedGoldcastHomepageSignals(homepageHtml), true)
  assert.equal(goldcast.hasVerifiedGoldcastHomepageSignals(currentHomepageHtml), true)
  assert.equal(goldcast.hasVerifiedGoldcastCareersSignals(careersHtml), true)
  assert.equal(goldcast.hasPublicGoldcastJobSignals(careersHtml), false)
  assert.equal(goldcast.hasPublicGoldcastJobSignals(publicJobsHtml), true)
})

test('Goldcast returns [] while the verified first-party careers page remains informational only', async () => {
  const goldcast = await loadModule()
  const requestedUrls = []

  const jobs = await goldcast.createGoldcastScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === goldcast.HOMEPAGE_URL) return homepageHtml
      if (url === goldcast.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Goldcast URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    goldcast.HOMEPAGE_URL,
    goldcast.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Goldcast fails closed when the homepage or careers page drifts into a public jobs surface', async () => {
  const goldcast = await loadModule()

  await assert.rejects(
    goldcast.run({
      fetchText: async (url) => {
        if (url === goldcast.HOMEPAGE_URL) {
          return homepageHtml.replace('/company/careers', '/company/join-us')
        }
        if (url === goldcast.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected Goldcast URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    goldcast.run({
      fetchText: async (url) => {
        if (url === goldcast.HOMEPAGE_URL) return homepageHtml
        if (url === goldcast.CAREERS_URL) return '<html><body><h1>Different careers page</h1></body></html>'
        throw new Error(`Unexpected Goldcast URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    goldcast.run({
      fetchText: async (url) => {
        if (url === goldcast.HOMEPAGE_URL) return homepageHtml
        if (url === goldcast.CAREERS_URL) return publicJobsHtml
        throw new Error(`Unexpected Goldcast URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
