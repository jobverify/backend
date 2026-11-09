import assert from 'node:assert/strict'
import test from 'node:test'

const loadAcceleroIsaModule = async () => {
  try {
    return await import('../../scraper/acceleroisa/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head><title>Accelero - USA Accounting & Startup Solutions</title></head>
    <body>
      <nav>
        <a href="/about">About</a>
        <a href="/services">Services</a>
        <a href="/contact">Contact</a>
      </nav>
      <h1>Accelero Corporation</h1>
      <p>Accounting and advisory services for startups.</p>
    </body>
  </html>
`

const notFoundHtml = `
  <html>
    <head><title>404 Not Found</title></head>
    <body><h1>Not Found</h1></body>
  </html>
`

test('official Accelero site is present while public career routes are missing', async () => {
  const acceleroIsa = await loadAcceleroIsaModule()
  assert.ok(acceleroIsa)

  assert.equal(acceleroIsa.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(acceleroIsa.isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when Accelero exposes no public careers or jobs routes', async () => {
  const acceleroIsa = await loadAcceleroIsaModule()
  assert.ok(acceleroIsa)

  const requestedUrls = []
  const jobs = await acceleroIsa.createAcceleroIsaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === acceleroIsa.CAREER_PAGE_URL) return homepageHtml
      if (url === acceleroIsa.CAREERS_ROUTE_URL || url === acceleroIsa.JOBS_ROUTE_URL) {
        return notFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    acceleroIsa.CAREER_PAGE_URL,
    acceleroIsa.CAREERS_ROUTE_URL,
    acceleroIsa.JOBS_ROUTE_URL,
  ])
  assert.deepEqual(jobs, [])
})
