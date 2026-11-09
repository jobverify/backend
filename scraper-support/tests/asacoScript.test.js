import assert from 'node:assert/strict'
import test from 'node:test'

const loadAsacoModule = async () => {
  try {
    return await import('../../scraper/asaco/script.js')
  } catch {
    assert.fail('Expected ASACO scraper module at ../../scraper/scraper/asaco/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>ASACO INDIA</title>
    </head>
    <body>
      <h1>PIONEER IN MANUFACTURING AEROSPACE COMPONENTS &amp; SUB-SYSTEMS</h1>
    </body>
  </html>
`

const missingCareersHtml = `
  <html>
    <head>
      <title>ASACO INDIA</title>
    </head>
    <body>
      <p>We couldn't find the page you were looking for.</p>
    </body>
  </html>
`

test('hasMissingCareersRouteSignal stays true when the official ASACO site has no public career routes', async () => {
  const asaco = await loadAsacoModule()

  assert.equal(asaco.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(
    asaco.hasMissingCareersRouteSignal({ status: 404, html: missingCareersHtml }),
    true,
  )
})

test('run returns no jobs when ASACO publishes no public careers pages', async () => {
  const asaco = await loadAsacoModule()
  const requestedUrls = []

  const jobs = await asaco.createAsacoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === asaco.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === asaco.CAREERS_PAGE_URL || url === asaco.CAREER_PAGE_URL) {
        return { status: 404, url, html: missingCareersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    asaco.HOMEPAGE_URL,
    asaco.CAREERS_PAGE_URL,
    asaco.CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})
