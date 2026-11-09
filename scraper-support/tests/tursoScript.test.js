import assert from 'node:assert/strict'
import test from 'node:test'

const TERMS_OF_USE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Turso Terms of Use</title>
  </head>
  <body>
    <main>
      <p>Email: <a href="mailto:support@turso.tech">support@turso.tech</a></p>
      <p>Address: 2093 Philadelphia Pike, #6336 Claymont, Delaware 19703 United States</p>
      <p>These Terms of Use are a binding contract between you and <b>CHISELSTRIKE INC.</b> (“Turso,” “we” and “us”).</p>
    </main>
  </body>
</html>
`

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Turso - Millions of Databases. One Architecture.</title>
    <meta name="description" content="Turso is the lightweight database that scales to millions of agents." />
  </head>
  <body>
    <main>
      <h1>Millions of Databases. One Architecture.</h1>
      <p>Built on SQLite. Fast and lightweight to multiply and run anywhere.</p>
      <footer>
        <h2>Company</h2>
        <a href="/about">About</a>
        <a href="mailto:info@turso.tech">Contact Us</a>
      </footer>
    </main>
  </body>
</html>
`

const ASHBY_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs</title>
    <meta name="robots" content="noindex,nofollow" />
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__appData = {
        "organization": null,
        "posting": null,
        "jobBoard": null
      };
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/turso/script.js')
  } catch {
    assert.fail('Expected Turso scraper module at ../../scraper/turso/script.js')
  }
}

test('Turso detects the verified legal identity, homepage redirect, and unconfigured Ashby board shells', async () => {
  const turso = await loadModule()

  assert.equal(turso.SOURCE, 'turso')
  assert.equal(turso.COMPANY, 'Turso')
  assert.equal(turso.VERIFIED_ON, '2026-07-25')
  assert.equal(turso.HOMEPAGE_URL, 'https://turso.tech/')
  assert.equal(turso.CAREERS_PAGE_URL, 'https://turso.tech/careers')
  assert.equal(turso.TERMS_OF_USE_URL, 'https://turso.tech/terms-of-use')
  assert.equal(turso.TURSO_ASHBY_BOARD_URL, 'https://jobs.ashbyhq.com/turso')
  assert.equal(turso.CHISELSTRIKE_ASHBY_BOARD_URL, 'https://jobs.ashbyhq.com/chiselstrike')
  assert.equal(turso.hasVerifiedLegalIdentitySignal(TERMS_OF_USE_HTML), true)
  assert.equal(turso.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    turso.isRedirectedToVerifiedHomepage({
      finalUrl: 'https://turso.tech/',
      html: HOMEPAGE_HTML,
    }),
    true,
  )
  assert.equal(turso.hasUnconfiguredAshbyBoardSignal(ASHBY_SHELL_HTML), true)
  assert.equal(turso.hasVerifiedLegalIdentitySignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(turso.hasOfficialHomepageSignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(
    turso.isRedirectedToVerifiedHomepage({
      finalUrl: 'https://turso.tech/careers',
      html: HOMEPAGE_HTML,
    }),
    false,
  )
  assert.equal(
    turso.hasUnconfiguredAshbyBoardSignal('<html><head><title>Jobs</title></head><body></body></html>'),
    false,
  )
})

test('Turso returns an empty list while no trustworthy public jobs surface is exposed', async () => {
  const turso = await loadModule()
  const requestedUrls = []
  const pages = new Map([
    [turso.TERMS_OF_USE_URL, { finalUrl: turso.TERMS_OF_USE_URL, html: TERMS_OF_USE_HTML }],
    [turso.CAREERS_PAGE_URL, { finalUrl: turso.HOMEPAGE_URL, html: HOMEPAGE_HTML }],
    [turso.TURSO_ASHBY_BOARD_URL, { finalUrl: turso.TURSO_ASHBY_BOARD_URL, html: ASHBY_SHELL_HTML }],
    [
      turso.CHISELSTRIKE_ASHBY_BOARD_URL,
      { finalUrl: turso.CHISELSTRIKE_ASHBY_BOARD_URL, html: ASHBY_SHELL_HTML },
    ],
  ])

  const jobs = await turso.createTursoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return pages.get(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    turso.TERMS_OF_USE_URL,
    turso.CAREERS_PAGE_URL,
    turso.TURSO_ASHBY_BOARD_URL,
    turso.CHISELSTRIKE_ASHBY_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Turso fails closed when the verified surfaces change materially', async () => {
  const turso = await loadModule()

  await assert.rejects(
    turso.createTursoScraper().run({
      fetchPage: async () => ({ finalUrl: turso.TERMS_OF_USE_URL, html: '<html><body>terms changed</body></html>' }),
    }),
    /Verified Turso legal identity changed materially/i,
  )

  await assert.rejects(
    turso.createTursoScraper().run({
      fetchPage: async (url) => {
        if (url === turso.TERMS_OF_USE_URL) {
          return { finalUrl: turso.TERMS_OF_USE_URL, html: TERMS_OF_USE_HTML }
        }
        if (url === turso.CAREERS_PAGE_URL) {
          return { finalUrl: turso.CAREERS_PAGE_URL, html: '<html><body><h1>Careers</h1></body></html>' }
        }
        return { finalUrl: url, html: ASHBY_SHELL_HTML }
      },
    }),
    /Verified Turso careers route no longer redirects to the homepage/i,
  )

  await assert.rejects(
    turso.createTursoScraper().run({
      fetchPage: async (url) => {
        if (url === turso.TERMS_OF_USE_URL) {
          return { finalUrl: turso.TERMS_OF_USE_URL, html: TERMS_OF_USE_HTML }
        }
        if (url === turso.CAREERS_PAGE_URL) {
          return { finalUrl: turso.HOMEPAGE_URL, html: HOMEPAGE_HTML }
        }
        return {
          finalUrl: url,
          html: ASHBY_SHELL_HTML.replace('"jobBoard": null', '"jobBoard": {"name":"Turso"}'),
        }
      },
    }),
    /Verified Turso public Ashby board shell changed materially/i,
  )
})
