import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('Insulet requires its current official exact site link before shared Workday extraction', async () => {
  let calls = 0
  const controller = new AbortController()
  const nativeDetailRecovery = { pending: 0, receipts: new Map() }
  const result = []
  const jobs = await run({ signal: controller.signal, nativeDetailRecovery, fetchPage: async url => {
    assert.equal(url, 'https://www.insulet.com/')
    return { status: 200, url, html: '<a href="https://insulet.wd5.myworkdayjobs.com/insuletcareers">View Our Career Opportunities</a>' }
  }, workdayScraper: async options => {
    calls++
    assert.equal(options.company, 'Insulet')
    assert.equal(options.source, 'insulet')
    assert.equal(options.baseUrl, 'https://insulet.wd5.myworkdayjobs.com/insuletcareers')
    assert.equal(options.boardIdentityVerified, true)
    assert.equal(options.signal, controller.signal)
    assert.equal(options.nativeDetailRecovery, nativeDetailRecovery)
    return result
  } })
  assert.equal(calls, 1)
  assert.equal(jobs, result)
})

test('Insulet rejects the wrong site and blocked official surfaces before extracting', async () => {
  for (const response of [
    { status: 403, url: 'https://www.insulet.com/', html: '' },
    { status: 200, url: 'https://www.insulet.com/', html: '<a href="https://insulet.wd5.myworkdayjobs.com/Students">Careers</a>' },
  ]) await assert.rejects(run({ fetchPage: async () => response, workdayScraper: async () => assert.fail('unbound extraction') }), /official.*binding/i)
})

test('Workday catalog metadata keeps current inventory counts and static binding unverified', () => {
  for (const source of ['fmc', 'insulet']) {
    const provider = getScraperCatalog().find(row => row.source === source)
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.atsPlatform, 'workday')
    assert.equal(provider.zeroResultPolicy, 'evidence-required')
    assert.equal(provider.bindingEvidence.verified, false)
    assert.equal(provider.verifiedIndiaJobCount, null)
    assert.equal(provider.verifiedPublicJobCount, null)
  }
})

test('Insulet contract fixture reaches shared native listing and description extraction', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => ({
    ok: true, status: 200, url, headers: { get: () => init.method === 'POST' || url.includes('/job/') ? 'application/json' : 'text/html', getSetCookie: () => [] },
    json: async () => ({ total: 1, jobPostings: [{ title: 'Engineer', externalPath: '/job/India/Engineer_R-TEST', locationsText: 'India' }] }),
    text: async () => url.includes('/job/')
      ? JSON.stringify({ jobPostingInfo: { title: 'Engineer', location: 'India', jobReqId: 'R-TEST', jobDescription: '<p>Develop and maintain reliable medical device systems.</p>' } })
      : '<html>Workday</html>',
  }))
  const jobs = await run({ fetchPage: async url => ({ status: 200, url, html: '<a href="https://insulet.wd5.myworkdayjobs.com/insuletcareers">View Our Career Opportunities</a>' }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Insulet')
  assert.equal(jobs[0].source, 'insulet')
  assert.match(jobs[0].sourceDescription, /medical device systems/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
