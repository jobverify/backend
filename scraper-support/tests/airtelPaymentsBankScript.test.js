import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Airtel Payments Bank: The Safe Second Account for Daily Transactions</title>
  </head>
  <body>
    <h1>Keep Your Main Account Safe</h1>
    <p>Open a Safe Second Account with Airtel Payments Bank</p>
    <p>Empowering Indians, Everywhere.</p>
    <a href="/static/about-us">About Us</a>
    <span>News, Blogs & Awards</span>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html>
  <head>
    <title>About Us | Airtel Payments Bank</title>
  </head>
  <body>
    <h1>About Airtel Payments Bank</h1>
    <p>the parent company's Banking Venture</p>
    <p>As India's first Payments Bank, we aim to give every Indian access to an equal, effective, and trustworthy banking experience.</p>
    <p>Airtel Payments Bank was launched in January 2017, by the parent company, India's largest telecom provider, to support the cashless revolution promised by the Government of India.</p>
    <h2>Meet our board of directors</h2>
  </body>
</html>
`

const careersShellHtml = `
<!doctype html>
<html>
  <head>
    <title>Airtel Careers</title>
    <meta name="description" content="Airtel Careers">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="/static/js/main.123456.js"></script>
  </body>
</html>
`

const bundleText = `
window.__CAREERS_CONFIG__ = {
  "brand":"Airtel Payments Bank",
  "darwinboxURL":"https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs",
  "apiUrl":"https://careersapi.airtel.com/"
};
`

const darwinboxShellHtml = `
<!doctype html>
<html>
  <head>
    <base href="/ms/candidatev2/">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
    <script type="module" src="db-components.esm.js"></script>
  </head>
  <body></body>
</html>
`

const cloudflareGuardHtml = `
<!doctype html>
<html>
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Attention Required!</h1>
    <p>Please enable cookies.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/airtelpaymentsbank/script.js')
  } catch {
    assert.fail('Expected Airtel Payments Bank scraper module at ../../scraper/airtelpaymentsbank/script.js')
  }
}

test('Airtel Payments Bank validators accept the verified homepage and the current about-page wording from Saturday, July 25, 2026', async () => {
  const airtel = await loadModule()

  assert.equal(airtel.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(airtel.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(airtel.hasSharedAirtelCareersShellSignal(careersShellHtml), true)
  assert.equal(airtel.hasVerifiedSharedBundleSignal(bundleText), true)
  assert.equal(airtel.hasSharedDarwinboxShellSignal(darwinboxShellHtml), true)
})

test('Airtel Payments Bank run stays empty while the shared Airtel careers shell still has no distinct public jobs route for the bank', async () => {
  const airtel = await loadModule()
  const bundleUrl = airtel.extractMainBundleUrl(careersShellHtml)
  const fixtureByUrl = new Map([
    [airtel.HOMEPAGE_URL, homepageHtml],
    [airtel.ABOUT_PAGE_URL, aboutHtml],
    [airtel.PARENT_CAREERS_URL, careersShellHtml],
    [bundleUrl, bundleText],
    [airtel.SHARED_DARWINBOX_URL, darwinboxShellHtml],
  ])

  const jobs = await airtel.createAirtelPaymentsBankScraper().run({
    fetchText: async (url) => {
      if (!fixtureByUrl.has(url)) {
        throw new Error(`Unexpected URL: ${url}`)
      }

      return fixtureByUrl.get(url)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Airtel Payments Bank stays empty when the branded bank pages are Cloudflare-guarded but shared Airtel careers surfaces remain verified', async () => {
  const airtel = await loadModule()
  const bundleUrl = airtel.extractMainBundleUrl(careersShellHtml)
  const browserUrls = []

  const jobs = await airtel.createAirtelPaymentsBankScraper().run({
    fetchText: async (url) => {
      if (url === airtel.HOMEPAGE_URL || url === airtel.ABOUT_PAGE_URL) {
        const error = new Error(`HTTP 403 for ${url}`)
        error.status = 403
        error.body = cloudflareGuardHtml
        throw error
      }

      if (url === airtel.PARENT_CAREERS_URL) {
        return careersShellHtml
      }

      if (url === bundleUrl) {
        return bundleText
      }

      if (url === airtel.SHARED_DARWINBOX_URL) {
        return darwinboxShellHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      throw new Error(`Browser fallback should not be used for ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [])
  assert.deepEqual(jobs, [])
})

test('Airtel Payments Bank default fetch probes Cloudflare-guarded branded pages once before continuing on shared Airtel surfaces', async () => {
  const airtel = await loadModule()
  const bundleUrl = airtel.extractMainBundleUrl(careersShellHtml)
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalConsoleWarn = console.warn
  const attemptsByUrl = new Map()

  globalThis.setTimeout = (callback) => {
    callback()
    return 0
  }
  globalThis.clearTimeout = () => {}
  console.warn = () => {}
  globalThis.fetch = async (url) => {
    const normalizedUrl = String(url)
    const nextAttempt = (attemptsByUrl.get(normalizedUrl) || 0) + 1
    attemptsByUrl.set(normalizedUrl, nextAttempt)

    if (normalizedUrl === airtel.HOMEPAGE_URL || normalizedUrl === airtel.ABOUT_PAGE_URL) {
      return new Response(cloudflareGuardHtml, {
        status: 403,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      })
    }

    if (normalizedUrl === airtel.PARENT_CAREERS_URL) {
      return new Response(careersShellHtml, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      })
    }

    if (normalizedUrl === bundleUrl) {
      return new Response(bundleText, {
        status: 200,
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
        },
      })
    }

    if (normalizedUrl === airtel.SHARED_DARWINBOX_URL) {
      return new Response(darwinboxShellHtml, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      })
    }

    throw new Error(`Unexpected URL: ${normalizedUrl}`)
  }

  try {
    const jobs = await airtel.createAirtelPaymentsBankScraper().run()
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    console.warn = originalConsoleWarn
  }

  assert.equal(attemptsByUrl.get(airtel.HOMEPAGE_URL), 1)
  assert.equal(attemptsByUrl.get(airtel.ABOUT_PAGE_URL), 1)
  assert.equal(attemptsByUrl.get(airtel.PARENT_CAREERS_URL), 1)
  assert.equal(attemptsByUrl.get(bundleUrl), 1)
  assert.equal(attemptsByUrl.get(airtel.SHARED_DARWINBOX_URL), 1)
  assert.equal(attemptsByUrl.size, 5)
})
