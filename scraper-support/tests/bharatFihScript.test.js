import assert from 'node:assert/strict'
import test from 'node:test'

const blankDarwinboxShellHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title></title>
    <meta property="og:title" content=" " />
    <meta property="twitter:title" content=" " />
    <meta property="og:image" content="" />
    <meta property="twitter:image" content="" />
    <meta property="og:image:alt" content="" />
  </head>
  <body>
     -
  </body>
</html>
`

const angularDarwinboxShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title></title>
    <base href="/ms/candidatev2/">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
    <link rel="stylesheet" href="styles.d07b05aa0e0ef4c8.css">
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.1da44beccc313d1d.js" type="module"></script>
    <script src="main.4be3f8160d5f33d4.js" type="module"></script>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Bharat FIH Careers</title>
  </head>
  <body>
    <section>
      <h1>Current Openings</h1>
      <a href="https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/jobDetails/bf-001">Apply now</a>
    </section>
  </body>
</html>
`

const createTlsMismatchError = () => {
  const rootCause = new Error(
    'SEC_E_WRONG_PRINCIPAL (0x80090322) - The target principal name is incorrect.',
  )
  rootCause.code = 'ERR_TLS_CERT_ALTNAME_INVALID'

  const fetchError = new TypeError('fetch failed')
  fetchError.cause = rootCause
  return fetchError
}

const loadBharatFihModule = async () => {
  try {
    return await import('../../scraper/bharatfih/script.js')
  } catch {
    assert.fail('Expected Bharat FIH scraper module at ../../scraper/bharatfih/script.js')
  }
}

test('Bharat FIH sentinel constants stay pinned to the verified broken first-party and Darwinbox routes', async () => {
  const bharatFih = await loadBharatFihModule()

  assert.equal(bharatFih.SOURCE, 'bharatfih')
  assert.equal(bharatFih.COMPANY, 'Bharat FIH')
  assert.equal(bharatFih.VERIFIED_ON, '2026-07-19')
  assert.equal(bharatFih.HOMEPAGE_URL, 'https://bharatfih.com/')
  assert.equal(bharatFih.WWW_HOMEPAGE_URL, 'https://www.bharatfih.com/')
  assert.deepEqual(bharatFih.FIRST_PARTY_ROUTE_URLS, [
    'https://bharatfih.com/',
    'https://www.bharatfih.com/',
    'https://bharatfih.com/careers',
    'https://www.bharatfih.com/careers',
  ])
  assert.equal(bharatFih.DARWINBOX_JOBS_URL, 'https://bharatfih.darwinbox.in/jobs')
  assert.deepEqual(bharatFih.DARWINBOX_SHELL_ROUTE_URLS, [
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/allJobs',
    'https://bharatfih.darwinbox.in/ms/candidate/careers',
  ])
  assert.equal(
    bharatFih.DARWINBOX_LISTING_API_URL,
    'https://bharatfih.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.match(bharatFih.VERIFIED_SURFACE_SUMMARY, /invalid subdomain: bharatfih/i)
  assert.match(bharatFih.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(bharatFih.isTlsHostnameMismatchError(createTlsMismatchError()), true)
  assert.equal(bharatFih.isTlsHostnameMismatchError(new Error('ordinary network error')), false)
  assert.equal(bharatFih.hasBlankDarwinboxShellSignal(blankDarwinboxShellHtml), true)
  assert.equal(bharatFih.hasBlankDarwinboxShellSignal(angularDarwinboxShellHtml), true)
  assert.equal(bharatFih.hasBlankDarwinboxShellSignal(publicJobsHtml), false)
  assert.equal(
    bharatFih.hasLoginRedirectToDarwinboxHome({
      status: 200,
      url: 'https://darwinbox.com/',
      html: '<html><title>Darwinbox</title></html>',
    }),
    true,
  )
  assert.equal(
    bharatFih.hasInvalidDarwinboxSubdomainSignal({
      status: 500,
      body: '{"status":"error","data":{"message":"Internal Server Error - Invalid subdomain: bharatfih"}}',
    }),
    true,
  )
})

test('Bharat FIH sentinel returns [] only while the verified broken first-party and non-public Darwinbox state remains unchanged', async () => {
  const bharatFih = await loadBharatFihModule()
  const requestedOfficialRoutes = []
  const requestedPages = []
  const requestedApis = []

  const jobs = await bharatFih.createBharatFihScraper().run({
    probeOfficialRoute: async (url) => {
      requestedOfficialRoutes.push(url)
      throw createTlsMismatchError()
    },
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === bharatFih.DARWINBOX_JOBS_URL) {
        return {
          status: 200,
          url: 'https://darwinbox.com/',
          html: '<html><title>Darwinbox</title></html>',
        }
      }

      if (bharatFih.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: angularDarwinboxShellHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    probeListingApi: async (url) => {
      requestedApis.push(url)
      return {
        status: 500,
        body: '{"status":"error","data":{"message":"Internal Server Error - Invalid subdomain: bharatfih"}}',
      }
    },
  })

  assert.deepEqual(requestedOfficialRoutes, bharatFih.FIRST_PARTY_ROUTE_URLS)
  assert.deepEqual(requestedPages, [
    bharatFih.DARWINBOX_JOBS_URL,
    ...bharatFih.DARWINBOX_SHELL_ROUTE_URLS,
  ])
  assert.deepEqual(requestedApis, [bharatFih.DARWINBOX_LISTING_API_URL])
  assert.deepEqual(jobs, [])
})

test('Bharat FIH sentinel fails closed when the first-party site or Darwinbox tenant drifts materially', async () => {
  const bharatFih = await loadBharatFihModule()

  await assert.rejects(
    bharatFih.createBharatFihScraper().run({
      probeOfficialRoute: async () => ({
        status: 200,
        url: bharatFih.HOMEPAGE_URL,
        html: '<html><body>Working homepage</body></html>',
      }),
      fetchPage: async () => {
        throw new Error('fetchPage should not be called')
      },
      probeListingApi: async () => {
        throw new Error('probeListingApi should not be called')
      },
    }),
    /first-party route no longer matches the verified tls mismatch surface/i,
  )

  await assert.rejects(
    bharatFih.createBharatFihScraper().run({
      probeOfficialRoute: async () => {
        throw createTlsMismatchError()
      },
      fetchPage: async (url) => {
        if (url === bharatFih.DARWINBOX_JOBS_URL) {
          return {
            status: 200,
            url: 'https://bharatfih.darwinbox.in/jobs',
            html: '<html><body>Current Openings</body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeListingApi: async () => {
        throw new Error('probeListingApi should not be called')
      },
    }),
    /darwinbox jobs handoff/i,
  )

  await assert.rejects(
    bharatFih.createBharatFihScraper().run({
      probeOfficialRoute: async () => {
        throw createTlsMismatchError()
      },
      fetchPage: async (url) => {
        if (url === bharatFih.DARWINBOX_JOBS_URL) {
          return {
            status: 200,
            url: 'https://darwinbox.com/',
            html: '<html><title>Darwinbox</title></html>',
          }
        }

        if (bharatFih.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeListingApi: async () => {
        throw new Error('probeListingApi should not be called')
      },
    }),
    /darwinbox shell route/i,
  )

  await assert.rejects(
    bharatFih.createBharatFihScraper().run({
      probeOfficialRoute: async () => {
        throw createTlsMismatchError()
      },
      fetchPage: async (url) => {
        if (url === bharatFih.DARWINBOX_JOBS_URL) {
          return {
            status: 200,
            url: 'https://darwinbox.com/',
            html: '<html><title>Darwinbox</title></html>',
          }
        }

      if (bharatFih.DARWINBOX_SHELL_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: angularDarwinboxShellHtml,
        }
      }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      probeListingApi: async () => ({
        status: 200,
        body: '{"data":[]}',
      }),
    }),
    /listing api/i,
  )
})
