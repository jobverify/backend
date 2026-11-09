import assert from 'node:assert/strict'
import test from 'node:test'

const loadAtherEnergyModule = async () => {
  try {
    return await import('../../scraper/atherenergy/script.js')
  } catch {
    assert.fail('Expected Ather Energy scraper module at ../../scraper/scraper/atherenergy/script.js')
  }
}

const careersHomeHtml = `
  <html>
    <head>
      <title>Be the Story | Join Ather</title>
    </head>
    <body>
      <a href="/jobs">All jobs</a>
      <h1>Be the story</h1>
      <p>Join us for our next moonshot</p>
    </body>
  </html>
`

const allJobsHtml = `
  <html>
    <head>
      <title>All Jobs | Careers at Ather</title>
    </head>
    <body>
      <h1>All jobs</h1>
      <p>No open jobs in this team / location right now</p>
      <p>Check back in later for the right fit.</p>
    </body>
  </html>
`

const cloudflareBlockedPageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Attention Required! | Cloudflare</title>
    </head>
    <body>
      <p>Please enable cookies.</p>
      <h1>Sorry, you have been blocked</h1>
      <p>You are unable to access atherenergy.com</p>
      <p>Cloudflare Ray ID: 8f1e4b92c5e44e21</p>
    </body>
  </html>
`

test('extractJobs returns no jobs when the official Ather careers page shows no open roles', async () => {
  const atherenergy = await loadAtherEnergyModule()

  assert.equal(atherenergy.hasCareersHomeSignal(careersHomeHtml), true)
  assert.equal(atherenergy.hasJobsPageSignal(allJobsHtml), true)
  assert.equal(atherenergy.hasNoOpenJobsSignal(allJobsHtml), true)
  assert.deepEqual(atherenergy.extractJobs(allJobsHtml), [])
})

test('run fetches the official Ather careers pages but empty-filter copy cannot prove zero native openings', async () => {
  const atherenergy = await loadAtherEnergyModule()
  const requestedUrls = []

  await assert.rejects(atherenergy.createAtherEnergyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === atherenergy.CAREERS_HOME_URL) {
        return careersHomeHtml
      }

      if (url === atherenergy.ALL_JOBS_URL) {
        return allJobsHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.failureKind === 'source_inventory_unavailable'
    && error.inventoryEvidence.listingComplete === false
    && error.inventoryEvidence.reportedTotal === null)

  assert.deepEqual(requestedUrls, [
    atherenergy.CAREERS_HOME_URL,
    atherenergy.ALL_JOBS_URL,
  ])
})

test('run reports an API-only migration error when direct HTTP access to Ather careers is blocked', async () => {
  const atherenergy = await loadAtherEnergyModule()

  await assert.rejects(
    atherenergy.createAtherEnergyScraper().run({
      fetchText: async (url) => { throw new Error(`HTTP 403 for ${url}`) },
      fetchBrowserText: async () => assert.fail('Ather Energy must not launch a browser'),
    }),
    (error) => {
      assert.match(error.message, /ather energy API-only migration.*HTTP 403/i)
      assert.equal(error.abortRetries, true)
      return true
    },
  )
})

test('run rejects the first Cloudflare-blocked route with unknown inventory', async () => {
  const atherenergy = await loadAtherEnergyModule()
  const requestedPageUrls = []

  await assert.rejects(atherenergy.createAtherEnergyScraper().run({
    fetchText: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchPage: async (url) => {
      requestedPageUrls.push(url)
      return {
        status: 403,
        url,
        html: cloudflareBlockedPageHtml,
      }
    },
  }), /HTTP 403/)

  assert.deepEqual(requestedPageUrls, [
    atherenergy.CAREERS_HOME_URL,
  ])
})
