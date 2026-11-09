import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>First choice for last-mile | FarEye</title>
  </head>
  <body>
    <nav>
      <a href="https://fareye.com/about/careers">Careers</a>
    </nav>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | FarEye</title>
    <link rel="canonical" href="https://fareye.com/about/careers">
  </head>
  <body>
    <div>Who is FarEye?</div>
    <h2>We’re problem-solvers, thinkers, and intrapreneurs.</h2>
    <p>We’re looking for the dreamers, the thinkers, the doers that want to advance last-mile delivery technology and their careers. Explore our open positions.</p>
    <a class="btn" href="https://fareye.darwinbox.in/ms/candidate/careers" target="_blank">Join us</a>
    <a class="btn -outlined" href="https://fareye.darwinbox.in/ms/candidate/careers" target="_blank">Explore open positions</a>
  </body>
</html>
`

const darwinboxHomeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Darwinbox - HR Software | New-Age HR Management Software</title>
  </head>
  <body>
    <h1>Darwinbox</h1>
  </body>
</html>
`

const legacyShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
  </head>
  <body>
    <script type="text/javascript" src="runtime.fd23fb30dac292f622bc.js"></script>
    <script type="text/javascript" src="polyfills.c6a4a70db06b88215285.js"></script>
    <script type="text/javascript" src="scripts.5b47f77556b9d5487785.js"></script>
    <script type="text/javascript" src="main.38495915aab0be25d160.js"></script>
  </body>
</html>
`

const candidateV2ShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
    <base href="/ms/candidatev2/">
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.1da44beccc313d1d.js" type="module"></script>
    <script src="polyfills.6a944452d3a84456.js" type="module"></script>
    <script src="scripts.858dff6e5f31e4c5.js" defer></script>
    <script src="main.4be3f8160d5f33d4.js" type="module"></script>
  </body>
</html>
`

const brokenApiBody = '{"status":"error","data":{"message":"Internal Server Error - Error while getting tenant info"}}'

const loadModule = async () => {
  try {
    return await import('../../scraper/fareye/script.js')
  } catch {
    assert.fail('Expected FarEye scraper module at ../../scraper/fareye/script.js')
  }
}

test('FarEye helpers stay pinned to the verified official careers handoff and broken Darwinbox public surface', async () => {
  const farEye = await loadModule()

  assert.equal(farEye.SOURCE, 'fareye')
  assert.equal(farEye.COMPANY, 'FarEye')
  assert.equal(farEye.HOMEPAGE_URL, 'https://fareye.com/')
  assert.equal(farEye.OFFICIAL_CAREERS_URL, 'https://fareye.com/about/careers')
  assert.equal(farEye.OFFICIAL_DARWINBOX_HANDOFF_URL, 'https://fareye.darwinbox.in/ms/candidate/careers')
  assert.equal(farEye.DARWINBOX_JOBS_URL, 'https://fareye.darwinbox.in/jobs')
  assert.deepEqual(farEye.DARWINBOX_SHELL_ROUTE_URLS, [
    'https://fareye.darwinbox.in/ms/candidate/careers',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(farEye.DARWINBOX_LISTING_API_URL, 'https://fareye.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(farEye.DARWINBOX_COMPANY_CONFIG_URL, 'https://fareye.darwinbox.in/ms/candidateapi/getCompanyConfig')
  assert.equal(farEye.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(farEye.extractOfficialDarwinboxUrl(careersHtml), farEye.OFFICIAL_DARWINBOX_HANDOFF_URL)
  assert.equal(farEye.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    farEye.hasDarwinboxLoginRedirectSignal({
      status: 200,
      url: 'https://darwinbox.com/',
      html: darwinboxHomeHtml,
    }),
    true,
  )
  assert.equal(farEye.hasMinimalDarwinboxShellSignal(legacyShellHtml), true)
  assert.equal(farEye.hasMinimalDarwinboxShellSignal(candidateV2ShellHtml), true)
  assert.equal(farEye.hasBrokenDarwinboxApiSignal({ status: 500, body: brokenApiBody }), true)
})

test('FarEye returns [] only while the verified official careers page still points to a non-functional public Darwinbox surface', async () => {
  const farEye = await loadModule()
  const requestedPageUrls = []
  const requestedApiUrls = []

  const jobs = await farEye.createFarEyeScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === farEye.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === farEye.OFFICIAL_CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === farEye.DARWINBOX_JOBS_URL) {
        return { status: 200, url: 'https://darwinbox.com/', html: darwinboxHomeHtml }
      }

      if (url === farEye.DARWINBOX_SHELL_ROUTE_URLS[0]) {
        return { status: 200, url, html: legacyShellHtml }
      }

      if (farEye.DARWINBOX_SHELL_ROUTE_URLS.slice(1).includes(url)) {
        return { status: 200, url, html: candidateV2ShellHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    probeApi: async (url) => {
      requestedApiUrls.push(url)
      return { status: 500, body: brokenApiBody }
    },
  })

  assert.deepEqual(requestedPageUrls, [
    farEye.HOMEPAGE_URL,
    farEye.OFFICIAL_CAREERS_URL,
    farEye.DARWINBOX_JOBS_URL,
    ...farEye.DARWINBOX_SHELL_ROUTE_URLS,
  ])
  assert.deepEqual(requestedApiUrls, [
    farEye.DARWINBOX_LISTING_API_URL,
    farEye.DARWINBOX_COMPANY_CONFIG_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('FarEye fails closed when the first-party careers page, Darwinbox redirect, shell, or broken API contract drifts', async () => {
  const farEye = await loadModule()

  await assert.rejects(
    farEye.createFarEyeScraper().run({
      fetchPage: async (url) => {
        if (url === farEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return {
          status: 200,
          url,
          html: careersHtml.replace('Explore open positions', 'Browse roles'),
        }
      },
      probeApi: async () => ({ status: 500, body: brokenApiBody }),
    }),
    /official careers page no longer matches/i,
  )

  await assert.rejects(
    farEye.createFarEyeScraper().run({
      fetchPage: async (url) => {
        if (url === farEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === farEye.OFFICIAL_CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === farEye.DARWINBOX_JOBS_URL) {
          return { status: 200, url, html: candidateV2ShellHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeApi: async () => ({ status: 500, body: brokenApiBody }),
    }),
    /darwinbox jobs redirect no longer matches/i,
  )

  await assert.rejects(
    farEye.createFarEyeScraper().run({
      fetchPage: async (url) => {
        if (url === farEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === farEye.OFFICIAL_CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === farEye.DARWINBOX_JOBS_URL) {
          return { status: 200, url: 'https://darwinbox.com/', html: darwinboxHomeHtml }
        }

        if (url === farEye.DARWINBOX_SHELL_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><title>Jobs</title><body>Current Openings</body></html>' }
        }

        if (farEye.DARWINBOX_SHELL_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: candidateV2ShellHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeApi: async () => ({ status: 500, body: brokenApiBody }),
    }),
    /darwinbox shell route no longer matches/i,
  )

  await assert.rejects(
    farEye.createFarEyeScraper().run({
      fetchPage: async (url) => {
        if (url === farEye.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === farEye.OFFICIAL_CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === farEye.DARWINBOX_JOBS_URL) {
          return { status: 200, url: 'https://darwinbox.com/', html: darwinboxHomeHtml }
        }

        if (url === farEye.DARWINBOX_SHELL_ROUTE_URLS[0]) {
          return { status: 200, url, html: legacyShellHtml }
        }

        if (farEye.DARWINBOX_SHELL_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: candidateV2ShellHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeApi: async (url) => ({
        status: url === farEye.DARWINBOX_LISTING_API_URL ? 200 : 500,
        body: url === farEye.DARWINBOX_LISTING_API_URL ? '{"status":"ok","data":[]}' : brokenApiBody,
      }),
    }),
    /darwinbox listing api no longer matches/i,
  )
})
