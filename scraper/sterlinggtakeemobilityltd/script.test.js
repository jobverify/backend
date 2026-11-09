import assert from 'node:assert/strict'
import test from 'node:test'

const loadSterlingGtakeModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Sterling Gtake E-mobility Ltd scraper module at ./script.js')
  }
}

const parkedShellHtml = `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <title>www.sterlinggtake.com</title>
    </head>
    <body>
      <a href="https://www.cloudns.net/" title="Cloud DNS" target="_blank">
        <img src="/images/logo-black-net-150x150.png" alt="Cloud DNS" />
      </a>
      <div>
        <h1 style="color: #ffa900;">www.sterlinggtake.com</h1>
        <h2>This domain is registered for one of our customers.</h2>
        <p>
          If this is your domain name, please
          <a href="https://www.cloudns.net/wiki/article/29/" target="_blank">visit this page</a>
          to see how to register it as DNS zone into your account.
        </p>
        <p>
          Note: If you already have registered the DNS zone for your domain name, please wait for DNS
          propagation. Your web site will be displayed soon. It may take few minutes.
        </p>
      </div>
      <div id="footer">
        <a href="https://www.cloudns.net/domain-parking/">Domain parking</a>
      </div>
    </body>
  </html>
`

test('Sterling Gtake E-mobility Ltd sentinel recognizes the verified parked first-party shell', async () => {
  const sterling = await loadSterlingGtakeModule()

  assert.equal(sterling.SOURCE, 'sterlinggtakeemobilityltd')
  assert.equal(sterling.COMPANY, 'Sterling Gtake E-mobility Ltd')
  assert.equal(sterling.HOMEPAGE_URL, 'https://www.sterlinggtake.com/')
  assert.deepEqual(sterling.CHECKED_ROUTE_URLS, [
    'https://www.sterlinggtake.com/careers/',
    'https://www.sterlinggtake.com/career/',
    'https://www.sterlinggtake.com/jobs/',
    'https://www.sterlinggtake.com/join-us/',
  ])
  assert.equal(sterling.hasVerifiedParkedShellSignal(parkedShellHtml), true)
  assert.equal(sterling.hasPublicJobsSignal(parkedShellHtml), false)
})

test('Sterling Gtake E-mobility Ltd returns no jobs only while the official domain remains a parked shell', async () => {
  const sterling = await loadSterlingGtakeModule()
  const requestedUrls = []

  const jobs = await sterling.createSterlingGtakeEmobilityLtdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: parkedShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    sterling.HOMEPAGE_URL,
    ...sterling.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Sterling Gtake E-mobility Ltd default fetch is bounded by a timeout signal', async () => {
  const sterling = await loadSterlingGtakeModule()
  let capturedInit = null

  const page = await sterling.defaultFetchPage(sterling.HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        status: 200,
        url,
        text: async () => parkedShellHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, sterling.HOMEPAGE_URL)
  assert.equal(page.html, parkedShellHtml)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Sterling Gtake E-mobility Ltd default fetch falls back to http when the https certificate is invalid', async () => {
  const sterling = await loadSterlingGtakeModule()
  const requestedUrls = []

  const page = await sterling.defaultFetchPage(sterling.HOMEPAGE_URL, {
    fetchImpl: async (url, init) => {
      requestedUrls.push(String(url))

      if (String(url).startsWith('https://')) {
        assert.equal(init.signal instanceof AbortSignal, true)
        const error = new TypeError('fetch failed')
        error.cause = { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }
        throw error
      }

      return {
        status: 200,
        url,
        text: async () => parkedShellHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.sterlinggtake.com/',
    'http://www.sterlinggtake.com/',
  ])
  assert.equal(page.status, 200)
  assert.equal(page.url, 'http://www.sterlinggtake.com/')
  assert.equal(page.html, parkedShellHtml)
})

test('Sterling Gtake E-mobility Ltd fails closed when the parked shell changes or exposes jobs', async () => {
  const sterling = await loadSterlingGtakeModule()

  await assert.rejects(
    sterling.createSterlingGtakeEmobilityLtdScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><head><title>Unexpected</title></head><body>Different</body></html>',
      }),
    }),
    /verified parked shell/i,
  )

  await assert.rejects(
    sterling.createSterlingGtakeEmobilityLtdScraper().run({
      fetchPage: async (url) => {
        if (url === sterling.CHECKED_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Careers</h1>
                  <a href="https://jobs.lever.co/sterlinggtake">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        return {
          status: 200,
          url,
          html: parkedShellHtml,
        }
      },
    }),
    /checked first-party route changed|public jobs/i,
  )
})
