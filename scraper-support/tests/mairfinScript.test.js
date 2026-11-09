import assert from 'node:assert/strict'
import test from 'node:test'

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mairfin/script.js')
  } catch {
    assert.fail('Expected Mairfin scraper module at ../../scraper/mairfin/script.js')
  }
}

test('Mairfin sentinel helpers stay pinned to the verified absent or untrusted exact-name domain candidates', async () => {
  const mairfin = await loadScriptModule()

  assert.equal(mairfin.SOURCE, 'mairfin')
  assert.equal(mairfin.COMPANY, 'Mairfin')
  assert.equal(mairfin.OFFICIAL_BRAND_NAME, 'Mairfin')
  assert.equal(mairfin.VERIFIED_ON, '2026-07-17')
  assert.deepEqual(mairfin.CANDIDATE_FIRST_PARTY_URLS, [
    'https://mairfin.com/',
    'https://www.mairfin.com/',
    'https://mairfin.in/',
    'https://www.mairfin.in/',
  ])
  assert.equal(mairfin.isExpectedAbsentCandidateSurface({ errorKind: 'dns', status: null, html: null }), true)
  assert.equal(mairfin.isExpectedAbsentCandidateSurface({ errorKind: 'tls', status: null, html: null }), true)
  assert.equal(mairfin.isExpectedAbsentCandidateSurface({ errorKind: 'timeout', status: null, html: null }), false)
  assert.equal(mairfin.isUnexpectedReachableSurface({ status: 200, html: '<html><body>Mairfin</body></html>' }), true)
  assert.equal(mairfin.isExpectedVerificationFailure({ message: 'curl: (6) Could not resolve host: mairfin.com' }), true)
  assert.equal(
    mairfin.isExpectedVerificationFailure({
      message: 'The underlying connection was closed: Could not establish trust relationship for the SSL/TLS secure channel.',
    }),
    true,
  )
})

test('Mairfin returns [] only while all exact-name first-party candidates remain absent or untrusted', async () => {
  const mairfin = await loadScriptModule()
  const requestedUrls = []

  const jobs = await mairfin.createMairfinScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (url.endsWith('.in/')) {
        return { url, finalUrl: url, status: null, html: null, errorKind: 'tls' }
      }

      return { url, finalUrl: url, status: null, html: null, errorKind: 'dns' }
    },
  })

  assert.deepEqual(requestedUrls, mairfin.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])

  await assert.rejects(
    mairfin.createMairfinScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://mairfin.com/') {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: '<html><body><h1>Mairfin</h1></body></html>',
            errorKind: null,
          }
        }

        return { url, finalUrl: url, status: null, html: null, errorKind: 'dns' }
      },
    }),
    /first-party candidate surface/i,
  )

  await assert.rejects(
    mairfin.createMairfinScraper().run({
      probeUrl: async (url) => ({ url, finalUrl: url, status: null, html: null, errorKind: 'network' }),
    }),
    /changed materially/i,
  )
})
