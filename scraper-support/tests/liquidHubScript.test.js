import assert from 'node:assert/strict'
import test from 'node:test'

const REDIRECTED_CAPGEMINI_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Capgemini - Make it real.</title></head>
  <body>
    <nav>
      <a href="/insights/">Insights</a>
      <a href="/careers/">Careers</a>
      <a href="/about-us/">About us</a>
    </nav>
    <h1>Capgemini</h1>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Open Positions</h1>
    <a href="https://www.liquidhub.com/jobs/platform-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/liquidhub/script.js')
  } catch {
    assert.fail('Expected LiquidHub scraper module at ../../scraper/liquidhub/script.js')
  }
}

test('LiquidHub scraper constants stay pinned to the verified exact-name redirect on Saturday, July 18, 2026', async () => {
  const liquidhub = await loadModule()

  assert.equal(liquidhub.SOURCE, 'liquidhub')
  assert.equal(liquidhub.COMPANY, 'LiquidHub')
  assert.equal(liquidhub.VERIFIED_ON, '2026-07-18')
  assert.equal(liquidhub.ROOT_URL, 'https://www.liquidhub.com/')
  assert.equal(liquidhub.REDIRECTED_HOMEPAGE_URL, 'https://www.capgemini.com/')
  assert.equal(liquidhub.hasRedirectedHomepageSignal(REDIRECTED_CAPGEMINI_HTML), true)
  assert.equal(liquidhub.hasPublicJobsSignal(REDIRECTED_CAPGEMINI_HTML), false)
  assert.equal(liquidhub.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('LiquidHub returns [] only while the exact-name root stays a generic Capgemini redirect', async () => {
  const liquidhub = await loadModule()
  const requestedUrls = []

  const jobs = await liquidhub.createLiquidHubScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === liquidhub.ROOT_URL) {
        return {
          status: 200,
          url: liquidhub.REDIRECTED_HOMEPAGE_URL,
          html: REDIRECTED_CAPGEMINI_HTML,
        }
      }

      throw new Error(`Unexpected LiquidHub URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [liquidhub.ROOT_URL])
  assert.deepEqual(jobs, [])
})

test('LiquidHub fails closed when the verified redirect drifts or the exact-name domain starts exposing public jobs', async () => {
  const liquidhub = await loadModule()

  await assert.rejects(
    liquidhub.createLiquidHubScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: liquidhub.ROOT_URL,
        html: REDIRECTED_CAPGEMINI_HTML,
      }),
    }),
    /verified exact-name root redirect/i,
  )

  await assert.rejects(
    liquidhub.createLiquidHubScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: liquidhub.REDIRECTED_HOMEPAGE_URL,
        html: PUBLIC_JOBS_HTML,
      }),
    }),
    /exact-name domain now appears to expose public jobs/i,
  )
})
