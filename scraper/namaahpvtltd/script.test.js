import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <script>
      window.onload = function() { window.location.href = "/lander" }
    </script>
  </head>
</html>
`

const verifiedNoJobsRoute = {
  status: 200,
  url: 'https://namaah.in/careers',
  html: homepageHtml,
}

const liveJobsRoute = {
  status: 200,
  url: 'https://namaah.in/jobs',
  html: `
    <html>
      <head><title>Namaah Careers</title></head>
      <body>
        <main>
          <h1>Current Openings</h1>
          <article>
            <h2>Growth Manager</h2>
            <a href="/jobs/growth-manager">Apply now</a>
          </article>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Namaah Pvt Ltd scraper module at ./script.js')
  }
}

test('Namaah Pvt Ltd sentinel pins the verified first-party no-public-jobs surface from August 3, 2026', async () => {
  const namaah = await loadModule()

  assert.equal(namaah.SOURCE, 'namaahpvtltd')
  assert.equal(namaah.COMPANY, 'Namaah Pvt Ltd')
  assert.equal(namaah.VERIFIED_ON, '2026-08-03')
  assert.equal(namaah.HOMEPAGE_URL, 'https://namaah.in/')
  assert.deepEqual(namaah.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://namaah.in/careers',
    'https://namaah.in/careers/',
    'https://namaah.in/jobs',
    'https://namaah.in/jobs/',
  ])
  assert.equal(
    namaah.VERIFIED_SURFACE_SUMMARY,
    'Verified on Monday, August 3, 2026 that https://namaah.in/ now serves only a first-party JavaScript redirect shell that sends visitors to /lander, with no public jobs board, and that common careers and jobs routes return the same no-public-jobs shell.',
  )

  assert.equal(namaah.isFirstPartyUrl('https://namaah.in/careers'), true)
  assert.equal(namaah.isFirstPartyUrl('https://www.namaah.in/careers'), true)
  assert.equal(namaah.isFirstPartyUrl('https://example.com/jobs'), false)
  assert.equal(namaah.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(namaah.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(namaah.hasPublicJobsSignal(liveJobsRoute.html), true)
  assert.equal(namaah.isVerifiedNoJobsRoute(verifiedNoJobsRoute), true)
  assert.equal(namaah.isVerifiedNoJobsRoute(liveJobsRoute), false)
})

test('Namaah Pvt Ltd sentinel returns [] only while the verified first-party surface stays careers-free', async () => {
  const namaah = await loadModule()
  const requestedUrls = []

  const jobs = await namaah.createNamaahScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === namaah.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (namaah.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: homepageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    namaah.HOMEPAGE_URL,
    ...namaah.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Namaah Pvt Ltd default fetch is bounded by a timeout signal', async () => {
  const namaah = await loadModule()
  let capturedInit = null

  const page = await namaah.defaultFetchPage(namaah.HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => homepageHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, namaah.HOMEPAGE_URL)
  assert.equal(page.html, homepageHtml)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Namaah Pvt Ltd sentinel fails closed when the verified first-party surface drifts or starts exposing jobs', async () => {
  const namaah = await loadModule()

  await assert.rejects(
    namaah.createNamaahScraper().run({
      fetchPage: async (url) => {
        if (url === namaah.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Namaah</title></head><body><h1>Unexpected shell</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    namaah.createNamaahScraper().run({
      fetchPage: async (url) => {
        if (url === namaah.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === namaah.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return liveJobsRoute
        }

        if (namaah.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers-free route changed or now exposes public jobs/i,
  )
})
