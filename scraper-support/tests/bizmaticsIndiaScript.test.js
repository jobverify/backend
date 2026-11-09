import assert from 'node:assert/strict'
import test from 'node:test'

const REDIRECT_SHELL_HTML = `
<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>
`

const SOLD_DOMAIN_HTML = `
<!doctype html>
<html>
  <head><title>bizmatics.com is for sale — Buy for $15,888 or make an offer | GoDaddy</title></head>
  <body>GoDaddy forsale.godaddy.com bizmatics.com is for sale</body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/bizmaticsindia/script.js')
  } catch {
    assert.fail('Expected Bizmatics India scraper module at ../../scraper/bizmaticsindia/script.js')
  }
}

test('Bizmatics India sentinel helpers stay pinned to the redirect shell and sold-domain lander', async () => {
  const bizmatics = await loadScriptModule()

  assert.equal(bizmatics.hasRedirectShellSignal(REDIRECT_SHELL_HTML), true)
  assert.equal(bizmatics.extractRedirectTarget(REDIRECT_SHELL_HTML), '/lander')
  assert.equal(bizmatics.hasForSaleLanderSignal(SOLD_DOMAIN_HTML), true)
})

test('Bizmatics India returns [] only while the verified redirect shell still lands on a sold-domain page', async () => {
  const bizmatics = await loadScriptModule()
  const requestedUrls = []

  const jobs = await bizmatics.createBizmaticsIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === bizmatics.HOMEPAGE_URL || url === bizmatics.CAREERS_URL) {
        return { status: 200, url, html: REDIRECT_SHELL_HTML }
      }
      if (url === bizmatics.SOLD_DOMAIN_URL) {
        return { status: 200, url, html: SOLD_DOMAIN_HTML }
      }
      throw new Error(`Unexpected Bizmatics URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    bizmatics.HOMEPAGE_URL,
    bizmatics.CAREERS_URL,
    bizmatics.SOLD_DOMAIN_URL,
  ])
})

test('Bizmatics India fails closed when the redirect shell drifts materially', async () => {
  const bizmatics = await loadScriptModule()

  await assert.rejects(
    bizmatics.createBizmaticsIndiaScraper().run({
      fetchPage: async () => ({ status: 200, url: 'https://www.bizmatics.com/', html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified homepage shell/i,
  )
})
