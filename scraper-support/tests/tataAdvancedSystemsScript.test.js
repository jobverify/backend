import assert from 'node:assert/strict'
import test from 'node:test'

const loadTataAdvancedSystemsModule = async () => {
  try {
    return await import('../../scraper/tataadvancedsystems/script.js')
  } catch {
    assert.fail('Expected Tata Advanced Systems scraper module at ../../scraper/tataadvancedsystems/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head>
      <title>Careers | Tata Advanced Systems</title>
    </head>
    <body>
      <main>
        <h1>We Provide Multiple Career Opportunities to Professionals</h1>
        <a href="https://chroma.tcsapps.com/webhcm/tslt/careers">Find open positions here</a>
        <p>Looking to build your career with Tata Advanced Systems? Click here to apply for open positions.</p>
        <p>Join Our Talent Community</p>
        <p>For career opportunities, write to us at career@tataadvancedsystems.com</p>
      </main>
    </body>
  </html>
`

const portalShellHtml = `
  <html>
    <body>
      <button>Register</button>
      <button>Login</button>
      <h1>Career Portal</h1>
      <div>Saved Search</div>
      <footer>Powered by TCS Platform Solutions</footer>
    </body>
  </html>
`

test('recognizes the verified Tata Advanced Systems careers page and TCS platform shell signals', async () => {
  const tataAdvancedSystems = await loadTataAdvancedSystemsModule()

  assert.equal(tataAdvancedSystems.CAREERS_PAGE_URL, 'https://www.tataadvancedsystems.com/careers')
  assert.equal(tataAdvancedSystems.PORTAL_URL, 'https://chroma.tcsapps.com/webhcm/tslt/careers')
  assert.equal(tataAdvancedSystems.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(tataAdvancedSystems.hasPortalHandoffSignal(careersPageHtml), true)
  assert.equal(
    tataAdvancedSystems.hasPortalShellSignal({ status: 200, html: portalShellHtml }),
    true,
  )
  assert.equal(
    tataAdvancedSystems.hasPortalShellSignal({ status: 200, html: '<html><body>Portal</body></html>' }),
    false,
  )
})

test('run returns no jobs after validating the official Tata Advanced Systems careers page while the TCS host stays unreachable', async () => {
  const tataAdvancedSystems = await loadTataAdvancedSystemsModule()
  const requestedUrls = []

  const jobs = await tataAdvancedSystems.createTataAdvancedSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tataAdvancedSystems.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === tataAdvancedSystems.PORTAL_URL) {
        throw new Error('connect ETIMEDOUT chroma.tcsapps.com')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tataAdvancedSystems.CAREERS_PAGE_URL,
    tataAdvancedSystems.PORTAL_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run returns no jobs when the linked TCS platform page still matches the verified shell', async () => {
  const tataAdvancedSystems = await loadTataAdvancedSystemsModule()

  const jobs = await tataAdvancedSystems.createTataAdvancedSystemsScraper().run({
    fetchPage: async (url) => {
      if (url === tataAdvancedSystems.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === tataAdvancedSystems.PORTAL_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the official Tata Advanced Systems careers page no longer exposes the verified public TCS handoff', async () => {
  const tataAdvancedSystems = await loadTataAdvancedSystemsModule()

  await assert.rejects(
    tataAdvancedSystems.createTataAdvancedSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === tataAdvancedSystems.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Careers</h1>
                  <p>Tata Advanced Systems</p>
                  <p>Find open positions here</p>
                  <p>Click here to apply for open positions.</p>
                  <p>Join Our Talent Community</p>
                  <p>For career opportunities, write to us at career@tataadvancedsystems.com</p>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public tcs handoff/i,
  )
})

test('run fails closed when the downstream portal no longer matches the verified shell or unreachable state', async () => {
  const tataAdvancedSystems = await loadTataAdvancedSystemsModule()

  await assert.rejects(
    tataAdvancedSystems.createTataAdvancedSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === tataAdvancedSystems.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === tataAdvancedSystems.PORTAL_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Career Portal</h1><a href="/jobs/42">Role</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified shell or unreachable state/i,
  )
})
