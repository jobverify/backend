import assert from 'node:assert/strict'
import test from 'node:test'

const loadAvailModule = async () => {
  try {
    return await import('../../scraper/availfinance/script.js')
  } catch {
    assert.fail('Expected Avail Finance scraper module at ../../scraper/availfinance/script.js')
  }
}

const parkedHtml = `
  <html>
    <head><title>availfinance.com</title></head>
    <body>
      <script src="https://www.sedoparking.com/js/"></script>
      <a href="https://yoursupportservices.co.uk/">Contact</a>
    </body>
  </html>
`

test('Avail Finance scraper pins the verified parked-domain and unresolved-host sentinel surfaces', async () => {
  const avail = await loadAvailModule()

  assert.equal(avail.PARKED_ROUTE_URLS[0], 'https://availfinance.com/')
  assert.equal(avail.UNRESOLVED_DOMAIN_URLS[0], 'https://availfinance.in/')
  assert.equal(avail.hasVerifiedParkedSurface(parkedHtml), true)
  assert.equal(avail.hasUnavailableTlsFailure('self-signed certificate'), true)
  assert.equal(avail.hasDnsResolutionFailure('getaddrinfo ENOTFOUND availfinance.in'), true)
})

test('Avail Finance run returns no jobs when first-party routes remain parked or TLS-unavailable and India hosts are unresolved', async () => {
  const avail = await loadAvailModule()
  const requestedUrls = []

  const jobs = await avail.createAvailFinanceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (avail.PARKED_ROUTE_URLS.includes(url)) {
        return { status: 'TLS_ERROR', url, html: '', errorMessage: 'self-signed certificate' }
      }

      if (avail.UNRESOLVED_DOMAIN_URLS.includes(url)) {
        return { status: 'DNS_ERROR', url, html: '', errorMessage: 'getaddrinfo ENOTFOUND availfinance.in' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ...avail.PARKED_ROUTE_URLS,
    ...avail.UNRESOLVED_DOMAIN_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Avail Finance run fails closed when a parked route starts exposing public jobs', async () => {
  const avail = await loadAvailModule()

  await assert.rejects(
    avail.createAvailFinanceScraper().run({
      fetchPage: async (url) => {
        if (avail.PARKED_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="https://jobs.ashbyhq.com/availfinance">Apply now</a></body></html>',
            errorMessage: '',
          }
        }

        return { status: 'DNS_ERROR', url, html: '', errorMessage: 'getaddrinfo ENOTFOUND availfinance.in' }
      },
    }),
    /public jobs/i,
  )
})
