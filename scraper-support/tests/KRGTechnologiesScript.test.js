import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html><head><title>KRG Technologies</title></head>
<body>
  <a href="Jobs.aspx">Current Openings</a>
</body></html>
`

const openingsHtml = `
<!doctype html>
<html><body>
  <h2>Find Your Career. You Deserve it.</h2>
  <a href="Jobs.aspx">Current Openings</a>
  <iframe src="https://talenthire.ceipal.com/Jobs/listing/ODI0MA=="></iframe>
</body></html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/krgtechnologies/script.js')
  } catch {
    assert.fail('Expected KRG Technologies scraper module at ../../scraper/krgtechnologies/script.js')
  }
}

test('KRG Technologies validators stay pinned to the verified current-openings handoff from Friday, July 17, 2026', async () => {
  const krg = await loadModule()
  assert.equal(krg.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(krg.hasCurrentOpeningsSignal(openingsHtml), true)
  assert.equal(
    krg.isRecoverableCertificateError({
      message: 'fetch failed',
      cause: {
        code: 'CERT_HAS_EXPIRED',
        message: 'certificate has expired',
      },
    }),
    true,
  )
})

test('KRG Technologies treats the live TLS altname mismatch as recoverable for the verified first-party pages', async () => {
  const krg = await loadModule()

  assert.equal(
    krg.isRecoverableCertificateError({
      message: 'fetch failed',
      cause: {
        code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        message: "Hostname/IP does not match certificate's altnames: Host: www.krgtech.com. is not in the cert's altnames: DNS:krgtech.com",
      },
    }),
    true,
  )
})

test('KRG Technologies run validates the verified page and iframe handoff and stays fail-closed', async () => {
  const krg = await loadModule()
  const jobs = await krg.createKrgTechnologiesScraper().run({
    fetchText: async (url) => (url === krg.CAREERS_URL ? careersHtml : openingsHtml),
  })

  assert.deepEqual(jobs, [])
})

test('KRG Technologies falls back to an expired-certificate fetch only for the verified first-party pages', async () => {
  const krg = await loadModule()
  const primaryRequests = []
  const insecureRequests = []

  const jobs = await krg.createKrgTechnologiesScraper().run({
    fetchText: async (url) => {
      primaryRequests.push(url)
      throw Object.assign(new TypeError('fetch failed'), {
        cause: {
          code: 'CERT_HAS_EXPIRED',
          message: 'certificate has expired',
        },
      })
    },
    fetchTextAllowingExpiredCertificate: async (url) => {
      insecureRequests.push(url)
      return url === krg.CAREERS_URL ? careersHtml : openingsHtml
    },
  })

  assert.deepEqual(primaryRequests, [krg.CAREERS_URL, krg.CURRENT_OPENINGS_URL])
  assert.deepEqual(insecureRequests, primaryRequests)
  assert.deepEqual(jobs, [])
})
