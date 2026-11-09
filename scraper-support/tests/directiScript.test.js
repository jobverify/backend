import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Directi</title>
  </head>
  <body>
    <h1>Directi</h1>
    <a href="https://careers.directi.com">CAREERS</a>
    <a href="https://careers.directi.com">Careers</a>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers — Directi</title>
  </head>
  <body class="careers">
    <div class="hiring-block">
      <p>We’re looking for passionate, out-of-the-box thinkers who can help us shape the future of Directi.</p>
      <button onclick="window.open('https://jobs.lever.co/directi')">View job posting</button>
    </div>
  </body>
</html>
`

const BROKEN_LEVER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not found – 404 error</title>
  </head>
  <body>
    <h1>404</h1>
  </body>
</html>
`

const loadDirectiModule = async () => {
  try {
    return await import('../../scraper/directi/script.js')
  } catch {
    assert.fail('Expected Directi scraper module at ../../scraper/directi/script.js')
  }
}

test('Directi sentinel helpers stay pinned to the verified homepage, careers subdomain, and broken Lever handoff', async () => {
  const directi = await loadDirectiModule()

  assert.equal(directi.SOURCE, 'directi')
  assert.equal(directi.COMPANY, 'Directi')
  assert.equal(directi.HOMEPAGE_URL, 'https://www.directi.com/')
  assert.equal(directi.CAREERS_URL, 'https://careers.directi.com/')
  assert.equal(directi.BROKEN_LEVER_BOARD_URL, 'https://jobs.lever.co/directi')
  assert.equal(directi.BROKEN_LEVER_API_URL, 'https://api.lever.co/v0/postings/directi?mode=json')
  assert.equal(directi.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(directi.extractCareersUrl(HOMEPAGE_HTML), directi.CAREERS_URL)
  assert.equal(directi.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.equal(directi.extractBrokenLeverBoardUrl(CAREERS_HTML), directi.BROKEN_LEVER_BOARD_URL)
  assert.equal(
    directi.isVerifiedMissingLeverSurface({
      status: 404,
      url: directi.BROKEN_LEVER_BOARD_URL,
      html: BROKEN_LEVER_HTML,
    }),
    true,
  )
})

test('Directi sentinel returns [] only while the careers handoff still points to the verified broken Lever board and API', async () => {
  const directi = await loadDirectiModule()
  const requestedUrls = []

  const jobs = await directi.createDirectiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === directi.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === directi.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      return { status: 404, url, html: BROKEN_LEVER_HTML }
    },
  })

  assert.deepEqual(requestedUrls, [
    directi.HOMEPAGE_URL,
    directi.CAREERS_URL,
    directi.BROKEN_LEVER_BOARD_URL,
    directi.BROKEN_LEVER_API_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Directi sentinel fails closed when the homepage, careers page, or broken Lever state drifts', async () => {
  const directi = await loadDirectiModule()

  await assert.rejects(
    directi.createDirectiScraper().run({
      fetchPage: async () => ({ status: 200, url: directi.HOMEPAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    directi.createDirectiScraper().run({
      fetchPage: async (url) => {
        if (url === directi.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        return {
          status: 200,
          url,
          html: CAREERS_HTML.replace('https://jobs.lever.co/directi', 'https://jobs.lever.co/directi-old'),
        }
      },
    }),
    /careers handoff changed/i,
  )

  await assert.rejects(
    directi.createDirectiScraper().run({
      fetchPage: async (url) => {
        if (url === directi.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === directi.CAREERS_URL) {
          return { status: 200, url, html: '<html><body>Careers</body></html>' }
        }

        return { status: 404, url, html: BROKEN_LEVER_HTML }
      },
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    directi.createDirectiScraper().run({
      fetchPage: async (url) => {
        if (url === directi.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === directi.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        return { status: 200, url, html: '<html><body>Now hiring</body></html>' }
      },
    }),
    /Lever surface no longer matches/i,
  )
})
