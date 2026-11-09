import assert from 'node:assert/strict'
import test from 'node:test'

const parkedHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>movidu.com - This website is for sale! - movidu Resources and Information.</title>
    <meta
      name="description"
      content="This website is for sale! movidu.com is your first and best source for information about movidu."
    >
    <link rel="icon" href="//img.sedoparking.com/templates/logos/sedo_logo.png">
  </head>
  <body>
    <img src="https://img.sedoparking.com/images/js_preloader.gif" alt="">
    <script src="https://euob.iseaskies.com/sxp/i/581749a3c1e7922374ca9b3d4dff0407.js"></script>
    <script>
      window.location = "//movidu.com/search/redirect.php?f=http%3A%2F%2Fquickresultonline.com%3Fdn%3Dmovidu.com";
    </script>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Movidu Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/movidu/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const currentParkedHtml = `
  <html><head>
    <title>movidu.com&nbsp;-&nbsp;This website is for sale!&nbsp;-&nbsp;movidu Resources and Information.</title>
    <script src="https://img.sedoparking.com/js/parking.js"></script>
  </head><body></body></html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Movidu Technology Private Limited scraper module at ./script.js')
  }
}

test('Movidu Technology Private Limited sentinel pins the verified parked-domain no-jobs surface', async () => {
  const movidu = await loadModule()

  assert.equal(movidu.SOURCE, 'movidutechnologyprivatelimited')
  assert.equal(movidu.COMPANY, 'Movidu Technology Private Limited')
  assert.equal(movidu.VERIFIED_ON, '2026-07-13')
  assert.equal(
    movidu.VERIFIED_SURFACE_SUMMARY,
    'On July 13, 2026, the canonical Movidu first-party hosts resolved only to a Sedo parked-for-sale page, not a trustworthy company careers surface.',
  )
  assert.equal(movidu.HOMEPAGE_URL, 'http://movidu.com/')
  assert.equal(movidu.WWW_HOMEPAGE_URL, 'http://www.movidu.com/')
  assert.equal(movidu.CAREERS_URL, 'http://movidu.com/careers')
  assert.equal(movidu.hasPublicJobsSignal(parkedHtml), false)
  assert.equal(movidu.hasVerifiedParkedDomainSignal(parkedHtml), true)
  assert.equal(movidu.hasVerifiedParkedDomainSignal(currentParkedHtml), true)
  assert.equal(movidu.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Movidu treats an exact upstream 504 gateway timeout as the same bounded timeout blocker', async () => {
  const movidu = await loadModule()
  const jobs = await movidu.createMoviduTechnologyPrivateLimitedScraper().run({
    fetchPage: async (url) => ({
      status: 504,
      url,
      html: '<html><body><h1>504 Gateway Time-out</h1><p>The server did not respond in time.</p></body></html>',
    }),
  })
  assert.deepEqual(jobs, [])
})

test('Movidu Technology Private Limited sentinel returns no jobs only while the parked first-party surface remains unchanged', async () => {
  const movidu = await loadModule()
  const requestedUrls = []

  const jobs = await movidu.createMoviduTechnologyPrivateLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: parkedHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    movidu.HOMEPAGE_URL,
    movidu.WWW_HOMEPAGE_URL,
    movidu.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Movidu Technology Private Limited sentinel fails closed when the parked domain drifts into a live site or job board', async () => {
  const movidu = await loadModule()

  await assert.rejects(
    movidu.createMoviduTechnologyPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === movidu.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Movidu</h1><p>AI product company.</p></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    movidu.createMoviduTechnologyPrivateLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === movidu.HOMEPAGE_URL || url === movidu.WWW_HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: parkedHtml,
          }
        }

        if (url === movidu.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers route no longer matches|public jobs/i,
  )
})

test('Movidu Technology Private Limited returns an empty result when the verified no-jobs surface is temporarily timeout-blocked', async () => {
  const movidu = await loadModule()

  const jobs = await movidu.createMoviduTechnologyPrivateLimitedScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted address: movidu.com:80, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})
