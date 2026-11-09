import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyOfficialAtsBinding } from '../utils/officialAtsBinding.js'

const config = { source: 'example', officialUrl: 'https://example.com/careers', boardUrl: 'https://job-boards.greenhouse.io/example' }
const page = html => ({ status: 200, url: config.officialUrl, html })
const check = (response, options = {}) => verifyOfficialAtsBinding(config, { fetchPage: async () => response, ...options })

test('binds the exact board from a live official anchor without assigning inventory evidence', async () => {
  const evidence = await check(page('<a href="https://boards.greenhouse.io/example">Search jobs</a>'))
  assert.equal(evidence.verified, true)
  assert.equal(evidence.officialURL, config.officialUrl)
  assert.deepEqual(evidence.matchedLinks, ['https://boards.greenhouse.io/example'])
  assert.ok(Date.parse(evidence.checkedAt))
  assert.equal(evidence.listingComplete, undefined)
})

test('does not trust a shell, comment, script, wrong tenant, credentials, or lookalike host', async () => {
  for (const html of [
    '<div>Careers</div>',
    '<!-- <a href="https://job-boards.greenhouse.io/example">Jobs</a> -->',
    '<div hidden><a href="https://job-boards.greenhouse.io/example">Jobs</a></div>',
    '<div inert><a href="https://job-boards.greenhouse.io/example">Jobs</a></div>',
    '<a inert href="https://job-boards.greenhouse.io/example">Jobs</a>',
    '<div aria-hidden="true"><a href="https://job-boards.greenhouse.io/example">Jobs</a></div>',
    '<div style="display:none"><a href="https://job-boards.greenhouse.io/example">Jobs</a></div>',
    '<object data="/existing.pdf"><a href="https://job-boards.greenhouse.io/example">Jobs</a></object>',
    '<xmp><a href="https://job-boards.greenhouse.io/example">Jobs</a></xmp>',
    '<iframe><a href="https://job-boards.greenhouse.io/example">Jobs</a></iframe>',
    '<script>const board = \'<a href="https://job-boards.greenhouse.io/example">Jobs</a>\'</script>',
    '<a href="https://job-boards.greenhouse.io/example-other">Jobs</a>',
    '<a href="https://user@job-boards.greenhouse.io/example">Jobs</a>',
    '<a href="https://job-boards.greenhouse.io.evil.invalid/example">Jobs</a>',
    '<a title=\'href="https://job-boards.greenhouse.io/example"\' href="/about">About</a>',
    '<a data-href="https://job-boards.greenhouse.io/example">Jobs</a>',
    '<a href="https://boards.eu.greenhouse.io/example">Jobs</a>',
    '<!-- <a href="https://job-boards.greenhouse.io/example">Jobs</a>',
    '<script>const board = \'<a href="https://job-boards.greenhouse.io/example">Jobs</a>\'',
  ]) await assert.rejects(check(page(html)), error => error.softFailure === true && error.failureKind === 'source_identity_unverified')
})

test('rejects blocked official pages and redirects outside the configured company domain', async () => {
  const html = '<a href="https://job-boards.greenhouse.io/example">Jobs</a>'
  for (const response of [
    { ...page(html), status: 403 },
    { ...page(html), url: 'https://acquirer.invalid/careers' },
    { ...page(html), url: 'https://example.com.evil.invalid/careers' },
  ]) await assert.rejects(check(response), /official.*binding/i)
})

test('matches exact Workday tenant and site, allowing an official board locale', async () => {
  const workday = { ...config, boardUrl: 'https://tenant.wd5.myworkdayjobs.com/Careers' }
  const fetchPage = async () => page('<a href="https://tenant.wd5.myworkdayjobs.com/en-US/Careers">View Career Opportunities</a>')
  assert.equal((await verifyOfficialAtsBinding(workday, { fetchPage })).verified, true)
  await assert.rejects(verifyOfficialAtsBinding(workday, { fetchPage: async () => page('<a href="https://tenant.wd5.myworkdayjobs.com/OtherSite">Careers</a>') }), /official.*binding/i)
})

test('propagates cancellation and transport errors without fabricating an empty inventory', async () => {
  const controller = new AbortController()
  const reason = new Error('cancelled source')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(check(null, { signal: controller.signal, fetchPage: async () => { calls++; return page('') } }), error => error === reason)
  assert.equal(calls, 0)
  const timeout = new Error('connection timed out')
  await assert.rejects(check(null, { fetchPage: async () => { throw timeout } }), error => error === timeout)
})
