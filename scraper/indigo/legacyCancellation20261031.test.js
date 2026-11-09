import assert from 'node:assert/strict'
import test from 'node:test'

import { createIndigoScraper, CAREERS_PAGE_URL, JOB_SEARCH_URL, JOB_SEARCH_API_URL,
  SUCCESSFACTORS_APPLY_URL_PREFIX, CAREER_MS_USER_KEY } from './script.js'

const careersHtml = '<p>Log in for getting posted on new career opportunities with IndiGo!</p>'
  + '<p>Find your next job at IndiGo View all jobs Airport Operations &amp; Customer Services Engineering CarGo</p>'
const searchHtml = `<p>Careers All Jobs Please enter valid email address.</p><div data-component="mf-job-search"></div>
  <script>CAREER_JOB_SEARCH_RESULT_LIST: '${JOB_SEARCH_API_URL}', CAREER_APPLY_NOW_URL: '${SUCCESSFACTORS_APPLY_URL_PREFIX}', CAREER_MS: '${CAREER_MS_USER_KEY}'</script>`
const reasonFor = () => Object.freeze(Error('controlled legacy caller timed out'))
const response = (url, html) => ({ status: 200, url, text: async () => html })

test('Indigo legacy default page rejects preabort before native HTTP', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw Object.assign(Error('unexpected native request'), { abortRetries: true }) })
  const reason = reasonFor()
  await assert.rejects(createIndigoScraper().run({ signal: AbortSignal.abort(reason) }), error => error === reason)
  assert.equal(requests, 0)
})

test('Indigo legacy native page restores exact frozen caller reason after replacement', async t => {
  const controller = new AbortController(), reason = reasonFor()
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests++; controller.abort(reason)
    assert.equal(options.signal.aborted, true)
    throw Object.assign(Error('native abort replaced'), { abortRetries: true })
  })
  await assert.rejects(createIndigoScraper().run({ signal: controller.signal }), error => error === reason)
  assert.equal(requests, 1)
})

test('Indigo legacy native page checks caller cancellation before reading its body', async t => {
  const controller = new AbortController(), reason = reasonFor()
  let bodies = 0
  t.mock.method(globalThis, 'fetch', async url => {
    controller.abort(reason)
    return { ...response(url, ''), text: async () => { bodies++; return '' } }
  })
  await assert.rejects(createIndigoScraper().run({ signal: controller.signal }), error => error === reason)
  assert.equal(bodies, 0)
})

test('Indigo legacy injected page cannot return invalid content after caller cancellation', async () => {
  const controller = new AbortController(), reason = reasonFor()
  await assert.rejects(createIndigoScraper().run({ signal: controller.signal, fetchPage: async () => {
    controller.abort(reason)
    return { status: 200, url: CAREERS_PAGE_URL, html: 'invalid content after abort' }
  } }), error => error === reason)
})

test('Indigo legacy validated pages preserve their HTML signal functions and forward caller to default JSON', async t => {
  const controller = new AbortController(), reason = reasonFor()
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++
    if (url === CAREERS_PAGE_URL) return response(url, careersHtml)
    if (url === JOB_SEARCH_URL) return response(url, searchHtml)
    assert.equal(url, JOB_SEARCH_API_URL)
    controller.abort(reason)
    assert.equal(options.signal.aborted, true)
    throw Object.assign(Error('JSON transport replaced abort'), { abortRetries: true })
  })
  await assert.rejects(createIndigoScraper().run({ signal: controller.signal }), error => error === reason)
  assert.equal(requests, 3)
})
