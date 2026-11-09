import assert from 'node:assert/strict'
import test from 'node:test'

const loadCentumElectronicsModule = async () => {
  try {
    return await import('../../scraper/centumelectronics/script.js')
  } catch {
    assert.fail('Expected Centum Electronics scraper module at ../../scraper/centumelectronics/script.js')
  }
}

const currentHomepageHtml = `
  <html>
    <head><title>Centum &#8211; TEAM WORK | TECHNOLOGY | TRUST</title></head>
    <body>
      <a href="http://careers.centumelectronics.com/">Careers – India</a>
      <h2>Global Presence, Innovative Engineering, Advanced Manufacturing</h2>
      <h2>CENTUM GROUP, A GLOBAL COMPANY CLOSE TO ITS CUSTOMERS</h2>
      <footer>© Centum. All rights reserved.</footer>
    </body>
  </html>
`

test('Centum Electronics homepage identity does not depend on the retired Europe careers link', async () => {
  const centum = await loadCentumElectronicsModule()

  assert.equal(centum.hasCentumHomepageSignal(currentHomepageHtml), true)
  assert.equal(
    centum.hasCentumHomepageSignal(currentHomepageHtml.replace(centum.INDIA_CAREERS_HANDOFF_URL, '/careers')),
    false,
  )
})

test('Centum Electronics default resolver dependency does not throw before the first fetch', async () => {
  const centum = await loadCentumElectronicsModule()

  await assert.rejects(
    centum.createCentumElectronicsScraper().run({
      fetchPage: async () => {
        throw new Error('fetch reached')
      },
    }),
    /fetch reached/,
  )
})

test('Centum Electronics only retries certificate failures for the verified first-party host', async () => {
  const centum = await loadCentumElectronicsModule()

  assert.equal(
    centum.isRecoverableCentumCertificateError(
      centum.BRAND_HOME_URL,
      { cause: { code: 'CERT_HAS_EXPIRED' } },
    ),
    true,
  )
  assert.equal(
    centum.isRecoverableCentumCertificateError(
      'https://example.com/',
      { cause: { code: 'CERT_HAS_EXPIRED' } },
    ),
    false,
  )
  assert.equal(
    centum.isRecoverableCentumCertificateError(
      centum.BRAND_HOME_URL,
      { cause: { code: 'ECONNRESET' } },
    ),
    false,
  )
})

test('Centum Electronics bounds stalled DNS lookups for the verified India careers host', async () => {
  const centum = await loadCentumElectronicsModule()
  const calls = []
  const never = (family) => async (host) => {
    calls.push(`${family}:${host}`)
    return new Promise(() => {})
  }
  const startedAt = Date.now()

  const addresses = await centum.resolveCareerHost(
    centum.INDIA_CAREERS_HOST,
    {
      resolve4Impl: never('v4'),
      resolve6Impl: never('v6'),
      timeoutMs: 10,
    },
  )

  assert.deepEqual(addresses, [])
  assert.deepEqual(calls.sort(), [
    `v4:${centum.INDIA_CAREERS_HOST}`,
    `v6:${centum.INDIA_CAREERS_HOST}`,
  ])
  assert.ok(Date.now() - startedAt < 150)
})
