import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Odico scraper module at ./script.js')
  }
}

const buildSedoChallengeHtml = (domain) => `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Just a moment...</title>
      <meta name="robots" content="noindex,nofollow">
    </head>
    <body>
      <div class="main-content">
        <noscript>
          <span id="challenge-error-text">Enable JavaScript and cookies to continue</span>
        </noscript>
      </div>
      <script>
        window._cf_chl_opt = {
          cZone: 'sedo.com',
          cType: 'managed',
          cUPMDTk: "/search/details/?domain=${domain}&campaignId=329145&origin=sales_lander_15",
          fa: "/search/details/?domain=${domain}&campaignId=329145&origin=sales_lander_15"
        }
      </script>
    </body>
  </html>
`

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('Odico sentinel pins the verified parked and unresolved first-party contract from July 13, 2026', async () => {
  const odico = await loadModule()

  assert.equal(odico.SOURCE, 'odico')
  assert.equal(odico.COMPANY, 'Odico')
  assert.equal(odico.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(odico.PARKED_ROUTE_URLS, [
    'https://odico.com/',
    'https://odico.com/careers',
    'https://odico.com/jobs',
    'http://www.odico.com/',
    'http://www.odico.com/careers',
  ])
  assert.deepEqual(odico.UNRESOLVED_DOMAIN_URLS, [
    'https://odico.dk/',
    'https://www.odico.dk/',
  ])

  assert.equal(
    odico.hasVerifiedSedoParkingSignal(buildSedoChallengeHtml('odico.com'), 'odico.com'),
    true,
  )
  assert.equal(
    odico.hasVerifiedSedoParkingSignal(buildSedoChallengeHtml('www.odico.com'), 'www.odico.com'),
    true,
  )
  assert.equal(odico.hasPublicJobsSignal(buildSedoChallengeHtml('odico.com')), false)
  assert.equal(odico.hasDnsResolutionFailure('getaddrinfo ENOTFOUND odico.dk'), true)
  assert.equal(
    odico.isVerifiedUnresolvedFirstPartySurface(dnsFailurePage('https://odico.dk/')),
    true,
  )
  assert.equal(
    odico.isVerifiedParkedFirstPartySurface({
      status: 403,
      url: 'https://odico.com/',
      html: buildSedoChallengeHtml('odico.com'),
      errorMessage: '',
    }, 'odico.com'),
    true,
  )
})

test('Odico sentinel returns [] only while the verified parked and unresolved first-party surfaces remain unchanged', async () => {
  const odico = await loadModule()
  const requestedUrls = []

  const jobs = await odico.createOdicoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (odico.PARKED_ROUTE_URLS.includes(url)) {
        const domain = url.includes('www.odico.com') ? 'www.odico.com' : 'odico.com'
        return {
          status: 403,
          url,
          html: buildSedoChallengeHtml(domain),
          errorMessage: '',
        }
      }

      if (odico.UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return dnsFailurePage(url)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...odico.PARKED_ROUTE_URLS,
    ...odico.UNRESOLVED_DOMAIN_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Odico sentinel fails closed when a parked route or unresolved domain drifts into a live surface', async () => {
  const odico = await loadModule()

  await assert.rejects(
    odico.createOdicoScraper().run({
      fetchPage: async (url) => {
        if (url === odico.PARKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Odico Careers</title></head>
                <body>
                  <h1>Current Openings</h1>
                  <a href="/jobs/robotics-engineer">Apply now</a>
                </body>
              </html>
            `,
            errorMessage: '',
          }
        }

        if (odico.PARKED_ROUTE_URLS.includes(url)) {
          const domain = url.includes('www.odico.com') ? 'www.odico.com' : 'odico.com'
          return {
            status: 403,
            url,
            html: buildSedoChallengeHtml(domain),
            errorMessage: '',
          }
        }

        return dnsFailurePage(url)
      },
    }),
    /public route now appears to expose jobs/i,
  )

  await assert.rejects(
    odico.createOdicoScraper().run({
      fetchPage: async (url) => {
        if (url === odico.UNRESOLVED_DOMAIN_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Odico</h1></body></html>',
            errorMessage: '',
          }
        }

        if (odico.PARKED_ROUTE_URLS.includes(url)) {
          const domain = url.includes('www.odico.com') ? 'www.odico.com' : 'odico.com'
          return {
            status: 403,
            url,
            html: buildSedoChallengeHtml(domain),
            errorMessage: '',
          }
        }

        return dnsFailurePage(url)
      },
    }),
    /verified unresolved first-party surface changed/i,
  )
})
