import assert from 'node:assert/strict'
import test from 'node:test'

const loadGoibiboModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Goibibo scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Goibibo - Best Travel Website. Book Hotels, Flights, Trains, Bus and Cabs with upto 50% off</title>
  </head>
  <body>
    <p>Book hotels, flights, trains, bus and cabs with upto 50% off</p>
    <a href="https://www.goibibo.com/careers/">Careers</a>
  </body>
</html>
`

const unavailableCareerPage = {
  status: 504,
  url: 'https://www.goibibo.com/careers/',
  html: `
    <html>
      <head><title>504 Gateway Time-out</title></head>
      <body><h1>504 Gateway Time-out</h1></body>
    </html>
  `,
}

const timeoutError = () => {
  const error = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  return error
}

test('Goibibo validators reflect the Friday, August 7, 2026 unavailable careers handoff', async () => {
  const goibibo = await loadGoibiboModule()

  assert.equal(goibibo.VERIFIED_ON, '2026-08-07')
  assert.deepEqual(goibibo.ACCEPTED_CAREER_PAGE_STATUSES, [404, 503, 504])
  assert.equal(goibibo.extractCareerUrl(homepageHtml), goibibo.CAREER_URL)
  assert.equal(goibibo.pageHasOfficialGoibiboSignals(homepageHtml), true)
  assert.equal(goibibo.isVerifiedUnavailableCareerPage(unavailableCareerPage), true)
})

test('Goibibo returns an authoritative empty result for the verified unavailable careers surface and tolerates homepage or careers timeouts', async () => {
  const goibibo = await loadGoibiboModule()

  const unavailableJobs = await goibibo.createGoibiboScraper().run({
    fetchPage: async (url) => {
      if (url === goibibo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === goibibo.CAREER_URL) return unavailableCareerPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(unavailableJobs, [])

  const homepageTimeoutJobs = await goibibo.createGoibiboScraper().run({
    fetchPage: async (url) => {
      if (url === goibibo.HOMEPAGE_URL) throw timeoutError()
      if (url === goibibo.CAREER_URL) return unavailableCareerPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(homepageTimeoutJobs, [])

  const careersTimeoutJobs = await goibibo.createGoibiboScraper().run({
    fetchPage: async (url) => {
      if (url === goibibo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === goibibo.CAREER_URL) throw timeoutError()
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(careersTimeoutJobs, [])
})
