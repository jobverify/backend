import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | Careers at Sodexo India</title>
  </head>
  <body>
    <nav>
      <a href="https://accesshr.in.sodexo.com/#/jobs">Join Our Team</a>
    </nav>
    <h1>We care about amazing people, like you</h1>
    <p>Take your next step with us</p>
  </body>
</html>
`

const accessHrLoginShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AccessHr</title>
  </head>
  <body>
    <h1>Log In</h1>
    <p>Please choose the connection mode that suits you.</p>
    <button>I have a Sodexo Email Address</button>
    <button>I do not have a Sodexo Email Address</button>
    <footer>Powered by mObilise</footer>
  </body>
</html>
`

const accessHrAppShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AccessHr</title>
    <base href="https://accesshr.in.sodexo.com/">
    <link rel="icon" type="image/x-icon" href="/assets/img/favicon.ico">
  </head>
  <body>
    <app-root></app-root>
    <script src="main.fd737a57e00cc417.js"></script>
  </body>
</html>
`

const loadSodexoIndiaModule = async () => {
  try {
    return await import('../../scraper/sodexoindia/script.js')
  } catch {
    assert.fail('Expected Sodexo India scraper module at ../../scraper/sodexoindia/script.js')
  }
}

test('Sodexo India scraper constants stay pinned to the verified careers page and AccessHr jobs handoff', async () => {
  const sodexoIndia = await loadSodexoIndiaModule()

  assert.equal(sodexoIndia.SOURCE, 'sodexoindia')
  assert.equal(sodexoIndia.COMPANY, 'Sodexo India')
  assert.equal(sodexoIndia.CAREERS_URL, 'https://www.sodexo.in/careers')
  assert.equal(sodexoIndia.ACCESS_HR_ROOT_URL, 'https://accesshr.in.sodexo.com/')
  assert.equal(sodexoIndia.ACCESS_HR_JOBS_URL, 'https://accesshr.in.sodexo.com/#/jobs')
  assert.equal(sodexoIndia.VERIFIED_AT, '2026-07-27')
  assert.equal(sodexoIndia.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(sodexoIndia.extractAccessHrJobsUrl(careersPageHtml), 'https://accesshr.in.sodexo.com/#/jobs')
  assert.equal(sodexoIndia.hasAccessHrLoginShellSignal(accessHrLoginShellHtml), true)
  assert.equal(sodexoIndia.hasAccessHrLoginShellSignal(accessHrAppShellHtml), true)
  assert.equal(sodexoIndia.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(
    sodexoIndia.hasUnexpectedPublicJobSurface({
      status: 200,
      html: '<html><body><h1>Current openings</h1><a href="/job/1">Apply now</a></body></html>',
    }),
    true,
  )
})

test('Sodexo India returns no jobs while AccessHr remains a verified login shell or timeout-only public surface', async () => {
  const sodexoIndia = await loadSodexoIndiaModule()
  const requestedUrls = []

  const loginShellJobs = await sodexoIndia.createSodexoIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sodexoIndia.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml, errorKind: null }
      }

      if (url === sodexoIndia.ACCESS_HR_ROOT_URL) {
        return { status: 200, url, html: accessHrLoginShellHtml, errorKind: null }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sodexoIndia.CAREERS_URL,
    sodexoIndia.ACCESS_HR_ROOT_URL,
  ])
  assert.deepEqual(loginShellJobs, [])

  const appShellJobs = await sodexoIndia.createSodexoIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === sodexoIndia.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml, errorKind: null }
      }

      if (url === sodexoIndia.ACCESS_HR_ROOT_URL) {
        return { status: 200, url, html: accessHrAppShellHtml, errorKind: null }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(appShellJobs, [])

  const timeoutJobs = await sodexoIndia.createSodexoIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === sodexoIndia.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml, errorKind: null }
      }

      if (url === sodexoIndia.ACCESS_HR_ROOT_URL) {
        return { status: null, url, html: null, errorKind: 'timeout' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(timeoutJobs, [])
})

test('Sodexo India fails closed when the careers handoff drifts or AccessHr starts exposing public job listings', async () => {
  const sodexoIndia = await loadSodexoIndiaModule()

  await assert.rejects(
    sodexoIndia.createSodexoIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === sodexoIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml.replace('https://accesshr.in.sodexo.com/#/jobs', 'https://example.com/jobs'),
            errorKind: null,
          }
        }

        return { status: 200, url, html: accessHrLoginShellHtml, errorKind: null }
      },
    }),
    /verified AccessHr jobs handoff/i,
  )

  await assert.rejects(
    sodexoIndia.createSodexoIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === sodexoIndia.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml, errorKind: null }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Current Openings</h1><a href="/job/42">Apply now</a></body></html>',
          errorKind: null,
        }
      },
    }),
    /public AccessHr jobs surface/i,
  )
})
