import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'

const titles = ['Product Manager', 'Senior Laravel Developer']
const urls = titles.map(title => CAREERS_URL + title.toLowerCase().replaceAll(' ', '-') + '/')
const careers = '<title>Join - Brainstorm Force</title><link rel="canonical" href="' + CAREERS_URL + '">'
  + "<h1>Let's Build the Future of Digital Business Together</h1><h2>Work Remotely From Anywhere</h2>"
  + titles.map((title, index) => '<p style="color:#000f32">' + title + '</p><p>Build our products.</p>'
    + '<p><img title="Join">Remote (India)</p><p><img title="Join">Full-time</p>'
    + '<a href="' + urls[index] + '" aria-label="Apply Now">Apply Now</a>').join('')
const detail = title => '<h1>' + title + '</h1><h2>Job Summary</h2><h3>About the Role</h3>'
  + '<a href="https://forms.brainstormforce.com/apply/" aria-label="Apply Now">Apply Now</a>'

test('Brainstorm Force makes no request when the source is already cancelled', async () => {
  const reason = new Error('Source cancelled')
  let requests = 0
  await assert.rejects(run({ signal: AbortSignal.abort(reason), fetchPage: async () => {
    requests++
    return { url: CAREERS_URL, html: careers }
  } }), error => error === reason)
  assert.equal(requests, 0)
})

test('Brainstorm Force stops after cancellation during either listing or detail fetch without publishing partial jobs', async () => {
  for (const abortUrl of [CAREERS_URL, ...urls]) {
    const controller = new AbortController()
    const reason = new Error('Stop this source')
    const requested = []
    await assert.rejects(run({ signal: controller.signal, fetchPage: async (url, options) => {
      assert.equal(options.signal, controller.signal)
      requested.push(url)
      if (url === abortUrl) controller.abort(reason)
      return { url, html: url === CAREERS_URL ? careers : detail(titles[urls.indexOf(url)]) }
    } }), error => error === reason)
    assert.deepEqual(requested, [CAREERS_URL, ...urls].slice(0, [CAREERS_URL, ...urls].indexOf(abortUrl) + 1))
  }
})

test('Brainstorm Force bounds each default HTTP request to fifteen seconds', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 15000)
    return timeout(5)
  })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal)
    await new Promise(resolve => setTimeout(resolve, 25))
    options.signal.throwIfAborted()
    throw new Error('Expected request deadline to expire')
  })
  await assert.rejects(run(), error => error.name === 'TimeoutError')
})
