import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_HOME_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mahanagar Gas Limited, (MGL)</title>
  </head>
  <body>
    <header>Mahanagar Gas Limited</header>
    <a href="/residential-png">PNG Rate</a>
    <a href="/cng">CNG Rate</a>
    <p>Emergency No 18002669944</p>
    <a href="/CNG/Apply-for-CNG-Retail-Outlet">Apply for CNG retail Outlet</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mahanagargas/script.js')
  } catch {
    assert.fail('Expected Mahanagar Gas scraper module at ../../scraper/mahanagargas/script.js')
  }
}

test('Mahanagar Gas validates the reachable official shell for the current no-public-jobs state', async () => {
  const mahanagarGas = await loadScriptModule()

  assert.equal(mahanagarGas.SOURCE, 'mahanagargas')
  assert.equal(mahanagarGas.COMPANY, 'Mahanagar Gas')
  assert.equal(mahanagarGas.OFFICIAL_BRAND_NAME, 'Mahanagar Gas Limited')
  assert.equal(mahanagarGas.VERIFIED_ON, '2026-07-19')
  assert.equal(mahanagarGas.HOMEPAGE_URL, 'https://www.mahanagargas.com/')
  assert.equal(mahanagarGas.hasOfficialMahanagarGasSurfaceSignal(OFFICIAL_HOME_HTML), true)
  assert.equal(mahanagarGas.hasPublicJobsSignal(OFFICIAL_HOME_HTML), false)
  assert.equal(
    mahanagarGas.hasPublicJobsSignal('<main><h1>Current Openings</h1><a href="/jobs/1">Apply Now</a></main>'),
    true,
  )
  assert.equal(
    mahanagarGas.isExpectedNoPublicJobsSurface({
      status: 200,
      html: OFFICIAL_HOME_HTML,
    }),
    true,
  )
})

test('Mahanagar Gas run verifies the exact-name first-party shell and common careers routes before returning []', async () => {
  const mahanagarGas = await loadScriptModule()
  const requestedUrls = []

  const jobs = await mahanagarGas.createMahanagarGasScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (
        url === 'https://www.mahanagargas.com/'
        || url === 'https://www.mahanagargas.com/careers'
        || url === 'https://www.mahanagargas.com/career'
        || url === 'https://www.mahanagargas.com/recruitment'
        || url === 'https://www.mahanagargas.com/jobs'
        || url === 'https://www.mahanagargas.com/work-with-us'
      ) {
        return {
          url,
          finalUrl: url,
          status: 200,
          html: OFFICIAL_HOME_HTML,
          errorKind: null,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.mahanagargas.com/',
    'https://www.mahanagargas.com/careers',
    'https://www.mahanagargas.com/career',
    'https://www.mahanagargas.com/recruitment',
    'https://www.mahanagargas.com/jobs',
    'https://www.mahanagargas.com/work-with-us',
  ])
  assert.deepEqual(jobs, [])
})

test('Mahanagar Gas fails closed when the official shell changes or a public jobs signal appears', async () => {
  const mahanagarGas = await loadScriptModule()

  await assert.rejects(
    mahanagarGas.createMahanagarGasScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: 200,
        html: '<html><title>Different Company</title><body>Homepage now responds.</body></html>',
        errorKind: null,
      }),
    }),
    /official first-party root/i,
  )

  await assert.rejects(
    mahanagarGas.createMahanagarGasScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.mahanagargas.com/jobs') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><title>Jobs</title><body><h1>Current Openings</h1><a href="/jobs/engineer">Apply now</a></body></html>',
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: 200,
          html: OFFICIAL_HOME_HTML,
          errorKind: null,
        }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    mahanagarGas.createMahanagarGasScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }),
    }),
    /verified no-public-jobs surface changed materially/i,
  )
})
