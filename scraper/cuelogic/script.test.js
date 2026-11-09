import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const assertOnlyInitialSearch = calls => {
  assert.equal(calls.length, 1, 'failure must stop before another request')
  const [{ url, options }] = calls
  assert.equal(url, 'https://ltimindtree.ripplehire.com/candidate/candidatejobsearch')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded; charset=UTF-8')
  const form = new URLSearchParams(options.body)
  assert.deepEqual([...form.keys()], ['careerSiteUrlParams', 'lang'])
  assert.equal(form.get('lang'), 'en')
  assert.deepEqual(JSON.parse(form.get('careerSiteUrlParams')), {
    page: 0, search: '*:*', token: 'xviyQvbnyYZdGtozXoNm', source: 'CAREERSITE', pagesize: 10, geo: 'India',
  })
}

// Controlled transport errors; these tests make no native TLS availability claim.
test('Cuelogic controlled fetchText transport propagates the exact TLS error after one initial search', async () => {
  const cuelogic = await loadModule()
  assert.ok(cuelogic, 'Cuelogic scraper module should load')

  const error = new Error(
    'fetch failed | Hostname/IP does not match certificate\'s altnames: Host: careers.ltimindtree.com. is not in the cert\'s altnames: DNS:certificate-not-found.jobs2web.com',
  )

  const calls = []
  const notReturned = Symbol('not returned')
  let returnedJobs = notReturned
  await assert.rejects(async () => {
    returnedJobs = await cuelogic.createCuelogicScraper().run({
      fetchText: async (url, options) => {
        calls.push({ url, options })
        throw error
      },
    })
  }, actual => {
    assert.strictEqual(actual, error)
    return true
  })
  assert.strictEqual(returnedJobs, notReturned, 'a transport failure must not produce empty inventory')
  assertOnlyInitialSearch(calls)
})

test('Cuelogic controlled default transport propagates the exact TLS error without retry or fallback', async () => {
  const cuelogic = await loadModule()
  assert.ok(cuelogic, 'Cuelogic scraper module should load')

  const error = new Error(
    'fetch failed | Hostname/IP does not match certificate\'s altnames: Host: careers.ltimindtree.com. is not in the cert\'s altnames: DNS:certificate-not-found.jobs2web.com',
  )

  const calls = []
  const priorFetch = globalThis.fetch
  const notReturned = Symbol('not returned')
  let returnedJobs = notReturned
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    throw error
  }
  try {
    await assert.rejects(async () => {
      returnedJobs = await cuelogic.createCuelogicScraper().run()
    }, actual => {
      assert.strictEqual(actual, error)
      return true
    })
    assert.strictEqual(returnedJobs, notReturned, 'a transport failure must not produce empty inventory')
    assertOnlyInitialSearch(calls)
  } finally {
    globalThis.fetch = priorFetch
  }
})
