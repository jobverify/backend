import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <html>
    <head>
      <title>Nakul Satone</title>
      <meta property="og:url" content="https://www.protechsoft.in" />
      <link rel="canonical" href="https://www.protechsoft.in/" />
    </head>
    <body>
      <a href="/s/store">Courses</a>
      <h1>PRO-TECH</h1>
      <p>Software Solutions &amp; Computer Education</p>
      <h2>About us</h2>
      <p>Welcome to ProTech Software Institute, a trusted leader in programming and technical education for over 25 years.</p>
      <p>Join us at ProTech Software Institute and take your first step toward a brighter, tech-driven future!</p>
      <a href="/contactus">Contact us</a>
      <a href="/refundpolicy">Refund policy</a>
      <footer>Nakul Satone &copy; 2026</footer>
      <script>const customDomain = "www.protechsoft.in";</script>
    </body>
  </html>
`

const verifiedContactHtml = `
  <html>
    <head>
      <title>Contact Us</title>
      <link rel="canonical" href="https://www.protechsoft.in/contactus" />
    </head>
    <body>
      <h1>Contact us</h1>
      <form action="/enquiry" method="POST"></form>
      <a href="/s/store">Courses</a>
      <a href="/contactus">Contact us</a>
      <a href="/refundpolicy">Refund policy</a>
      <footer>Nakul Satone &copy; 2026</footer>
      <script>const customDomain = "www.protechsoft.in";</script>
    </body>
  </html>
`

const missingCareersHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Page Not Found</title>
    </head>
    <body class="is-wrapper">
      <h1>404</h1>
      <p>Oops! The page you're looking for doesn't exist.</p>
      <p><a class="gotohome" href="/" target="_top">HOMEPAGE</a></p>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/protechsoft/script.js')
  } catch {
    assert.fail('Expected Protechsoft scraper module at ../../scraper/protechsoft/script.js')
  }
}

test('Protechsoft sentinel recognizes the verified first-party homepage, contact page, and missing careers shell', async () => {
  const protechsoft = await loadModule()

  assert.equal(protechsoft.SOURCE, 'protechsoft')
  assert.equal(protechsoft.COMPANY, 'Protechsoft')
  assert.equal(protechsoft.HOMEPAGE_URL, 'https://www.protechsoft.in/')
  assert.equal(protechsoft.CONTACT_URL, 'https://www.protechsoft.in/contactus')
  assert.deepEqual(protechsoft.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.protechsoft.in/careers',
    'https://www.protechsoft.in/careers/',
    'https://www.protechsoft.in/career',
    'https://www.protechsoft.in/career/',
    'https://www.protechsoft.in/jobs',
    'https://www.protechsoft.in/jobs/',
    'https://www.protechsoft.in/job',
    'https://www.protechsoft.in/job/',
    'https://www.protechsoft.in/join-us',
    'https://www.protechsoft.in/join-us/',
  ])

  assert.equal(protechsoft.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(protechsoft.hasOfficialContactSignal(verifiedContactHtml), true)
  assert.equal(protechsoft.has404ShellSignal(missingCareersHtml), true)
  assert.equal(protechsoft.hasFirstPartyCareerLikeLink(verifiedHomepageHtml), false)
  assert.equal(protechsoft.hasFirstPartyCareerLikeLink(verifiedContactHtml), false)
  assert.equal(protechsoft.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(protechsoft.hasPublicJobsSignal(verifiedContactHtml), false)
  assert.equal(protechsoft.isVerifiedMissingCareersRoute({
    status: 200,
    url: 'https://www.protechsoft.in/careers',
    html: missingCareersHtml,
  }), true)
})

test('Protechsoft returns no jobs only while the verified first-party public surface exposes no careers board', async () => {
  const protechsoft = await loadModule()
  const requestedUrls = []

  const jobs = await protechsoft.createProtechsoftScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === protechsoft.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === protechsoft.CONTACT_URL) {
        return { status: 200, url, html: verifiedContactHtml }
      }

      if (protechsoft.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: missingCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    protechsoft.HOMEPAGE_URL,
    protechsoft.CONTACT_URL,
    ...protechsoft.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Protechsoft fails closed when the verified public surface drifts or starts exposing jobs', async () => {
  const protechsoft = await loadModule()

  await assert.rejects(
    protechsoft.createProtechsoftScraper().run({
      fetchPage: async (url) => {
        if (url === protechsoft.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    protechsoft.createProtechsoftScraper().run({
      fetchPage: async (url) => {
        if (url === protechsoft.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: verifiedHomepageHtml.replace('</body>', '<a href="/careers">Careers</a></body>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers or jobs link/i,
  )

  await assert.rejects(
    protechsoft.createProtechsoftScraper().run({
      fetchPage: async (url) => {
        if (url === protechsoft.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === protechsoft.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: verifiedContactHtml.replace('</body>', '<section><h2>Current Openings</h2></section></body>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact surface now exposes public jobs/i,
  )

  await assert.rejects(
    protechsoft.createProtechsoftScraper().run({
      fetchPage: async (url) => {
        if (url === protechsoft.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === protechsoft.CONTACT_URL) {
          return { status: 200, url, html: verifiedContactHtml }
        }

        if (url === protechsoft.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Open Positions</p></body></html>',
          }
        }

        if (protechsoft.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: missingCareersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
