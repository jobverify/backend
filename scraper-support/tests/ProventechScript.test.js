import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedLoginShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ProvenTech</title>
  </head>
  <body>
    <section class="login-shell">
      <p>Powered by ProvenTech</p>
      <p>ProvenTech Human Resource Management System allows employees to access HR-related information.</p>
      <button>Login</button>
      <a href="/forgot-password">Forgot Password?</a>
    </section>
  </body>
</html>
`

const missingCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found at /careers</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const missingJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found at /jobs</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/proventech/script.js')
  } catch {
    assert.fail('Expected Proventech scraper module at ../../scraper/proventech/script.js')
  }
}

test('Proventech bounds response-body reads and propagates their timeout', async (t) => {
  const proventech = await loadModule()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(options.signal, 'Each request needs an abort signal, including its body read')
    return {
      status: 200,
      url,
      text: () => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      }),
    }
  })
  // Keep the test alive while AbortSignal.timeout's unref'ed deadline runs.
  const keepAlive = setInterval(() => {}, 1000)
  t.after(() => clearInterval(keepAlive))
  await assert.rejects(proventech.run({ requestTimeoutMs: 20 }), { name: 'TimeoutError' })
})

test('Proventech propagates caller cancellation without requesting later routes', async (t) => {
  const proventech = await loadModule()
  const controller = new AbortController()
  const cancellation = new Error('Source cancelled')
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests += 1
    assert.ok(options.signal, 'The source cancellation signal must reach fetch')
    controller.abort(cancellation)
    options.signal.throwIfAborted()
  })
  await assert.rejects(proventech.run({ signal: controller.signal }), (error) => error === cancellation)
  assert.equal(requests, 1)
})

test('Proventech rejects an already cancelled source before making a request', async (t) => {
  const proventech = await loadModule()
  const cancellation = new Error('Source cancelled before start')
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1
    throw new Error('Unexpected request after cancellation')
  })
  await assert.rejects(proventech.run({ signal: AbortSignal.abort(cancellation) }), (error) => error === cancellation)
  assert.equal(requests, 0)
})

test('Proventech preserves upstream HTTP status instead of reporting page drift', async () => {
  const proventech = await loadModule()
  await assert.rejects(proventech.run({
    fetchPage: async (url) => ({ status: 503, url, html: 'Service unavailable' }),
  }), /HTTP 503/)
})

test('Proventech helpers stay pinned to the verified HRMS login shell and missing careers routes from Tuesday, August 4, 2026', async () => {
  const proventech = await loadModule()

  assert.equal(proventech.SOURCE, 'proventech')
  assert.equal(proventech.COMPANY, 'Proventech')
  assert.equal(proventech.HOMEPAGE_URL, 'https://hr.proventech.in/')
  assert.deepEqual(proventech.CAREERS_ROUTE_URLS, [
    'https://hr.proventech.in/careers',
    'https://hr.proventech.in/jobs',
  ])
  assert.equal(proventech.PROVIDER_METADATA.companyCareerPage, 'https://hr.proventech.in/')
  assert.equal(proventech.PROVIDER_METADATA.verifiedOn, '2026-08-04')
  assert.equal(proventech.hasVerifiedLoginShellSignal(verifiedLoginShellHtml), true)
  assert.equal(proventech.hasPublicJobsSignal(verifiedLoginShellHtml), false)
  assert.equal(
    proventech.isExpectedMissingCareerRoute({
      status: 404,
      url: proventech.CAREERS_ROUTE_URLS[0],
      html: missingCareersHtml,
    }),
    true,
  )
  assert.equal(
    proventech.isExpectedMissingCareerRoute({
      status: 404,
      url: proventech.CAREERS_ROUTE_URLS[1],
      html: missingJobsHtml,
    }),
    true,
  )
})

test('Proventech run validates the verified login shell and returns [] while public careers routes stay missing', async () => {
  const proventech = await loadModule()
  const requestedUrls = []

  const jobs = await proventech.createProventechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === proventech.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedLoginShellHtml }
      }

      if (url === proventech.CAREERS_ROUTE_URLS[0]) {
        return { status: 404, url, html: missingCareersHtml }
      }

      if (url === proventech.CAREERS_ROUTE_URLS[1]) {
        return { status: 404, url, html: missingJobsHtml }
      }

      throw new Error(`Unexpected Proventech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    proventech.HOMEPAGE_URL,
    ...proventech.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Proventech run fails closed when the verified login shell drifts or a careers route starts exposing public jobs', async () => {
  const proventech = await loadModule()

  await assert.rejects(
    proventech.createProventechScraper().run({
      fetchPage: async (url) => {
        if (url === proventech.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 404, url, html: missingCareersHtml }
      },
    }),
    /HRMS login shell changed materially/i,
  )

  await assert.rejects(
    proventech.createProventechScraper().run({
      fetchPage: async (url) => {
        if (url === proventech.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedLoginShellHtml }
        }

        if (url === proventech.CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a>Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: missingJobsHtml }
      },
    }),
    /no-public-careers route changed materially/i,
  )
})
