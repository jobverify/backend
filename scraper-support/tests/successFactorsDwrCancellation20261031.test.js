import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchSuccessFactorsSearchSession, postSuccessFactorsDwr } from '../shared/successFactorsDwr.js'

const searchUrl = 'https://career.example.test/career?company=example'
const operations = {
  bootstrap: options => fetchSuccessFactorsSearchSession({ searchUrl, ...options }),
  dwr: options => postSuccessFactorsDwr({ searchUrl, endpoint: 'search', companyToken: 'example',
    csrfToken: 'existing-native-token', cookieHeader: 'existing=native', body: 'unchanged native DWR body', ...options }),
}
const failure = () => Object.assign(Error('unforwarded controlled native caller'), { abortRetries: true })

for (const [name, run] of Object.entries(operations)) {
  test(`SuccessFactors ${name} default HTTP rejects pre-aborted immutable caller before request`, async t => {
    const reason = Object.freeze(Error('caller timed out before DWR'))
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls += 1; throw failure() })
    await assert.rejects(run({ signal: AbortSignal.abort(reason) }), error => error === reason)
    assert.equal(calls, 0)
  })

  test(`SuccessFactors ${name} default HTTP restores the exact caller reason after native transport replacement`, async t => {
    const caller = new AbortController(), reason = Object.freeze(Error('caller stopped native DWR'))
    let calls = 0
    t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
      calls += 1
      caller.abort(reason)
      if (!options.signal?.aborted) throw failure()
      throw Error('native DWR transport replaced abort')
    })
    await assert.rejects(run({ signal: caller.signal }), error => error === reason)
    assert.equal(calls, 1)
  })

  for (const stage of ['headers', 'body']) {
    test(`SuccessFactors ${name} checks native ${stage} completion before validation or returning session data`, async t => {
      const caller = new AbortController(), reason = Object.freeze(Error('caller stopped DWR ' + stage))
      let bodies = 0
      t.mock.method(globalThis, 'fetch', async () => {
        if (stage === 'headers') caller.abort(reason)
        return { ok: true, status: 200, headers: new Headers(), text: async () => {
          bodies += 1
          if (stage === 'body') caller.abort(reason)
          return 'Untrusted native response after caller cancellation'
        } }
      })
      await assert.rejects(run({ signal: caller.signal }), error => error === reason)
      assert.equal(bodies, stage === 'headers' ? 0 : 1)
    })
  }

  test(`SuccessFactors ${name} caller cancellation stops the existing native retry backoff`, async t => {
    const caller = new AbortController(), reason = Object.freeze(Error('caller stopped DWR retry delay'))
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => {
      calls += 1
      if (calls === 1) { setTimeout(() => caller.abort(reason), 1); throw Error('temporary upstream failure') }
      throw failure()
    })
    await assert.rejects(run({ signal: caller.signal }), error => error === reason)
    assert.equal(calls, 1)
  })
}
