import assert from 'node:assert/strict'
import test from 'node:test'

const restrictedHtml = 'Access is restricted'
const tlsMismatchPage = {
  status: 0,
  html: '',
  errorCode: 'ERR_TLS_CERT_ALTNAME_INVALID',
  errorReason: "Host: otipy.com. is not in the cert's altnames: DNS:gps.vendors.intusystems.info",
}

const jobsHtml = `
<html>
  <body>
    <h1>Senior Product Manager</h1>
    <a href="https://boards.greenhouse.io/otipy/jobs/1234">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/otipy/script.js')
  } catch {
    assert.fail('Expected Otipy scraper module at ../../scraper/otipy/script.js')
  }
}

test('Otipy sentinel pins the verified blocked first-party public surface from Monday, August 3, 2026', async () => {
  const otipy = await loadModule()

  assert.equal(otipy.SOURCE, 'otipy')
  assert.equal(otipy.COMPANY, 'Otipy')
  assert.equal(otipy.OFFICIAL_BRAND_NAME, 'Otipy')
  assert.equal(otipy.VERIFIED_ON, '2026-08-03')
  assert.equal(otipy.HOMEPAGE_URL, 'https://otipy.com/')
  assert.equal(otipy.CAREERS_URL, 'https://otipy.com/careers')
  assert.equal(otipy.JOBS_URL, 'https://otipy.com/jobs')
  assert.match(otipy.VERIFIED_SURFACE_SUMMARY, /Monday, August 3, 2026/i)
  assert.match(otipy.VERIFIED_SURFACE_SUMMARY, /ERR_TLS_CERT_ALTNAME_INVALID/i)
  assert.match(otipy.VERIFIED_SURFACE_SUMMARY, /gps\.vendors\.intusystems\.info/i)

  assert.equal(
    otipy.isRestrictedSurface({
      status: 403,
      html: restrictedHtml,
    }),
    true,
  )
  assert.equal(otipy.isRestrictedSurface(tlsMismatchPage), true)
  assert.equal(otipy.hasPublicJobsSignal(restrictedHtml), false)
  assert.equal(otipy.hasPublicJobsSignal(jobsHtml), true)
})

test('Otipy returns [] only while the official homepage and public job routes stay blocked in the verified way', async () => {
  const otipy = await loadModule()
  const requestedUrls = []

  const jobs = await otipy.createOtipyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if ([otipy.HOMEPAGE_URL, otipy.CAREERS_URL, otipy.JOBS_URL].includes(url)) {
        return { ...tlsMismatchPage, url }
      }

      throw new Error(`Unexpected Otipy URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    otipy.HOMEPAGE_URL,
    otipy.CAREERS_URL,
    otipy.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Otipy fails closed when the blocked first-party contract changes materially or starts exposing public jobs', async () => {
  const otipy = await loadModule()

  await assert.rejects(
    otipy.createOtipyScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Otipy</h1></body></html>',
      }),
    }),
    /blocked first-party surface/i,
  )

  await assert.rejects(
    otipy.createOtipyScraper().run({
      fetchPage: async (url) => {
        if (url === otipy.HOMEPAGE_URL) {
          return { ...tlsMismatchPage, url }
        }

        return {
          status: 200,
          url,
          html: jobsHtml,
        }
      },
    }),
    /public jobs/i,
  )
})
