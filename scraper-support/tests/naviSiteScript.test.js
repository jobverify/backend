import assert from 'node:assert/strict'
import test from 'node:test'

const blockedCareersHtml = `
<!doctype html>
<html>
  <body>
    <h1>Just a moment...</h1>
    <p>Enable JavaScript and cookies to continue</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/navisite/script.js')
  } catch {
    assert.fail('Expected NaviSite scraper module at ../../scraper/navisite/script.js')
  }
}

test('NaviSite accepts the blocked Cloudflare shell as a trusted state', async () => {
  const navisite = await loadModule()

  assert.equal(navisite.hasBlockedCareersSignal(blockedCareersHtml), true)
  assert.deepEqual(
    await navisite.createNaviSiteScraper().run({
      fetchText: async () => blockedCareersHtml,
    }),
    [],
  )
})

test('NaviSite can recover with a browser-backed careers page when direct requests are blocked', async () => {
  const navisite = await loadModule()
  const browserUrls = []

  const jobs = await navisite.createNaviSiteScraper().run({
    fetchText: async () => {
      throw new Error(`HTTP 403 for ${navisite.CAREERS_URL}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return blockedCareersHtml
    },
  })

  assert.deepEqual(browserUrls, [navisite.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('NaviSite accepts the live 403 Cloudflare challenge shell as a trusted empty state', async () => {
  const navisite = await loadModule()

  const requestedUrls = []
  const jobs = await navisite.createNaviSiteScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        html: blockedCareersHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [navisite.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
