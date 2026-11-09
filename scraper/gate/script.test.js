import assert from 'node:assert/strict'
import test from 'node:test'
import { createGateScraper } from './script.js'

const CAREERS = 'https://www.gate.com/careers'
const html = '<title>Gate Careers | Crypto &amp; Web3 Jobs at Gate | Gate.com</title><h1>Join Gate &amp; Shape A New Career Chapter</h1><p>Join global innovators to shape the future of crypto finance and create your own impact.</p><h2>Our Culture, One Gate</h2><h2>Our Core Values</h2><h2>Why Gate</h2><h2>Unlock Your Next Career Chapter</h2><p>View All Positions (0)</p><h2>Gate News &amp; Insights</h2><a>LinkedIn</a>'
const row = (id) => ({ position_id: id, slug: 'engineer-' + id, public_title: 'Software Engineer', job_category_code: 'engineering', employment_type_code: 'full-time', location: 'Remote', work_mode: 'remote' })
const text = async (url) => { assert.equal(url, CAREERS); return html }
const taxonomies = { code: 0, data: { job_categories: [{ code: 'engineering', label: 'R&D' }], employment_types: [{ code: 'full-time', label: 'Full-time' }] } }
const fixture = (total = 2) => async (url) => {
  const u = new URL(url)
  if (u.pathname.endsWith('/taxonomies')) return taxonomies
  if (u.pathname.endsWith('/positions')) {
    assert.equal(u.searchParams.get('site_code'), 'global')
    const page = Number(u.searchParams.get('page'))
    const limit = Number(u.searchParams.get('limit'))
    return { code: 0, data: { total, page, limit, list: total ? [row(page)] : [] } }
  }
  assert.equal(u.pathname, '/api/web/v1/tst/career/position_detail')
  const id = Number(u.searchParams.get('position_id'))
  return { code: 0, data: { ...row(id), about_role: 'Build systems.', responsibilities: 'Ship software.', requirements: 'Five years experience.' } }
}

test('Gate enumerates its new first-party API despite the SSR loading count being zero', async () => {
  const jobs = await createGateScraper({ pageSize: 1, now: () => '2026-10-03T00:00:00.000Z' }).run({ fetchText: text, fetchJson: fixture() })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceUrl, 'https://www.gate.com/careers/jobs/engineer-1')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].company, 'Gate')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].location, 'Remote')
  assert.equal(jobs[0].remoteStatus, 'Remote')
  assert.equal(jobs[0].department, 'R&D')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].atsPlatform, 'official-first-party-careers-api')
  assert.equal(jobs[0].jobDescription, 'Build systems. Ship software. Five years experience.')
})

test('Gate rejects failed, malformed, and incomplete API payloads without accepting shell zero counts', async () => {
  for (const data of [{ total: 1, page: 1, limit: 50, list: [] }, { total: 0, page: 1, limit: 50 }, { total: 1, page: 1, limit: 50, list: [{ position_id: 1 }] }]) {
    await assert.rejects(createGateScraper().run({ fetchText: text, fetchJson: async (url) => url.includes('taxonomies') ? taxonomies : ({ code: 0, data }) }), /positions/)
  }
  await assert.rejects(createGateScraper().run({ fetchText: text, fetchJson: async () => ({ code: -1, data: {} }) }), /taxonomies/)
})

test('Gate checks detail identity, accepts confirmed empty inventory, and marks limited output incomplete', async () => {
  await assert.rejects(createGateScraper().run({ fetchText: text, fetchJson: async (url) => url.includes('position_detail') ? ({ code: 0, data: row(999) }) : fixture(1)(url) }), /detail/)
  assert.deepEqual(await createGateScraper().run({ fetchText: text, fetchJson: fixture(0) }), [])
  const jobs = await createGateScraper({ pageSize: 1, maxJobs: 1 }).run({ fetchText: text, fetchJson: fixture() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Gate propagates upstream errors, page drift, changed careers identity and cancellation', async () => {
  await assert.rejects(createGateScraper().run({ fetchText: text, fetchJson: async () => { throw new Error('HTTP 503 upstream') } }), /HTTP 503 upstream/)
  await assert.rejects(createGateScraper().run({ fetchText: async () => '<title>Other careers</title>' }), /official Gate careers/)
  const controller = new AbortController()
  controller.abort(new Error('cancelled Gate'))
  await assert.rejects(createGateScraper().run({ signal: controller.signal, fetchText: async () => assert.fail('Cancelled') }), /cancelled Gate/)
})
