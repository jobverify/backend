import assert from 'node:assert/strict'
import test from 'node:test'

const REDIRECT_SHELL_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Blue Star Infotech</title>
  </head>
  <body>
    <script>
      window.onload = function () {
        window.location.href = "/lander";
      };
    </script>
  </body>
</html>
`

const PARKED_LANDER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <script>window.LANDER_SYSTEM = "PW"</script>
    <script>window._trfd = window._trfd || [], window._trfd.push({ ap: "parking" })</script>
  </head>
  <body></body>
</html>
`

const loadBlueStarInfotechModule = async () => {
  try {
    return await import('../../scraper/bluestarinfotech/script.js')
  } catch {
    assert.fail('Expected Blue Star Infotech scraper module at ../../scraper/bluestarinfotech/script.js')
  }
}

test('Blue Star Infotech keeps the verified first-party routes pinned to the redirect shell', async () => {
  const bsil = await loadBlueStarInfotechModule()

  assert.equal(bsil.HOMEPAGE_URL, 'https://www.bsil.com/')
  assert.equal(bsil.CAREERS_URL, 'https://www.bsil.com/careers')
  assert.equal(bsil.JOBS_URL, 'https://www.bsil.com/jobs')
  assert.equal(bsil.LANDER_URL, 'https://www.bsil.com/lander')
  assert.equal(bsil.extractRedirectTarget(REDIRECT_SHELL_HTML), '/lander')
  assert.equal(bsil.hasRedirectShellSignal(REDIRECT_SHELL_HTML), true)
})

test('Blue Star Infotech returns an honest zero-job result when the site is only a parked redirect shell', async () => {
  const bsil = await loadBlueStarInfotechModule()
  const requestedUrls = []

  const jobs = await bsil.createBlueStarInfotechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (
        url === bsil.HOMEPAGE_URL
        || url === bsil.CAREERS_URL
        || url === bsil.JOBS_URL
      ) {
        return {
          status: 200,
          url,
          html: REDIRECT_SHELL_HTML,
        }
      }

      if (url === bsil.LANDER_URL) {
        return {
          status: 307,
          url,
          location: 'https://www.afternic.com/forsale/www.bsil.com',
          html: '',
        }
      }

      throw new Error(`Unexpected Blue Star Infotech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.bsil.com/',
    'https://www.bsil.com/careers',
    'https://www.bsil.com/jobs',
    'https://www.bsil.com/lander',
  ])
  assert.deepEqual(jobs, [])
})

test('Blue Star Infotech fails closed if the parked-domain redirect disappears', async () => {
  const bsil = await loadBlueStarInfotechModule()

  await assert.rejects(
    bsil.createBlueStarInfotechScraper().run({
      fetchPage: async (url) => {
        if (url === bsil.LANDER_URL) {
          return {
            status: 200,
            url,
            location: null,
            html: '',
          }
        }

        return {
          status: 200,
          url,
          html: REDIRECT_SHELL_HTML,
        }
      },
    }),
    /parked-domain redirect changed/i,
  )
})

test('Blue Star Infotech accepts the current GoDaddy parked-domain redirect target', async () => {
  const bsil = await loadBlueStarInfotechModule()

  assert.equal(
    bsil.hasParkedLanderRedirect({
      status: 307,
      location: 'https://forsale.godaddy.com/forsale/www.bsil.com?utm_source=TDFS_DASLNC',
    }),
    true,
  )
})

test('Blue Star Infotech accepts the current parked-domain lander HTML', async () => {
  const bsil = await loadBlueStarInfotechModule()

  assert.equal(
    bsil.hasParkedLanderRedirect({
      status: 200,
      url: 'https://www.bsil.com/lander',
      location: null,
      html: PARKED_LANDER_HTML,
    }),
    true,
  )
})
