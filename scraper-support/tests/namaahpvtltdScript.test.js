import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>
`

const NO_JOBS_ROUTE_PAGE = {
  status: 200,
  url: 'https://namaah.in/careers',
  html: HOMEPAGE_HTML,
}

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Namaah Careers</title></head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://boards.greenhouse.io/namaah/jobs/123">Apply now</a>
  </body>
</html>
`

const loadNamaahModule = async () => {
  try {
    return await import('../../scraper/namaahpvtltd/script.js')
  } catch {
    assert.fail('Expected Namaah Pvt Ltd scraper module at ../../scraper/namaahpvtltd/script.js')
  }
}

test('Namaah constants and validators stay pinned to the August 3, 2026 redirect-shell no-public-jobs surface', async () => {
  const namaah = await loadNamaahModule()

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
  assert.equal(namaah.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(namaah.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(namaah.isVerifiedNoJobsRoute(NO_JOBS_ROUTE_PAGE), true)
  assert.equal(namaah.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
  assert.equal(namaah.isFirstPartyUrl('https://www.namaah.in/jobs'), true)
})

test('Namaah returns [] when the first-party redirect shell stays clean across the homepage and jobs routes', async () => {
  const namaah = await loadNamaahModule()
  const requestedUrls = []

  const jobs = await namaah.createNamaahScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === namaah.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (namaah.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      throw new Error(`Unexpected Namaah URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://namaah.in/',
    'https://namaah.in/careers',
    'https://namaah.in/careers/',
    'https://namaah.in/jobs',
    'https://namaah.in/jobs/',
  ])
  assert.deepEqual(jobs, [])
})

test('Namaah fails closed when the homepage starts exposing public jobs', async () => {
  const namaah = await loadNamaahModule()

  await assert.rejects(
    namaah.createNamaahScraper().run({
      fetchPage: async (url) => {
        if (url === namaah.HOMEPAGE_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        return { status: 200, url, html: HOMEPAGE_HTML }
      },
    }),
    /homepage no longer matches|homepage now appears to expose public jobs/i,
  )
})
