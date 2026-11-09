import assert from 'node:assert/strict'
import test from 'node:test'

const blockedPage = {
  status: 403,
  html: '<html><body><h1>403 Forbidden</h1><p>Forbidden</p></body></html>',
}

const loadModule = async () => {
  try {
    return await import('../../scraper/scopeeknowledgecenter/script.js')
  } catch {
    assert.fail('Expected Scope eKnowledge Center scraper module at ../../scraper/scopeeknowledgecenter/script.js')
  }
}

test('Scope eKnowledge Center accepts the verified all-routes-blocked sentinel state', async () => {
  const scopee = await loadModule()

  assert.equal(scopee.SOURCE, 'scopeeknowledgecenter')
  assert.equal(scopee.COMPANY, 'Scope eKnowledge Center')
  assert.equal(scopee.HOMEPAGE_URL, 'https://www.scopeknowledge.com/')
  assert.deepEqual(scopee.CAREERS_ROUTES, [
    'https://www.scopeknowledge.com/',
    'https://www.scopeknowledge.com/careers',
    'https://www.scopeknowledge.com/jobs',
    'https://www.scopeknowledge.com/join-us',
  ])
  assert.equal(scopee.isBlockedResponse(blockedPage), true)

  const jobs = await scopee.createScopeEknowledgeCenterScraper().run({
    fetchPage: async (url) => ({
      ...blockedPage,
      url,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Scope eKnowledge Center can recover with browser-backed blocked pages when direct requests fail', async () => {
  const scopee = await loadModule()
  const browserUrls = []

  const jobs = await scopee.createScopeEknowledgeCenterScraper().run({
    fetchPage: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      return {
        ...blockedPage,
        url,
      }
    },
  })

  assert.deepEqual(browserUrls, scopee.CAREERS_ROUTES)
  assert.deepEqual(jobs, [])
})

test('Scope eKnowledge Center accepts certificate-blocked exact-name routes as fail-closed', async () => {
  const scopee = await loadModule()

  assert.equal(
    scopee.isBlockedResponse({ status: 0, html: 'fetch failed | certificate has expired' }),
    true,
  )

  const jobs = await scopee.createScopeEknowledgeCenterScraper().run({
    fetchPage: async () => {
      throw new TypeError('fetch failed | certificate has expired')
    },
  })

  assert.deepEqual(jobs, [])
})

test('Scope eKnowledge Center accepts browser certificate failures when every exact-name route is invalid', async () => {
  const scopee = await loadModule()
  const browserUrls = []

  const jobs = await scopee.createScopeEknowledgeCenterScraper().run({
    fetchPage: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      throw new Error(`net::ERR_CERT_COMMON_NAME_INVALID at ${url}`)
    },
  })

  assert.deepEqual(browserUrls, scopee.CAREERS_ROUTES)
  assert.deepEqual(jobs, [])
})
