import assert from 'node:assert/strict'
import test from 'node:test'

const loadCodetantraModule = async () => {
  try {
    return await import('../../scraper/codetantra/script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
  <html>
    <head>
      <title>Teach & Learn Anywhere - CodeTantra</title>
    </head>
    <body>
      <h1>Your virtual university, in minutes!</h1>
      <a href="mailto:support@codetantra.com">support@codetantra.com</a>
      <a href="tel:+917995417777">+91 799 541 7777</a>
      <a href="/about-us.jsp">About</a>
      <a href="/contact-us.jsp">Help & Support</a>
    </body>
  </html>
`

const notFoundHtml = `
  <html>
    <head>
      <title>CodeTantra - Page not found</title>
    </head>
    <body>
      <h1>Error 404</h1>
      <p>Requested resource not found.</p>
      <p>Please check the URL of the resource you are trying to access.</p>
    </body>
  </html>
`

test('official site is present while public CodeTantra career routes are missing', async () => {
  const codetantra = await loadCodetantraModule()
  assert.ok(codetantra)

  assert.equal(codetantra.hasOfficialSiteSignal(officialHomepageHtml), true)
  assert.equal(codetantra.isMissingCareerRoute(notFoundHtml), true)
})

test('run returns no jobs when CodeTantra exposes no public careers or jobs routes', async () => {
  const codetantra = await loadCodetantraModule()
  assert.ok(codetantra)

  const requestedUrls = []
  const jobs = await codetantra.createCodetantraScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === codetantra.CAREER_PAGE_URL) {
        return officialHomepageHtml
      }

      if (url === codetantra.CAREERS_ROUTE_URL || url === codetantra.JOBS_ROUTE_URL) {
        return notFoundHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(codetantra.buildSearchUrl(), codetantra.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [
    'https://codetantra.com/',
    'https://codetantra.com/careers/',
    'https://codetantra.com/jobs/',
  ])
  assert.deepEqual(jobs, [])
})
