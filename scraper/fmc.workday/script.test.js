import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('FMC requires a current official exact board anchor before shared Workday extraction', async () => {
  const controller = new AbortController()
  const nativeDetailRecovery = { pending: 0, receipts: new Map() }
  const result = attachInventoryEvidence([], { status: 'unverified', firstParty: true, listingComplete: false, reason: 'contract-test-only' })
  const jobs = await run({ signal: controller.signal, nativeDetailRecovery, fetchPage: async (url, options) => {
    assert.equal(url, 'https://www.fmc.com/en')
    assert.equal(options.signal, controller.signal)
    return { status: 200, url, html: '<a href="https://fmc.wd12.myworkdayjobs.com/FMC">Careers</a>' }
  }, workdayScraper: async options => {
    assert.equal(options.company, 'FMC')
    assert.equal(options.source, 'fmc')
    assert.equal(options.baseUrl, 'https://fmc.wd12.myworkdayjobs.com/FMC')
    assert.equal(options.boardIdentityVerified, true)
    assert.equal(options.signal, controller.signal)
    assert.equal(options.nativeDetailRecovery, nativeDetailRecovery)
    return result
  } })
  assert.equal(jobs, result)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('FMC identity drift stops extraction instead of returning sentinel zero', async () => {
  let called = false
  await assert.rejects(run({ fetchPage: async url => ({ status: 200, url, html: '<a href="https://technipfmc.wd5.myworkdayjobs.com/Careers">Careers</a>' }), workdayScraper: async () => { called = true; return [] } }), /official.*binding/i)
  assert.equal(called, false)
})

test('FMC contract fixture reaches shared native listing and description extraction', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => ({
    ok: true, status: 200, url, headers: { get: () => init.method === 'POST' || url.includes('/job/') ? 'application/json' : 'text/html', getSetCookie: () => [] },
    json: async () => ({ total: 1, jobPostings: [{ title: 'Engineer', externalPath: '/job/Hyderabad-India/Engineer_R-TEST', locationsText: 'Hyderabad, India' }] }),
    text: async () => url.includes('/job/')
      ? JSON.stringify({ jobPostingInfo: { title: 'Engineer', location: 'Hyderabad, India', jobReqId: 'R-TEST', jobDescription: '<p>Develop and maintain reliable systems for agricultural research.</p>' } })
      : '<html>Workday</html>',
  }))
  const jobs = await run({ fetchPage: async url => ({ status: 200, url, html: '<a href="https://fmc.wd12.myworkdayjobs.com/FMC">Careers</a>' }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'FMC')
  assert.equal(jobs[0].source, 'fmc')
  assert.match(jobs[0].sourceDescription, /agricultural research/)
  assert.match(jobs[0].link || jobs[0].applyUrl, /^https:\/\/fmc\.wd12\.myworkdayjobs\.com\//)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
