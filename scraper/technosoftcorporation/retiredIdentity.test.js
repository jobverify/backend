import assert from 'node:assert/strict'
import test from 'node:test'
import { run, HOMEPAGE_URL, NO_PUBLIC_CAREERS_ROUTE_URLS, isVerifiedMissingCareerRoute } from './script.js'
const home = '<title>Technosoft is now Apexon</title><p><i>Technosoft</i> is now Apexon</p><a href="https://www.apexon.com">click here</a>'
const missing = { status: 404, html: '' }

test('Technosoft only confirms the retired identity after its rebrand page and all four empty 404 routes', async () => {
  const urls = []
  const jobs = await run({ fetchPage: async url => { urls.push(url); return url === HOMEPAGE_URL ? { status: 200, html: home } : missing } })
  assert.deepEqual(jobs, [])
  assert.deepEqual(urls, [HOMEPAGE_URL, ...NO_PUBLIC_CAREERS_ROUTE_URLS])
  assert.equal(isVerifiedMissingCareerRoute(missing), true)
  assert.equal(isVerifiedMissingCareerRoute({ status: 403, html: '403 Forbidden' }), false)
})

for (const blockedHomepage of [true, false]) {
  test('Technosoft rejects HTTP403 at the ' + (blockedHomepage ? 'homepage' : 'careers route'), async () => {
    await assert.rejects(run({ fetchPage: async url => {
      if (blockedHomepage || url !== HOMEPAGE_URL) return { status: 403, html: '403 Forbidden nginx' }
      return { status: 200, html: home }
    } }), error => error.status === 403 && error.code === 'TECHNOSOFT_UPSTREAM_HTTP_ERROR')
  })
}

test('Technosoft propagates transport failures and source cancellation without checking Apexon inventory', async () => {
  const reason = Object.assign(new Error('DNS failure'), { code: 'ENOTFOUND' })
  await assert.rejects(run({ fetchPage: async () => { throw reason } }), error => error === reason)
  let requests = 0
  const stopped = new Error('Source stopped')
  await assert.rejects(run({ signal: AbortSignal.abort(stopped), fetchPage: async () => { requests++; return missing } }), error => error === stopped)
  assert.equal(requests, 0)
  const controller = new AbortController()
  await assert.rejects(run({ signal: controller.signal, fetchPage: async (url, options) => {
    assert.equal(url, HOMEPAGE_URL)
    assert.equal(options.signal, controller.signal)
    controller.abort(stopped)
    return { status: 200, html: home }
  } }), error => error === stopped)
})

test('Technosoft refuses a changed homepage with opening signals or a nonempty/positive legacy careers route', async () => {
  await assert.rejects(run({ fetchPage: async url => url === HOMEPAGE_URL
    ? { status: 200, html: home + '<p>Current openings</p>' } : missing }), /surface changed/i)
  for (const route of [{ status: 200, html: 'Job openings' }, { status: 404, html: '<title>Other company</title>' }]) {
    await assert.rejects(run({ fetchPage: async url => url === HOMEPAGE_URL ? { status: 200, html: home } : route }), /surface changed/i)
  }
})

test('Technosoft default request boundary uses ordinary client headers with cancellation and all five checks', async () => {
  const originalFetch = globalThis.fetch
  const urls = []
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers, undefined)
    assert.equal(options.redirect, 'follow')
    assert.ok(options.signal)
    assert.equal(options.signal.aborted, false)
    urls.push(url)
    return new Response(url === HOMEPAGE_URL ? home : '', { status: url === HOMEPAGE_URL ? 200 : 404 })
  }
  try {
    assert.deepEqual(await run({ signal: controller.signal }), [])
    assert.deepEqual(urls, [HOMEPAGE_URL, ...NO_PUBLIC_CAREERS_ROUTE_URLS])
  } finally { globalThis.fetch = originalFetch }
})
