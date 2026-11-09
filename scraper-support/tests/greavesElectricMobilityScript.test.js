import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Greaves Electric Mobility</title>
  </head>
  <body>
    <main>
      <p>CAREERS</p>
      <h1>We take charge of an electric future for all. If you&#039;re one of us, join our squad.</h1>
      <h3>Open Positions</h3>
      <p>Hello Technovators, explore opportunities in Design, Technology, Sales, and many more interesting functions.</p>
      <a href="https://peopleatgems.kekahire.com/">View Jobs</a>
      <footer>
        <p>customersupport@greaveselectricmobility.com</p>
        <p>© 2026 | Greaves Electric Mobility Limited</p>
      </footer>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://peopleatgems.kekahire.com/careers/jobdetails/150115">Battery Systems Engineer</a>
    <a href="https://peopleatgems.kekahire.com/careers/applyjob/150115">Apply now</a>
  </body>
</html>
`

const OPAQUE_KEKA_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body></body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/greaveselectricmobility/script.js')
  } catch {
    assert.fail('Expected Greaves Electric Mobility scraper module at ../../scraper/greaveselectricmobility/script.js')
  }
}

test('Greaves Electric Mobility sentinel helpers stay pinned to the verified first-party careers page and Keka handoff', async () => {
  const greavesElectricMobility = await loadScriptModule()

  assert.equal(greavesElectricMobility.SOURCE, 'greaveselectricmobility')
  assert.equal(greavesElectricMobility.COMPANY, 'Greaves Electric Mobility')
  assert.equal(greavesElectricMobility.OFFICIAL_BRAND_NAME, 'Greaves Electric Mobility Limited')
  assert.equal(greavesElectricMobility.VERIFIED_ON, '2026-07-17')
  assert.equal(greavesElectricMobility.CAREERS_PAGE_URL, 'https://greaveselectricmobility.com/careers')
  assert.equal(greavesElectricMobility.OFFICIAL_CAREERS_HANDOFF_URL, 'https://peopleatgems.kekahire.com/')
  assert.equal(greavesElectricMobility.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    greavesElectricMobility.extractOfficialKekaHandoffUrl(OFFICIAL_CAREERS_HTML),
    'https://peopleatgems.kekahire.com/',
  )
  assert.equal(greavesElectricMobility.pageExposesPublicJobListings(OFFICIAL_CAREERS_HTML), false)
  assert.equal(greavesElectricMobility.pageExposesPublicJobListings(OPAQUE_KEKA_HTML), false)
  assert.equal(greavesElectricMobility.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    greavesElectricMobility.isExpectedVerificationFailure({
      message: 'fetch failed',
      cause: {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: peopleatgems.kekahire.com:443, timeout: 10000ms)',
      },
    }),
    true,
  )
  assert.equal(
    greavesElectricMobility.isExpectedVerificationFailure({
      message: 'The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.',
    }),
    true,
  )
  assert.equal(
    greavesElectricMobility.isExpectedVerificationFailure({
      message: 'fetch failed',
      cause: {
        message: 'certificate has expired',
      },
    }),
    true,
  )
})

test('Greaves Electric Mobility returns [] only while the verified first-party page still hands off to an unreachable Keka surface', async () => {
  const greavesElectricMobility = await loadScriptModule()
  const requestedPages = []

  const jobs = await greavesElectricMobility.createGreavesElectricMobilityScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === greavesElectricMobility.CAREERS_PAGE_URL) {
        return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
      }

      if (url === greavesElectricMobility.OFFICIAL_CAREERS_HANDOFF_URL) {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: {
            code: 'UND_ERR_CONNECT_TIMEOUT',
            message: 'Connect Timeout Error (attempted address: peopleatgems.kekahire.com:443, timeout: 10000ms)',
          },
        })
      }

      throw new Error(`Unexpected Greaves Electric Mobility page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    greavesElectricMobility.CAREERS_PAGE_URL,
    greavesElectricMobility.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Greaves Electric Mobility fails closed when the verified careers page drifts or the Keka handoff becomes reachable for re-verification', async () => {
  const greavesElectricMobility = await loadScriptModule()

  await assert.rejects(
    greavesElectricMobility.createGreavesElectricMobilityScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified greaves electric mobility careers page/i,
  )

  await assert.rejects(
    greavesElectricMobility.createGreavesElectricMobilityScraper().run({
      fetchPage: async (url) => {
        if (url === greavesElectricMobility.CAREERS_PAGE_URL) {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }

        return {
          status: 200,
          url: greavesElectricMobility.OFFICIAL_CAREERS_HANDOFF_URL,
          html: OPAQUE_KEKA_HTML,
        }
      },
    }),
    /keka handoff requires re-verification/i,
  )

  await assert.rejects(
    greavesElectricMobility.createGreavesElectricMobilityScraper().run({
      fetchPage: async (url) => {
        if (url === greavesElectricMobility.CAREERS_PAGE_URL) {
          return { status: 200, url, html: OFFICIAL_CAREERS_HTML }
        }

        return {
          status: 200,
          url: greavesElectricMobility.OFFICIAL_CAREERS_HANDOFF_URL,
          html: PUBLIC_JOBS_HTML,
        }
      },
    }),
    /appears to expose public jobs/i,
  )
})
