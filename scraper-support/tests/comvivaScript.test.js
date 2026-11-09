import assert from 'node:assert/strict'
import test from 'node:test'

const loadComvivaModule = async () => {
  try {
    return await import('../../scraper/comviva/script.js')
  } catch {
    assert.fail('Expected Comviva scraper module at ../../scraper/scraper/comviva/script.js')
  }
}

const careersPageHtml = `
  <html>
    <body>
      <h2>Be part of the Comviva journey</h2>
      <script src="https://jobsapi.ceipal.com/APISource/widget.js" data-ceipal-api-key="abc" data-ceipal-career-portal-id="def"></script>
      <iframe id="careers_api_source" src="https://jobsapi.ceipal.com/APISource/v2/index.html?bgcolor=eb2227&api_key=abc&cp_id=def"></iframe>
    </body>
  </html>
`

const widgetHtml = `
  <html>
    <head>
      <title>.:: CEIPAL Career Portal ::.</title>
    </head>
    <body>
      <h1>We Want To Work With You</h1>
      <h2>Search Jobs</h2>
      <p>0 Current Openings</p>
    </body>
  </html>
`

test('extractOpenings returns no jobs when the public Comviva CEIPAL widget reports zero current openings', async () => {
  const comviva = await loadComvivaModule()

  assert.equal(comviva.hasCareersPageSignal(careersPageHtml), true)
  assert.equal(comviva.hasWidgetSignal(widgetHtml), true)
  assert.equal(comviva.extractOpeningCount(widgetHtml), 0)
  assert.deepEqual(comviva.extractOpenings(widgetHtml), [])
})

test('run fetches the Comviva careers page and CEIPAL widget and returns an honest zero-openings result', async () => {
  const comviva = await loadComvivaModule()
  const requestedUrls = []

  const jobs = await comviva.createComvivaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === comviva.CAREERS_PAGE_URL) {
        return careersPageHtml
      }

      if (url === comviva.CEIPAL_WIDGET_URL) {
        return widgetHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    comviva.CAREERS_PAGE_URL,
    comviva.CEIPAL_WIDGET_URL,
  ])
  assert.deepEqual(jobs, [])
})
