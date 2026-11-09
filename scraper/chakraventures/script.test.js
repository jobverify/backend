import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const redirectShellHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>
        window.onload = function () {
          window.location.href = "/lander"
        }
      </script>
    </head>
  </html>
`

const parkedLanderHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
      <script>window.LANDER_SYSTEM="PW"</script>
      <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
      <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
      <script defer src="https://img1.wsimg.com/parking-lander/static/js/main.98fc5cd3.js"></script>
      <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet" />
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

test('Chakra Ventures sentinel recognizes the verified parked first-party surface', async () => {
  const chakraventures = await loadModule()

  assert.equal(chakraventures.SOURCE, 'chakraventures')
  assert.equal(chakraventures.COMPANY, 'Chakra Ventures')
  assert.equal(chakraventures.VERIFIED_AT, '2026-08-13')
  assert.equal(chakraventures.HOMEPAGE_URL, 'https://chakraventures.com/')
  assert.equal(chakraventures.CAREERS_URL, 'https://chakraventures.com/careers')
  assert.equal(chakraventures.JOBS_URL, 'https://chakraventures.com/jobs')
  assert.equal(chakraventures.LANDER_URL, 'https://chakraventures.com/lander')
  assert.deepEqual(chakraventures.FIRST_PARTY_TIMEOUT_URLS, [
    'https://chakraventures.com/',
    'https://chakraventures.com/careers',
    'https://chakraventures.com/jobs',
    'https://chakraventures.com/lander',
  ])

  assert.equal(chakraventures.hasRedirectToLanderSignal(redirectShellHtml), true)
  assert.equal(chakraventures.hasRedirectToLanderSignal(parkedLanderHtml), false)
  assert.equal(chakraventures.hasParkedLanderSignal(parkedLanderHtml), true)
  assert.equal(chakraventures.hasParkedLanderSignal('<html><body>Careers at Chakra Ventures</body></html>'), false)
  assert.equal(chakraventures.hasPublicJobListingsSignal(redirectShellHtml), false)
  assert.equal(chakraventures.hasPublicJobListingsSignal(parkedLanderHtml), false)
  assert.equal(chakraventures.isExpectedTimedOutSurface({ errorKind: 'timeout', status: null, html: null }), true)
  assert.equal(chakraventures.isExpectedTimedOutSurface({ errorKind: 'dns' }), false)
})

test('Chakra Ventures sentinel returns no jobs only while the verified parked surface remains unchanged', async () => {
  const chakraventures = await loadModule()
  const requests = []

  const jobs = await chakraventures.createChakraVenturesScraper().run({
    fetchText: async (url) => {
      requests.push(url)

      if (
        url === chakraventures.HOMEPAGE_URL
        || url === chakraventures.CAREERS_URL
        || url === chakraventures.JOBS_URL
      ) {
        return redirectShellHtml
      }

      if (url === chakraventures.LANDER_URL) {
        return parkedLanderHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    chakraventures.HOMEPAGE_URL,
    chakraventures.CAREERS_URL,
    chakraventures.JOBS_URL,
    chakraventures.LANDER_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Chakra Ventures sentinel returns no jobs when the current verified first-party routes all time out', async () => {
  const chakraventures = await loadModule()
  const requests = []

  const jobs = await chakraventures.createChakraVenturesScraper().run({
    probeUrl: async (url) => {
      requests.push(url)

      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requests, chakraventures.FIRST_PARTY_TIMEOUT_URLS)
  assert.deepEqual(jobs, [])
})

test('Chakra Ventures sentinel fails closed if a first-party route starts exposing public jobs', async () => {
  const chakraventures = await loadModule()

  await assert.rejects(
    chakraventures.createChakraVenturesScraper().run({
      fetchText: async (url) => {
        if (url === chakraventures.CAREERS_URL) {
          return `
            <html>
              <body>
                <h1>Careers</h1>
                <h2>Open Roles</h2>
                <a href="/jobs/founding-engineer">Apply now</a>
              </body>
            </html>
          `
        }

        if (url === chakraventures.LANDER_URL) {
          return parkedLanderHtml
        }

        return redirectShellHtml
      },
    }),
    /public jobs|verified parked first-party surface/i,
  )
})
