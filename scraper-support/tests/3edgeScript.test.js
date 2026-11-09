import assert from 'node:assert/strict'
import test from 'node:test'

const load3EdgeModule = async () => {
  try {
    return await import('../../scraper/3edge/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>3Edge Technologies: When it comes down to IT</title>
    </head>
    <body>
      <nav>
        <a href="./3edge/about.html">About 3Edge</a>
        <a href="./3edge/contact.html">Contact</a>
      </nav>
      <h1>3Edge Technologies</h1>
      <p>Consultancy, development and maintenance services.</p>
    </body>
  </html>
`

const notFoundHtml = `
  <html>
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <h1>Not Found</h1>
    </body>
  </html>
`

test('official site is present while public career routes are missing', async () => {
  const edge = await load3EdgeModule()
  assert.ok(edge)

  assert.equal(edge.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(edge.isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when 3Edge exposes no public careers or jobs routes', async () => {
  const edge = await load3EdgeModule()
  assert.ok(edge)

  const requestedUrls = []
  const jobs = await edge.create3EdgeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === edge.CAREER_PAGE_URL) {
        return homepageHtml
      }

      if (url === edge.CAREERS_ROUTE_URL || url === edge.JOBS_ROUTE_URL) {
        return notFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://3edge.com/',
    'https://3edge.com/careers',
    'https://3edge.com/jobs',
  ])
  assert.deepEqual(jobs, [])
})
