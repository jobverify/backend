import assert from 'node:assert/strict'
import test from 'node:test'

const verified404Html = `
  <html>
    <head><title>404 Not Found</title></head>
    <body>
      <h1>404 Not Found</h1>
      <p>The requested URL was not found on this server.</p>
    </body>
  </html>
`

const loadBira91Module = async () => {
  try {
    return await import('../../scraper/bira91/script.js')
  } catch {
    assert.fail('Expected Bira 91 scraper module at ../../scraper/bira91/script.js')
  }
}

test('Bira 91 sentinels recognize the verified first-party 404 shell', async () => {
  const bira91 = await loadBira91Module()

  assert.equal(bira91.SOURCE, 'bira91')
  assert.equal(bira91.COMPANY, 'Bira 91')
  assert.equal(bira91.HOMEPAGE_URL, 'https://bira91.com/')
  assert.deepEqual(bira91.CAREERS_ROUTE_URLS, [
    'https://bira91.com/careers',
    'https://bira91.com/careers/',
    'https://bira91.com/jobs',
    'https://bira91.com/jobs/',
    'https://bira91.com/join-us',
    'https://bira91.com/join-us/',
  ])
  assert.equal(bira91.hasVerifiedFirstParty404Signal(verified404Html), true)
  assert.equal(bira91.hasPublicJobsSignal(verified404Html), false)
  assert.equal(
    bira91.isVerified404Page({ status: 404, html: verified404Html }),
    true,
  )
  assert.equal(
    bira91.isBlockedNetworkError(new Error('fetch failed | Connect Timeout Error', {
      cause: { message: 'Connect Timeout Error', code: 'UND_ERR_CONNECT_TIMEOUT' },
    })),
    true,
  )
})

test('Bira 91 returns no jobs only while the verified first-party 404 shell holds', async () => {
  const bira91 = await loadBira91Module()
  const requestedUrls = []

  const jobs = await bira91.createBira91Scraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      return {
        status: 404,
        url,
        html: verified404Html,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    bira91.HOMEPAGE_URL,
    ...bira91.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Bira 91 fails closed when the verified 404 shell changes or starts exposing jobs', async () => {
  const bira91 = await loadBira91Module()

  await assert.rejects(
    bira91.createBira91Scraper().run({
      fetchPage: async (url) => ({
        status: url === bira91.HOMEPAGE_URL ? 200 : 404,
        url,
        html: verified404Html,
      }),
    }),
    /verified official homepage surface/i,
  )

  await assert.rejects(
    bira91.createBira91Scraper().run({
      fetchPage: async (url) => ({
        status: 404,
        url,
        html: url === bira91.HOMEPAGE_URL
          ? verified404Html
          : verified404Html.replace(
            '</body>',
            '<a href="https://jobs.lever.co/bira91">Open positions</a></body>',
          ),
      }),
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})

test('Bira 91 returns [] when the current official surface is unreachable via repeated connect timeouts', async () => {
  const bira91 = await loadBira91Module()

  const jobs = await bira91.createBira91Scraper().run({
    fetchPage: async () => {
      throw new Error('fetch failed', {
        cause: {
          message: 'Connect Timeout Error (attempted address: bira91.com:443, timeout: 10000ms)',
          code: 'UND_ERR_CONNECT_TIMEOUT',
        },
      })
    },
  })

  assert.deepEqual(jobs, [])
})
