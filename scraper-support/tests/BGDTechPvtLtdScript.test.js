import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at BGD</title>
  </head>
  <body>
    <main>
      <h1>Careers at BGD</h1>
      <p>Welcome to the vacancies page of our company!</p>
      <p>Didn't find the right job?</p>
      <p>hello@bgd-limited.com</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bgdtechpvtltd/script.js')
  } catch {
    assert.fail('Expected BGD Tech PVT LTD scraper module at ../../scraper/bgdtechpvtltd/script.js')
  }
}

test('BGD Tech PVT LTD validates the verified careers intake surface and returns an honest zero-job result', async () => {
  const bgd = await loadModule()

  assert.equal(bgd.SOURCE, 'bgdtechpvtltd')
  assert.equal(bgd.COMPANY, 'BGD Tech PVT LTD')
  assert.equal(bgd.CAREERS_URL, 'https://bgd-limited.com/careers')
  assert.equal(bgd.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    bgd.hasForbiddenSurfaceSignal({
      status: 403,
      html: '<html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>',
    }),
    true,
  )
  assert.equal(bgd.pageExposesPublicJobListings(careersHtml), false)

  const jobs = await bgd.createBGDTechPvtLtdScraper({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: careersHtml,
    }),
  }).run()

  assert.deepEqual(jobs, [])
})

test('BGD Tech PVT LTD can recover with a browser-backed careers page when direct requests are redirected into localhost', async () => {
  const bgd = await loadModule()
  const browserUrls = []

  const jobs = await bgd.createBGDTechPvtLtdScraper({
    fetchPage: async () => {
      throw new TypeError('fetch failed | connect ECONNREFUSED 127.0.0.1:443')
    },
  }).run({
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      return {
        status: 200,
        url,
        html: careersHtml,
      }
    },
  })

  assert.deepEqual(browserUrls, [bgd.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('BGD Tech PVT LTD returns no jobs when the current public careers host responds with 403 Forbidden', async () => {
  const bgd = await loadModule()

  const jobs = await bgd.createBGDTechPvtLtdScraper({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: '<html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>',
    }),
  }).run()

  assert.deepEqual(jobs, [])
})

test('BGD Tech PVT LTD returns no jobs when the verified first-party careers host is unreachable over both fetch paths', async () => {
  const bgd = await loadModule()
  const browserUrls = []

  const jobs = await bgd.createBGDTechPvtLtdScraper({
    fetchPage: async () => {
      throw new TypeError('fetch failed | connect ECONNREFUSED 127.0.0.1:443')
    },
  }).run({
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      throw new Error(`net::ERR_FAILED at ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [bgd.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
