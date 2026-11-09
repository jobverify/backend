import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rollbar | Error logging &amp; tracking service for software teams</title>
  </head>
  <body>
    <main>
      <h1>Every error. Every release.</h1>
      <p>Under control.</p>
      <p>Code-first observability that connects errors, replays, and releases in one place.</p>
    </main>
    <footer>
      <a href="./about-us">About us</a>
      <a href="./about-us#career">Careers</a>
      <a href="./contact-us">Contact us</a>
    </footer>
  </body>
</html>
`

const currentHomepageHtml = `
<html><head><title>Rollbar | Error Tracking Tool That Fixes Errors Too</title></head>
<body><main><h1>Every production error,<br>found and fixed.</h1>
<p>Rollbar is code-first observability. It starts at the code running in production.</p></main>
<footer><a href="./about-us#career">Careers</a></footer></body></html>
`

const aboutPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us: Meet the Rollbar Team | Rollbar</title>
  </head>
  <body>
    <main>
      <h1>We build what we believe in.</h1>
      <h2>Life at Rollbar.</h2>
      <h2>Benefits.</h2>
      <p>Join the Rollbar Team and help developers build better software faster, together.</p>
      <a href="./contact-us">Contact us</a>
    </main>
    <footer>
      <a href="./about-us">About us</a>
      <a href="./about-us#career">Careers</a>
      <a href="./contact-us">Contact us</a>
    </footer>
  </body>
</html>
`

const jobsSurfaceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rollbar Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="/jobs/senior-backend-engineer">Senior Backend Engineer</a>
    <a href="/apply">Apply now</a>
  </body>
</html>
`

const loadRollbarModule = async () => {
  try {
    return await import('../../scraper/rollbar/script.js')
  } catch {
    assert.fail('Expected Rollbar scraper module at ../../scraper/rollbar/script.js')
  }
}

test('Rollbar scraper helpers stay pinned to the verified first-party homepage and about-page careers sentinel', async () => {
  const rollbar = await loadRollbarModule()

  assert.equal(rollbar.SOURCE, 'rollbar')
  assert.equal(rollbar.COMPANY, 'Rollbar')
  assert.equal(rollbar.COMPANY_DOMAIN, 'rollbar.com')
  assert.equal(rollbar.HOMEPAGE_URL, 'https://rollbar.com/')
  assert.equal(rollbar.CAREERS_URL, 'https://rollbar.com/careers')
  assert.equal(rollbar.ABOUT_PAGE_URL, 'https://rollbar.com/about-us')
  assert.equal(rollbar.JOBS_PAGE_URL, 'https://rollbar.com/jobs')
  assert.equal(rollbar.CONTACT_PAGE_URL, 'https://rollbar.com/contact-us')
  assert.equal(rollbar.VERIFIED_AT, '2026-10-03')
  assert.equal(rollbar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rollbar.hasOfficialAboutPageSignal(aboutPageHtml), true)
  assert.equal(rollbar.hasLinkedTrustworthyPublicJobsSurface(homepageHtml), false)
  assert.equal(rollbar.hasLinkedTrustworthyPublicJobsSurface(aboutPageHtml), false)
  assert.equal(rollbar.hasLinkedTrustworthyPublicJobsSurface(jobsSurfaceHtml), true)
})

test('Rollbar recognizes the current homepage and still requires its careers handoff', async () => {
  const rollbar = await loadRollbarModule()
  assert.equal(rollbar.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(rollbar.hasOfficialHomepageSignal(currentHomepageHtml.replace('about-us#career', 'contact-us')), false)
})

test('Rollbar run returns [] while the verified homepage, careers redirect, and jobs redirect remain intact', async () => {
  const rollbar = await loadRollbarModule()
  const requestedUrls = []

  const jobs = await rollbar.createRollbarScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === rollbar.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === rollbar.CAREERS_URL) {
        return {
          status: 200,
          url: rollbar.ABOUT_PAGE_URL,
          html: aboutPageHtml,
        }
      }

      if (url === rollbar.JOBS_PAGE_URL) {
        return {
          status: 200,
          url: rollbar.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      throw new Error(`Unexpected URL requested during test: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    rollbar.HOMEPAGE_URL,
    rollbar.CAREERS_URL,
    rollbar.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Rollbar fails closed when the homepage drifts, the careers route stops resolving to the about page, or a public jobs surface appears', async () => {
  const rollbar = await loadRollbarModule()

  await assert.rejects(
    rollbar.createRollbarScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><title>Unexpected</title></html>',
      }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    rollbar.createRollbarScraper().run({
      fetchPage: async (url) => {
        if (url === rollbar.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === rollbar.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: aboutPageHtml,
          }
        }

        return {
          status: 200,
          url: rollbar.HOMEPAGE_URL,
          html: homepageHtml,
        }
      },
    }),
    /careers route/i,
  )

  await assert.rejects(
    rollbar.createRollbarScraper().run({
      fetchPage: async (url) => {
        if (url === rollbar.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === rollbar.CAREERS_URL) {
          return {
            status: 200,
            url: rollbar.ABOUT_PAGE_URL,
            html: jobsSurfaceHtml,
          }
        }

        return {
          status: 200,
          url: rollbar.HOMEPAGE_URL,
          html: homepageHtml,
        }
      },
    }),
    /public jobs surface/i,
  )
})
