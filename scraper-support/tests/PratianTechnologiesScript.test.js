import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pratian</title>
  </head>
  <body>
    <app-root></app-root>
    <section>
      <h4>Career</h4>
      <p>At Pratian, it is all about you.</p>
      <p>We nurture you. We challenge you. We celebrate you. We trust you.</p>
    </section>
    <script src="main.d7ac0e33a2b8f83f.js" type="module"></script>
  </body>
</html>
`

const VERIFIED_BUNDLE_TEXT = `
path: "career";
At Pratian, it is all about you.
We nurture you.
We challenge you.
We celebrate you.
We trust you.
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pratiantechnologies/script.js')
  } catch {
    assert.fail('Expected Pratian Technologies scraper module at ../../scraper/pratiantechnologies/script.js')
  }
}

test('Pratian Technologies helper signals stay pinned to the verified careers shell and bundle messaging', async () => {
  const pratian = await loadModule()

  assert.equal(pratian.hasOfficialCareersShellSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    pratian.extractBundlePath(VERIFIED_CAREERS_HTML),
    'https://www.pratian.com/main.d7ac0e33a2b8f83f.js',
  )
  assert.equal(pratian.bundleHasExpectedCareerMessaging(VERIFIED_BUNDLE_TEXT), true)
  assert.equal(pratian.bundleExposesStructuredJobListings(VERIFIED_BUNDLE_TEXT), false)
  assert.equal(pratian.isCertificateExpiredError({ code: 'CERT_HAS_EXPIRED' }), true)
})

test('Pratian Technologies run validates the verified shell and bundle before returning []', async () => {
  const pratian = await loadModule()
  const requestedUrls = []

  const jobs = await pratian.createPratianTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pratian.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === 'https://www.pratian.com/main.d7ac0e33a2b8f83f.js') return VERIFIED_BUNDLE_TEXT

      throw new Error(`Unexpected Pratian URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pratian.CAREERS_URL,
    'https://www.pratian.com/main.d7ac0e33a2b8f83f.js',
  ])
  assert.deepEqual(jobs, [])
})

test('Pratian Technologies returns [] when the current first-party certificate is expired', async () => {
  const pratian = await loadModule()
  const certificateError = new Error('fetch failed | certificate has expired')
  certificateError.code = 'CERT_HAS_EXPIRED'

  const jobs = await pratian.createPratianTechnologiesScraper().run({
    fetchText: async () => {
      throw certificateError
    },
  })

  assert.deepEqual(jobs, [])
})
