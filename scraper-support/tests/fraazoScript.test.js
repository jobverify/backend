import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedAbortTimeoutResult = (url) => ({
  ok: false,
  url,
  errorName: 'AbortError',
  errorMessage: 'This operation was aborted',
  causeName: null,
  causeMessage: null,
})

const connectTimeoutResult = (url) => ({
  ok: false,
  url,
  errorName: 'TypeError',
  errorMessage: 'fetch failed',
  causeName: 'ConnectTimeoutError',
  causeMessage: 'Connect Timeout Error',
})

const reachableHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fraazo</title>
  </head>
  <body>
    <main>
      <h1>Fraazo</h1>
      <a href="/careers">Careers</a>
    </main>
  </body>
</html>
`

const loadFraazoModule = async () => {
  try {
    return await import('../../scraper/fraazo/script.js')
  } catch {
    assert.fail('Expected Fraazo scraper module at ../../scraper/fraazo/script.js')
  }
}

test('Fraazo helpers stay pinned to the verified timeout-only first-party contract', async () => {
  const fraazo = await loadFraazoModule()

  assert.equal(fraazo.SOURCE, 'fraazo')
  assert.equal(fraazo.COMPANY, 'Fraazo')
  assert.equal(fraazo.OFFICIAL_BRAND_NAME, 'Fraazo')
  assert.equal(fraazo.VERIFIED_ON, '2026-07-15')
  assert.equal(fraazo.HOMEPAGE_URL, 'https://fraazo.com/')
  assert.equal(fraazo.WWW_HOMEPAGE_URL, 'https://www.fraazo.com/')
  assert.equal(fraazo.CAREERS_URL, 'https://fraazo.com/careers')
  assert.equal(fraazo.WWW_CAREERS_URL, 'https://www.fraazo.com/careers')
  assert.equal(fraazo.JOBS_URL, 'https://fraazo.com/jobs')
  assert.equal(fraazo.WWW_JOBS_URL, 'https://www.fraazo.com/jobs')
  assert.equal(fraazo.ROBOTS_URL, 'https://fraazo.com/robots.txt')
  assert.equal(fraazo.WWW_ROBOTS_URL, 'https://www.fraazo.com/robots.txt')
  assert.equal(fraazo.SITEMAP_URL, 'https://fraazo.com/sitemap.xml')
  assert.equal(fraazo.WWW_SITEMAP_URL, 'https://www.fraazo.com/sitemap.xml')
  assert.deepEqual(fraazo.TIMEOUT_PROBE_URLS, [
    'https://fraazo.com/',
    'https://www.fraazo.com/',
    'https://fraazo.com/careers',
    'https://www.fraazo.com/careers',
    'https://fraazo.com/career',
    'https://www.fraazo.com/career',
    'https://fraazo.com/jobs',
    'https://www.fraazo.com/jobs',
    'https://fraazo.com/join-us',
    'https://www.fraazo.com/join-us',
    'https://fraazo.com/openings',
    'https://www.fraazo.com/openings',
    'https://fraazo.com/work-with-us',
    'https://www.fraazo.com/work-with-us',
    'https://fraazo.com/robots.txt',
    'https://www.fraazo.com/robots.txt',
    'https://fraazo.com/sitemap.xml',
    'https://www.fraazo.com/sitemap.xml',
  ])
  assert.match(fraazo.VERIFIED_SURFACE_SUMMARY, /timed out/i)
  assert.match(fraazo.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(
    fraazo.isVerifiedTimeoutResult(verifiedAbortTimeoutResult(fraazo.HOMEPAGE_URL), fraazo.HOMEPAGE_URL),
    true,
  )
  assert.equal(
    fraazo.isVerifiedTimeoutResult(connectTimeoutResult(fraazo.HOMEPAGE_URL), fraazo.HOMEPAGE_URL),
    true,
  )
  assert.equal(
    fraazo.isVerifiedTimeoutResult(
      {
        ok: true,
        status: 200,
        url: fraazo.HOMEPAGE_URL,
        html: reachableHtml,
      },
      fraazo.HOMEPAGE_URL,
    ),
    false,
  )
})

test('Fraazo returns no jobs only while the verified first-party routes remain unreachable by timeout', async () => {
  const fraazo = await loadFraazoModule()
  const requestedUrls = []

  const jobs = await fraazo.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return verifiedAbortTimeoutResult(url)
    },
  })

  assert.deepEqual(requestedUrls, fraazo.TIMEOUT_PROBE_URLS)
  assert.deepEqual(jobs, [])
})

test('Fraazo fails closed when the verified homepage, careers routes, or discovery routes become reachable or otherwise drift', async () => {
  const fraazo = await loadFraazoModule()

  await assert.rejects(
    fraazo.run({
      fetchPage: async (url) => {
        if (url === fraazo.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            html: reachableHtml,
          }
        }

        return verifiedAbortTimeoutResult(url)
      },
    }),
    /homepage route changed materially or became reachable/i,
  )

  await assert.rejects(
    fraazo.run({
      fetchPage: async (url) => {
        if (url === fraazo.CAREERS_URL) {
          return {
            ok: true,
            status: 200,
            url,
            html: reachableHtml,
          }
        }

        return verifiedAbortTimeoutResult(url)
      },
    }),
    /careers route changed materially or became reachable/i,
  )

  await assert.rejects(
    fraazo.run({
      fetchPage: async (url) => {
        if (url === fraazo.ROBOTS_URL) {
          return {
            ok: false,
            url,
            errorName: 'TypeError',
            errorMessage: 'fetch failed',
            causeName: 'SocketError',
            causeMessage: 'ECONNRESET',
          }
        }

        return verifiedAbortTimeoutResult(url)
      },
    }),
    /discovery route changed materially or became reachable/i,
  )
})
