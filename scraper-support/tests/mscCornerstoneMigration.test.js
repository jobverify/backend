import assert from 'node:assert/strict'
import test from 'node:test'
import { createMscScraper, CAREERS_URL } from '../../scraper/msc/script.js'

const board = 'https://msc.csod.com/ux/ats/careersite/4/home'
const careers = `<title>Work With Us - Careers &amp; Vacancies | MSC</title><h1>Your Career Starts Here</h1><a href="${board}">Explore our open positions</a>`
const context = { corp: 'msc', cultureID: 2, cultureName: 'en-GB', endpoints: { cloud: 'https://uk.api.csod.com/' }, token: 'public-fixture-token' }
const shell = ctx => `<div id="cs-root"></div><script>csod.context=${JSON.stringify(ctx)};</script>`
const role = (id, country = 'IN') => ({ requisitionId: id, displayJobTitle: 'Sales-Export', locations: [{ city: 'Kanpur', country }], externalDescription: 'Develop customer relationships and coordinate export operations.', postingEffectiveDate: '10/09/2026', postingExpirationDate: '01/12/2026' })
const response = (requisitions, totalCount = requisitions.length) => ({ status: 'Success', data: { requisitions, totalCount } })
const run = (fetchJson, ctx = context) => createMscScraper().run({ fetchText: async url => url === CAREERS_URL ? careers : (assert.equal(url, board), shell(ctx)), fetchJson })

test('MSC follows its new CSOD handoff, paginates and keeps explicit India jobs with British dates', async () => {
  const bodies = []
  const jobs = await run(async (url, options) => {
    assert.equal(url, 'https://uk.api.csod.com/rec-job-search/external/jobs')
    assert.equal(options.headers.Authorization, 'Bearer public-fixture-token')
    const body = JSON.parse(options.body); bodies.push(body)
    return response([role(body.pageNumber, body.pageNumber === 1 ? 'IN' : 'US')], 2)
  })
  assert.equal(bodies.length, 2)
  assert.deepEqual(bodies[0].countryCodes, ['IN'])
  assert.equal(bodies[0].postingsWithinDays, null)
  assert.equal(bodies[0].careerSiteId, 4)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Sales-Export')
  assert.equal(jobs[0].location, 'Kanpur, India')
  assert.equal(jobs[0].postingDate, '2026-09-10T00:00:00.000Z')
  assert.equal(jobs[0].closingDate, '2026-12-01T00:00:00.000Z')
  assert.match(jobs[0].applyUrl, /careersite\/4\/home\/requisition\/1\?c=msc$/)
})

test('MSC accepts only explicit complete empty CSOD results', async () => {
  assert.deepEqual(await run(async () => response([])), [])
  for (const payload of [{}, { status: 'Failure', data: { requisitions: [], totalCount: 0 } }, response([], 1)]) {
    await assert.rejects(run(async () => payload), /MSC|incomplete|payload/i)
  }
})

test('MSC rejects another tenant or unexpected API host before sending the public token', async () => {
  for (const ctx of [{ ...context, corp: 'unrelated' }, { ...context, endpoints: { cloud: 'https://unexpected.example/' } }]) {
    await assert.rejects(run(async () => assert.fail('must not send token'), ctx), /MSC.*context/i)
  }
})

test('MSC rejects malformed roles and repeated pagination', async () => {
  await assert.rejects(run(async () => response([{ ...role(1), displayJobTitle: '' }])), /MSC.*record/i)
  await assert.rejects(run(async () => response([role(1)], 2)), /MSC.*(?:duplicate|pagination)/i)
})


test('msc stops before fetching when the caller is cancelled',async()=>{
 const {run}=await import('../../scraper/msc/script.js');const reason=new Error('cancelled');
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>assert.fail('no fetch')}),error=>error===reason)
})
