import assert from 'node:assert/strict'
import test from 'node:test'

// Minimal derived shell for offline control-flow tests, not a native inventory.
const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Allyis, India - Tech Mahindra Allyis</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <h2>Jobs at Allyis, India</h2>
      <p>TechM Allyis</p>
      <p>Secunderabad 500003, India</p>
      <iframe id="jobs-iframe" src="https://staffing.allyisapps.com/home/listjobs/114025"></iframe>
    </main>
  </body>
</html>
`

const blockedIframeError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
const syntheticConnectTimeoutError = Object.assign(
  new Error('fetch failed | Connect Timeout Error (attempted address: staffing.allyisapps.com:443, timeout: 10000ms)'),
  { code: 'UND_ERR_CONNECT_TIMEOUT' },
)

const loadModule = async () => {
  try {
    return await import('../../scraper/allyisindia/script.js')
  } catch {
    assert.fail('Expected Allyis India scraper module at ../../scraper/allyisindia/script.js')
  }
}

test('Allyis India helpers stay pinned to the first-party page and declared embedded jobs handoff', async () => {
  const allyis = await loadModule()

  assert.equal(allyis.CAREERS_URL, 'https://www.allyis.com/ind/careers')
  assert.equal(allyis.EMBEDDED_JOBS_URL, 'https://staffing.allyisapps.com/home/listjobs/114025')
  assert.equal(allyis.hasOfficialCareersSignal(careersHtml), true)
})

test('Allyis India preserves the original embedded socket-reset error', async () => {
  const allyis = await loadModule()
  const requestedUrls = []

  await assert.rejects(allyis.createAllyisIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === allyis.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === allyis.EMBEDDED_JOBS_URL) {
        throw blockedIframeError
      }

      throw new Error(`Unexpected Allyis URL: ${url}`)
    },
  }), (error) => {
    assert.equal(error, blockedIframeError)
    return true
  })

  assert.deepEqual(requestedUrls, [allyis.CAREERS_URL, allyis.EMBEDDED_JOBS_URL])
})

test('Allyis India preserves the original embedded connect-timeout error', async () => {
  const allyis = await loadModule()

  await assert.rejects(allyis.createAllyisIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === allyis.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === allyis.EMBEDDED_JOBS_URL) {
        throw syntheticConnectTimeoutError
      }

      throw new Error(`Unexpected Allyis URL: ${url}`)
    },
  }), (error) => {
    assert.equal(error, syntheticConnectTimeoutError)
    return true
  })
})

test('Allyis India fails closed when the verified careers shell changes materially', async () => {
  const allyis = await loadModule()

  await assert.rejects(
    allyis.createAllyisIndiaScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified allyis india careers page/i,
  )
})
