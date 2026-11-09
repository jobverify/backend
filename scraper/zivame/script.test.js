import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zivame</title>
  </head>
  <body>
    <main>
      <p>Brands on Zivame</p>
      <p>Track/Return Order</p>
      <p>Own a Franchise</p>
      <p>Find Your Fit</p>
      <footer>
        <a href="https://www.zivame.com/careers">Careers</a>
      </footer>
    </main>
  </body>
</html>
`

const BLOCKED_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <p>Cloudflare</p>
      <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
    </main>
  </body>
</html>
`

const BLOCKED_CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <p>Please enable cookies.</p>
      <p>Cloudflare</p>
      <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
    </main>
  </body>
</html>
`

test('Zivame recognizes the verified homepage, blocked careers route, and dead legacy host signals', async () => {
  const zivame = await loadModule()
  assert.ok(zivame, 'Zivame scraper module should load')

  assert.equal(zivame.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(zivame.hasPublicJobsSignal(HOMEPAGE_HTML), false)
  assert.equal(zivame.hasCloudflareChallengeSignal(BLOCKED_CAREERS_HTML), true)
  assert.equal(
    zivame.isBlockedHomepageRoute({
      status: 403,
      html: BLOCKED_HOMEPAGE_HTML,
    }),
    true,
  )
  assert.equal(zivame.hasDnsResolutionFailure('fetch failed | getaddrinfo ENOTFOUND careers.zivame.com'), true)
})

test('Zivame returns [] while the live homepage points to a Cloudflare-blocked careers route and the legacy host is dead', async () => {
  const zivame = await loadModule()
  assert.ok(zivame, 'Zivame scraper module should load')

  const requestedUrls = []
  const jobs = await zivame.createZivameScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zivame.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: HOMEPAGE_HTML,
          errorMessage: '',
        }
      }

      if (url === zivame.CAREERS_URL) {
        return {
          status: 403,
          url,
          html: BLOCKED_CAREERS_HTML,
          errorMessage: '',
        }
      }

      if (url === zivame.LEGACY_CAREERS_URL) {
        return {
          status: 'ERROR',
          url,
          html: '',
          errorMessage: 'fetch failed | getaddrinfo ENOTFOUND careers.zivame.com',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zivame.HOMEPAGE_URL,
    zivame.CAREERS_URL,
    zivame.LEGACY_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Zivame returns [] while both the homepage and careers route remain Cloudflare-blocked and the legacy host is dead', async () => {
  const zivame = await loadModule()
  assert.ok(zivame, 'Zivame scraper module should load')

  const requestedUrls = []
  const jobs = await zivame.createZivameScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zivame.HOMEPAGE_URL) {
        return {
          status: 403,
          url,
          html: BLOCKED_HOMEPAGE_HTML,
          errorMessage: '',
        }
      }

      if (url === zivame.CAREERS_URL) {
        return {
          status: 403,
          url,
          html: BLOCKED_CAREERS_HTML,
          errorMessage: '',
        }
      }

      if (url === zivame.LEGACY_CAREERS_URL) {
        return {
          status: 'ERROR',
          url,
          html: '',
          errorMessage: 'fetch failed | getaddrinfo ENOTFOUND careers.zivame.com',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zivame.HOMEPAGE_URL,
    zivame.CAREERS_URL,
    zivame.LEGACY_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Zivame fails closed when the current careers route or legacy host no longer matches the verified blocked state', async () => {
  const zivame = await loadModule()
  assert.ok(zivame, 'Zivame scraper module should load')

  await assert.rejects(
    zivame.createZivameScraper().run({
      fetchPage: async (url) => {
        if (url === zivame.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML,
            errorMessage: '',
          }
        }

        if (url === zivame.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Job openings</h1><a href="/job-openings/frontend">Apply now</a></body></html>',
            errorMessage: '',
          }
        }

        return {
          status: 'ERROR',
          url,
          html: '',
          errorMessage: 'fetch failed | getaddrinfo ENOTFOUND careers.zivame.com',
        }
      },
    }),
    /official careers route now appears to expose public jobs/i,
  )

  await assert.rejects(
    zivame.createZivameScraper().run({
      fetchPage: async (url) => {
        if (url === zivame.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML,
            errorMessage: '',
          }
        }

        if (url === zivame.CAREERS_URL) {
          return {
            status: 403,
            url,
            html: BLOCKED_CAREERS_HTML,
            errorMessage: '',
          }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Legacy careers</h1></body></html>',
          errorMessage: '',
        }
      },
    }),
    /legacy careers host no longer matches the verified unavailable state/i,
  )
})
