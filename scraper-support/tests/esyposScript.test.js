import assert from 'node:assert/strict'
import test from 'node:test'

const framesetHtml = `
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <frameset border="0" rows="100%,*" cols="100%" frameborder="no">
    <frame name="TopFrame" scrolling="yes" noresize src="http://www.esy.co.in">
    <frame name="BottomFrame" scrolling="no" noresize>
    <noframes></noframes>
  </frameset>
</html>
`

const hugeDomainsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>EsyPos.com is for sale | HugeDomains</title>
  </head>
  <body>
    <h1>HugeDomains</h1>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/esypos/script.js')
  } catch {
    assert.fail('Expected ESYPOS scraper module at ../../scraper/esypos/script.js')
  }
}

test('ESYPOS accepts the current broken frameset redirect surface and returns no jobs', async () => {
  const esypos = await loadModule()

  assert.equal(esypos.hasBrokenOfficialSurfaceSignal(framesetHtml), true)
  assert.equal(esypos.hasBrokenOfficialSurfaceSignal(hugeDomainsHtml), true)

  const jobs = await esypos.createEsyposScraper().run({
    fetchText: async (url) => {
      if (url === esypos.HOMEPAGE_URL || url === esypos.CAREERS_URL) {
        return framesetHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('ESYPOS accepts the August 20, 2026 loopback-refused official host and returns no jobs', async () => {
  const esypos = await loadModule()

  const jobs = await esypos.createEsyposScraper().run({
    fetchText: async (url) => {
      if (url === esypos.HOMEPAGE_URL || url === esypos.CAREERS_URL) {
        throw new Error('fetch failed | connect ECONNREFUSED 127.0.0.1:80')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('ESYPOS fails closed if the official host starts serving a readable site again', async () => {
  const esypos = await loadModule()

  await assert.rejects(
    esypos.createEsyposScraper().run({
      fetchText: async () => `
        <html>
          <head><title>ESYPOS Careers</title></head>
          <body><a href="/careers">Careers</a></body>
        </html>
      `,
    }),
    /official host no longer matches/i,
  )
})
