import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Fragma Data</title>
  </head>
  <body>
    <h1>Transforming Your Enterprise Data into Growth Engines</h1>
    <p>Careers/Job Enquiry: <a href="mailto:careers@fragmadata.com">careers@fragmadata.com</a></p>
  </body>
</html>
`

const CAREERS_404_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found | Fragma Data</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fragmadatasystems/script.js')
  } catch {
    assert.fail('Expected Fragma Data Systems scraper module at ../../scraper/fragmadatasystems/script.js')
  }
}

test('Fragma Data Systems sentinel helpers stay pinned to the homepage careers-email-only state', async () => {
  const fragma = await loadModule()

  assert.equal(fragma.hasHomepageCareersEmailOnlySignal(HOMEPAGE_HTML), true)
  assert.equal(fragma.isExpectedMissingCareersRoute({ status: 404, html: CAREERS_404_HTML }), true)
  assert.equal(
    fragma.pageExposesPublicJobs('<html><body><a href="/careers/data-engineer">Data Engineer</a></body></html>'),
    true,
  )
})

test('Fragma Data Systems run validates the homepage and missing careers route before returning []', async () => {
  const fragma = await loadModule()
  const requestedUrls = []

  const jobs = await fragma.createFragmaDataSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === fragma.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
      if (url === fragma.CAREERS_URL) return { status: 404, url, html: CAREERS_404_HTML }
      throw new Error(`Unexpected Fragma URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [fragma.HOMEPAGE_URL, fragma.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Fragma Data Systems fails closed when public job links appear on the homepage', async () => {
  const fragma = await loadModule()

  await assert.rejects(
    fragma.createFragmaDataSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === fragma.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><a href="/jobs/data-engineer">Data Engineer</a></body></html>' }
        }
        return { status: 404, url, html: CAREERS_404_HTML }
      },
    }),
    /public jobs/i,
  )
})
