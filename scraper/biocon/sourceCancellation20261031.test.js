import assert from 'node:assert/strict'
import test from 'node:test'

import { run, getLiveSearchPages, fetchBioconFirstPartyText, CAREERS_PAGE_URL,
  SUCCESSFACTORS_SEARCH_URL } from './script.js'

const reasonFor = () => Object.freeze(Error('controlled caller timed out during native Biocon reads'))
const careers = '<title>Careers at Biocon - Put your passion for science into practice</title>'
  + '<p>chance at Biocon to work alongside some of the brightest minds</p>'
  + '<a href="https://career10.successfactors.com/career?company=bioconlimi">Now Hiring</a>'
const bootstrap = `<title>Career Opportunities</title><h1 id="candidateProfileTitle">Career Opportunities</h1>
  <input id="career_ns" value="job_listing_summary"><input id="company" value="bioconlimi">
  <div id="careerJobSearchContainer"></div><script>window.addEventListener('load', getInitialJobSearchData);
  careerJobSearchController.getInitialJobSearchData(); ajaxSecKey="controlled-token";</script>`
const nativeResponse = (url, html) => ({ ok: true, status: 200, url, headers: new Headers(), text: async () => html })

test('Biocon caller cancellation prevents certificate-shaped errors from starting curl fallback', async () => {
  const controller = new AbortController(), reason = reasonFor()
  let curlCalls = 0
  await assert.rejects(fetchBioconFirstPartyText(CAREERS_PAGE_URL, { signal: controller.signal,
    fetchText: async () => { controller.abort(reason); throw Object.assign(Error('unable to verify leaf signature'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }) },
    execFile: async () => { curlCalls++; return { stdout: 'untrusted after abort' } },
  }), error => error === reason)
  assert.equal(curlCalls, 0)
})

test('Biocon already active normal-trust curl preserves exact caller reason after replacement', async () => {
  const controller = new AbortController(), reason = reasonFor()
  await assert.rejects(fetchBioconFirstPartyText(CAREERS_PAGE_URL, { signal: controller.signal,
    fetchText: async () => { throw Object.assign(Error('unable to verify leaf signature'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }) },
    execFile: async (_command, _args, options) => {
      assert.equal(options.signal, controller.signal)
      controller.abort(reason)
      throw Error('curl replaced native abort')
    },
  }), error => error === reason)
})

for (const stop of ['bootstrap', 'initial-dwr']) {
  test(`Biocon live search plumbing cancels the actual default ${stop} HTTP boundary`, async t => {
    const controller = new AbortController(), reason = reasonFor()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests++
      if (stop === 'initial-dwr' && requests === 1) return nativeResponse(url, bootstrap)
      controller.abort(reason)
      assert.equal(options.signal?.aborted, true)
      throw Object.assign(Error('native transport replaced caller abort'), { abortRetries: true })
    })
    await assert.rejects(getLiveSearchPages({ signal: controller.signal,
      fetchText: async (url, options) => {
        assert.equal(url, SUCCESSFACTORS_SEARCH_URL)
        assert.equal(options?.signal, controller.signal)
        return bootstrap
      },
    }), error => error === reason)
    assert.equal(requests, stop === 'bootstrap' ? 1 : 2)
  })
}

test('Biocon getSearchPages cannot turn caller cancellation into a successful empty result', async () => {
  const controller = new AbortController(), reason = reasonFor()
  await assert.rejects(run({ signal: controller.signal, fetchText: async (_url, options) => {
    assert.equal(options?.signal, controller.signal)
    return careers
  }, getSearchPages: async options => {
    assert.equal(options.signal, controller.signal)
    controller.abort(reason)
    return []
  } }), error => error === reason)
})
