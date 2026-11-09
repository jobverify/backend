import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | SREI</title>
    <link rel="canonical" href="https://www.srei.com/careers" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <a href="https://www.myemploywise.com/asperm/servlet/website?customer_code=srei">Work with us</a>
      <h2>Beyond Work</h2>
      <p>Any Queries ?</p>
      <p>Mail Us</p>
    </main>
  </body>
</html>
`

const employWiseShellPage = {
  status: 200,
  url: 'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Open Positions</title>
      </head>
      <body>
        <h1>Open Positions</h1>
        <label>Search by function(s)</label>
        <label>Keywords</label>
        <div>Please wait....</div>
        <div>Please wait....</div>
      </body>
    </html>
  `,
}

const currentCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Srei |  Srei Infrastructure Financing Solutions</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <a href="https://www.myemploywise.com/asperm/servlet/website?customer_code=srei">Work with us</a>
      <h2>Beyond Work</h2>
      <p>Any Queries ?</p>
      <p>Mail Us</p>
    </main>
  </body>
</html>
`

const currentEmployWiseShellPage = {
  status: 200,
  url: 'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Web View</title>
      </head>
      <body>
        <h1>Open Positions</h1>
        <div>Search by function(s)</div>
        <div>Please wait....</div>
        <div>Please wait....</div>
        <div>Please wait....</div>
      </body>
    </html>
  `,
}

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Positions</h1>
    <table>
      <tr>
        <td>Relationship Manager</td>
        <td>Kolkata</td>
        <td>
          <a href="/asperm/servlet/website/Recruitment_PositionS?position_code=RM-001">
            Apply Now
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/srei/script.js')
  } catch {
    assert.fail('Expected SREI scraper module at ../../scraper/srei/script.js')
  }
}

test('SREI helpers stay pinned to the verified first-party careers handoff from Friday, July 17, 2026', async () => {
  const srei = await loadModule()

  assert.equal(srei.SOURCE, 'srei')
  assert.equal(srei.COMPANY, 'SREI')
  assert.equal(srei.CAREERS_URL, 'https://www.srei.com/careers')
  assert.equal(
    srei.JOB_LISTINGS_URL,
    'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  )
  assert.equal(srei.PORTAL_ORIGIN, 'https://www.myemploywise.com')
  assert.equal(srei.VERIFIED_ON, '2026-07-17')
  assert.match(srei.VERIFIED_SURFACE_SUMMARY, /SREI/i)
  assert.equal(srei.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(
    srei.extractVerifiedEmployWiseUrl(careersPageHtml),
    'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  )
  assert.equal(srei.hasBlockedEmployWiseShellSignal(employWiseShellPage), true)
  assert.equal(srei.hasPublicJobListingsSignal(publicJobsHtml), true)
})

test('SREI returns no jobs only while the verified first-party handoff still resolves to the unresolved EmployWise shell', async () => {
  const srei = await loadModule()
  const requestedUrls = []

  const jobs = await srei.createSreiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === srei.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === srei.JOB_LISTINGS_URL) {
        return employWiseShellPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    srei.CAREERS_URL,
    srei.JOB_LISTINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SREI still returns [] when the current first-party careers page and EmployWise shell drift to the live August 4, 2026 markup', async () => {
  const srei = await loadModule()

  assert.equal(srei.hasOfficialCareersSignal(currentCareersPageHtml), true)
  assert.equal(srei.hasBlockedEmployWiseShellSignal(currentEmployWiseShellPage), true)

  const jobs = await srei.createSreiScraper().run({
    fetchPage: async (url) => {
      if (url === srei.CAREERS_URL) {
        return { status: 200, url, html: currentCareersPageHtml }
      }

      if (url === srei.JOB_LISTINGS_URL) {
        return currentEmployWiseShellPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('SREI default fetches are bounded by AbortSignals while validating the unresolved EmployWise shell', async () => {
  const srei = await loadModule()
  const originalFetch = globalThis.fetch
  const fetchCalls = []

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })

    if (url === srei.CAREERS_URL) {
      return {
        status: 200,
        url,
        text: async () => careersPageHtml,
      }
    }

    if (url === srei.JOB_LISTINGS_URL) {
      return {
        status: employWiseShellPage.status,
        url: employWiseShellPage.url,
        text: async () => employWiseShellPage.html,
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await srei.createSreiScraper().run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(fetchCalls.map((call) => call.url), [
      srei.CAREERS_URL,
      srei.JOB_LISTINGS_URL,
    ])
    assert.equal(fetchCalls.every((call) => call.options.signal instanceof AbortSignal), true)
    assert.equal(fetchCalls.every((call) => call.options.signal.aborted === false), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('SREI fails closed when the verified careers page, handoff, or unresolved EmployWise shell drifts', async () => {
  const srei = await loadModule()

  await assert.rejects(
    srei.createSreiScraper().run({
      fetchPage: async (url) => {
        if (url === srei.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }

        return employWiseShellPage
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    srei.createSreiScraper().run({
      fetchPage: async (url) => {
        if (url === srei.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml.replace(
              'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
              'https://example.com/jobs',
            ),
          }
        }

        return employWiseShellPage
      },
    }),
    /verified EmployWise handoff/i,
  )

  await assert.rejects(
    srei.createSreiScraper().run({
      fetchPage: async (url) => {
        if (url === srei.CAREERS_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === srei.JOB_LISTINGS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no longer matches the verified unresolved state/i,
  )
})
