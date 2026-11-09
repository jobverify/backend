import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const indiaLocationHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>TP in India | Global Digital Business Services</title>
  </head>
  <body>
    <script>window.__NOISE__ = "you are on another website";</script>
    <main>
      <h1>TP in India</h1>
      <p>Digital CX &amp; Transformation COE for TP</p>
      <a href="https://www.tp.com/en-in/locations/india/careers/">Job opportunities</a>
    </main>
  </body>
</html>
`

const indiaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs in TP India | TP in India</title>
  </head>
  <body>
    <style>.hidden { display: none; }</style>
    <main>
      <h1>Work with us</h1>
      <button>Clear Filter</button>
      <p>Country (all)</p>
      <p>India</p>
      <p>Only work-from-home</p>
      <button>See more results</button>
      <a href="/en-us/careers/job-opportunities/">Back to Job Opportunities page</a>
    </main>
  </body>
</html>
`

test('Teleperformance recognizes the official India handoff and zero-job careers shell', async () => {
  const teleperformance = await loadModule()

  assert.equal(teleperformance.SOURCE, 'teleperformance')
  assert.equal(teleperformance.COMPANY, 'Teleperformance')
  assert.equal(teleperformance.INDIA_LOCATION_URL, 'https://www.tp.com/en-in/locations/india/')
  assert.equal(teleperformance.INDIA_CAREERS_URL, 'https://www.tp.com/en-in/locations/india/careers/')
  assert.equal(teleperformance.hasIndiaLocationSignal(indiaLocationHtml), true)
  assert.equal(teleperformance.extractIndiaCareersUrl(indiaLocationHtml), teleperformance.INDIA_CAREERS_URL)
  assert.equal(teleperformance.hasIndiaCareersShellSignal(indiaCareersHtml), true)
  assert.deepEqual(teleperformance.extractPublicJobRecordUrls(indiaCareersHtml), [])
})

test('Teleperformance run returns no jobs while the verified India shell exposes no public job records', async () => {
  const teleperformance = await loadModule()

  const requestedUrls = []
  const jobs = await teleperformance.createTeleperformanceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === teleperformance.INDIA_LOCATION_URL) return indiaLocationHtml
      if (url === teleperformance.INDIA_CAREERS_URL) return indiaCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    teleperformance.INDIA_LOCATION_URL,
    teleperformance.INDIA_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})
