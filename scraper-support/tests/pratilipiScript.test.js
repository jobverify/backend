import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Pratilipi - Read stories and write your own</title>
  </head>
  <body>
    <h1>Work with us</h1>
    <p>We are a diverse team of curious and creative people.</p>
    <a href="https://pratilipi.talentzq.io/careers" target="_blank" class="jobs">See Openings</a>
    <div>Nasadiya Technologies Private Limited</div>
  </body>
</html>
`

const TALENTZQ_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <base href="/" />
  </head>
  <body>
    <div id="app">
      <div class="spinner-main">
        <span class="loader-pulse online"></span>
      </div>
    </div>
    <div id="blazor-error-ui">
      An unhandled error has occurred.
      <a href class="reload">Reload</a>
    </div>
    <script src="_framework/blazor.webassembly.js"></script>
    <script>
      window.initPosthog = () => {};
    </script>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Jobs at Pratilipi</h1>
    <article class="job-card">
      <h2>Security Engineer</h2>
      <a href="/JobView/SECURITY1125">Apply now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pratilipi/script.js')
  } catch {
    assert.fail('Expected Pratilipi scraper module at ../../scraper/pratilipi/script.js')
  }
}

test('Pratilipi sentinel pins the verified official careers page and opaque TalentzQ shell contract', async () => {
  const pratilipi = await loadModule()

  assert.equal(pratilipi.SOURCE, 'pratilipi')
  assert.equal(pratilipi.COMPANY, 'Pratilipi')
  assert.equal(pratilipi.OFFICIAL_BRAND_NAME, 'Pratilipi')
  assert.equal(pratilipi.VERIFIED_ON, '2026-07-17')
  assert.equal(pratilipi.HOMEPAGE_URL, 'https://www.pratilipi.com/')
  assert.equal(pratilipi.OFFICIAL_CAREERS_URL, 'https://www.pratilipi.com/careers')
  assert.equal(pratilipi.OFFICIAL_CAREERS_HANDOFF_URL, 'https://pratilipi.talentzq.io/careers')
  assert.match(pratilipi.VERIFIED_SURFACE_SUMMARY, /opaque TalentzQ shell/i)
  assert.match(pratilipi.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(pratilipi.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(pratilipi.hasOfficialCareersPageSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(
    pratilipi.extractOfficialHandoffUrl(OFFICIAL_CAREERS_HTML),
    'https://pratilipi.talentzq.io/careers',
  )
  assert.equal(pratilipi.isOpaqueTalentzqShell(TALENTZQ_SHELL_HTML), true)
  assert.equal(pratilipi.isOpaqueTalentzqShell(PUBLIC_JOBS_HTML), false)
  assert.equal(pratilipi.hasPublicJobsSignal(TALENTZQ_SHELL_HTML), false)
  assert.equal(pratilipi.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('Pratilipi returns [] only while the official careers page still hands off to the opaque TalentzQ shell', async () => {
  const pratilipi = await loadModule()
  const requestedUrls = []

  const jobs = await pratilipi.createPratilipiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pratilipi.OFFICIAL_CAREERS_URL) {
        return OFFICIAL_CAREERS_HTML
      }

      if (url === pratilipi.OFFICIAL_CAREERS_HANDOFF_URL) {
        return TALENTZQ_SHELL_HTML
      }

      throw new Error(`Unexpected Pratilipi URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pratilipi.OFFICIAL_CAREERS_URL,
    pratilipi.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Pratilipi fails closed when the official page drifts or the TalentzQ handoff starts exposing public jobs', async () => {
  const pratilipi = await loadModule()

  await assert.rejects(
    pratilipi.createPratilipiScraper().run({
      fetchText: async (url) => {
        if (url === pratilipi.OFFICIAL_CAREERS_URL) {
          return OFFICIAL_CAREERS_HTML.replace(
            'https://pratilipi.talentzq.io/careers',
            'https://example.com/jobs',
          )
        }

        return TALENTZQ_SHELL_HTML
      },
    }),
    /official careers page/i,
  )

  await assert.rejects(
    pratilipi.createPratilipiScraper().run({
      fetchText: async (url) => {
        if (url === pratilipi.OFFICIAL_CAREERS_URL) {
          return OFFICIAL_CAREERS_HTML
        }

        return PUBLIC_JOBS_HTML
      },
    }),
    /public jobs/i,
  )

  await assert.rejects(
    pratilipi.createPratilipiScraper().run({
      fetchText: async (url) => {
        if (url === pratilipi.OFFICIAL_CAREERS_URL) {
          return OFFICIAL_CAREERS_HTML
        }

        return '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>'
      },
    }),
    /talentzq shell/i,
  )
})
