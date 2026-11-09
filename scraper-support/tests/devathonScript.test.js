import assert from 'node:assert/strict'
import test from 'node:test'

const loadDevathonModule = async () => {
  try {
    return await import('../../scraper/devathon/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Modern &amp; Affordable Software Development for Startups | Devathon</title>
      <meta
        name="description"
        content="Devathon is one of the top web design &amp; development company that builds quality &amp; affordable iOS, Android &amp; Web apps for Startups."
      />
    </head>
    <body>
      <h1>Technology partners in your entrepreneurial journey</h1>
      <p>Devathon delivers great products.</p>
      <a href="https://www.linkedin.com/company/devathon/">Linkedin</a>
      <a href="mailto:hello@devathon.com">hello@devathon.com</a>
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

test('official Devathon site is present while public career routes are missing', async () => {
  const devathon = await loadDevathonModule()
  assert.ok(devathon)

  assert.equal(devathon.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(devathon.isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when Devathon exposes no public careers or jobs routes', async () => {
  const devathon = await loadDevathonModule()
  assert.ok(devathon)

  const requestedUrls = []
  const jobs = await devathon.createDevathonScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === devathon.CAREER_PAGE_URL) {
        return homepageHtml
      }

      if (url === devathon.CAREERS_ROUTE_URL || url === devathon.JOBS_ROUTE_URL) {
        return notFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://devathon.com/',
    'https://devathon.com/careers',
    'https://devathon.com/jobs',
  ])
  assert.deepEqual(jobs, [])
})
