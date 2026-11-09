import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { runKulaPublicApi } from '../shared/kulaPublicApi.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const rows = JSON.parse(fs.readFileSync(new URL('./fixtures/kula/public-api-native-rows.json', import.meta.url)))
const clone = value => structuredClone(value)
const model = (source, jobs) => `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify({ accountName: source, jobs, departments: [], locations: [] })}\n`]).replace(/</g, '\\u003c')})</script>`
const mapKulaJobs = native => native.map(row => ({ jobId: String(row.id), title: row.title, jobDescription: row.ats_job.job_description,
  applyUrl: `https://careers.kula.ai/avoma/${row.id}/?jobs=true`, sourceUrl: `https://careers.kula.ai/avoma/${row.id}/?jobs=true`, sourceListingComplete: false }))
const setup = (mutate = () => {}, options = {}) => {
  const row = clone(rows.avoma)
  const payload = { data: [row], meta: { count: 1, page: 1, items: 99, pages: 1 }, errors: [] }
  mutate(payload)
  return runKulaPublicApi({ source: 'avoma', mapKulaJobs }, {
    fetchText: async url => url.includes('www.avoma.com') ? '<iframe src="https://careers.kula.ai/avoma?jobs=true"></iframe>' : model('avoma', [row]),
    fetchJson: async () => payload, ...options,
  })
}

test('public API inventory overrides mapper partial marker only after reconciliation and retains exact URLs', async () => {
  const jobs = await setup()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, rows.avoma.ats_job.job_description)
  assert.equal(jobs[0].applyUrl, `https://careers.kula.ai/avoma/${rows.avoma.id}/?jobs=true`)
  assert.equal(jobs[0].postingDate, rows.avoma.launch_at)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

for (const [name, mutate] of [
  ['HTTP200 application error', p => { p.errors = [{ message: 'upstream failed' }] }],
  ['missing errors contract', p => { delete p.errors }],
  ['wrong account', p => { p.data[0].account_id = 1339 }],
  ['string identity', p => { p.data[0].id = String(p.data[0].id) }],
  ['unlisted role', p => { p.data[0].listed = false }],
  ['confidential role', p => { p.data[0].is_confidential = true }],
  ['internal role', p => { p.data[0].kind = 'internal' }],
  ['unknown country', p => { p.data[0].ats_job.offices[0].country = 'Unknown' }],
  ['malformed country', p => { p.data[0].ats_job.offices[0].country = ['India'] }],
  ['city conflict', p => { p.data[0].ats_job.offices[0].city = 'Seattle' }],
  ['location conflict', p => { p.data[0].ats_job.offices[0].location = 'Seattle, United States' }],
  ['unresolved description', p => { p.data[0].ats_job.job_description = '$23' }],
  ['malformed description', p => { p.data[0].ats_job.job_description = {} }],
  ['invalid launch date', p => { p.data[0].launch_at = 'yesterday' }],
  ['future launch date', p => { p.data[0].launch_at = '2099-01-01T00:00:00Z' }],
  ['invalid closing date', p => { p.data[0].end_at = 'tomorrow' }],
  ['missing count', p => { delete p.meta.count }],
  ['string count', p => { p.meta.count = '1' }],
  ['wrong page', p => { p.meta.page = 2 }],
  ['wrong page size', p => { p.meta.items = 50 }],
  ['truncated page', p => { p.meta.count = 2 }],
  ['unreconciled pages', p => { p.meta.pages = 2 }],
]) test(`rejects ${name}`, async () => { await assert.rejects(setup(mutate)) })

test('missing JD remains an India row with detail failure and raw-script content cannot become healthy', async () => {
  for (const value of [null, '', '<script>Build robust distributed infrastructure and own delivery of engineering projects.</script>']) {
    const jobs = await setup(p => { p.data[0].ats_job.job_description = value })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].jobDescription, null)
  }
})

test('job cap is partial, explicit zero cannot certify empty', async () => {
  const jobs = await setup(() => {}, { maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('caller abort stops requests; invalid page cap cannot certify empty', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(setup(() => {}, { signal: controller.signal }))
  await assert.rejects(setup(() => {}, { maxPages: 0 }))
})

test('corporate comment or data-src cannot establish a handoff; inactive Flight model cannot establish identity', async () => {
  for (const official of ['<!--<iframe src="https://careers.kula.ai/avoma?jobs=true"></iframe>-->', '<iframe data-src="https://careers.kula.ai/avoma?jobs=true"></iframe>']) {
    await assert.rejects(setup(() => {}, { fetchText: async url => url.includes('www.avoma.com') ? official : model('avoma', [rows.avoma]) }))
  }
  await assert.rejects(setup(() => {}, { fetchText: async url => url.includes('www.avoma.com')
    ? '<a href="https://careers.kula.ai/avoma">Jobs</a>' : `<template>${model('avoma', [rows.avoma])}</template>` }))
})

test('board observed subset must match exact API identity and title', async () => {
  await assert.rejects(setup(() => {}, { fetchText: async url => url.includes('www.avoma.com')
    ? '<a href="https://careers.kula.ai/avoma">Jobs</a>' : model('avoma', [{ ...rows.avoma, title: 'Different role' }]) }))
})

test('pagination reconciles stable totals, unique IDs and terminal page', async () => {
  const native = Array.from({ length: 100 }, (_, i) => ({ ...clone(rows.avoma), id: 100000 + i }))
  const fetchText = async url => url.includes('www.avoma.com') ? '<a href="https://careers.kula.ai/avoma">Jobs</a>' : model('avoma', native.slice(0, 20))
  const fetchJson = async url => {
    const page = Number(new URL(url).searchParams.get('page'))
    return { data: native.slice((page - 1) * 99, page * 99), meta: { count: 100, page, items: 99, pages: 2 }, errors: [] }
  }
  const jobs = await setup(() => {}, { fetchText, fetchJson })
  assert.equal(jobs.length, 100)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  for (const mutate of [p => { p.meta.count = 101 }, p => { p.data[0] = native[0] }]) {
    await assert.rejects(setup(() => {}, { fetchText, fetchJson: async url => { const p = await fetchJson(url); if(p.meta.page === 2) mutate(p); return p } }))
  }
  const limited = await setup(() => {}, { fetchText, fetchJson, maxPages: 1 })
  assert.equal(limited.length, 99)
  assert.equal(readInventoryEvidence(limited).listingComplete, false)
  assert.ok(limited.every(j => j.sourceListingComplete === false))
})

for (const source of Object.keys(rows)) test(`${source} wrapper uses complete API and preserves pure mapper`, async () => {
  const module = await import(`../../scraper/${source}/script.js`)
  const factory = Object.keys(module).find(key => /^create.*Scraper$/.test(key))
  const run = factory ? module[factory]().run : module.run
  const row = clone(rows[source])
  const jobs = await run({
    fetchText: async url => url.startsWith('https://careers.kula.ai') ? model(source, [row]) : `<a href="https://careers.kula.ai/${source}">Careers</a>`,
    fetchJson: async () => ({ data: [row], meta: { count: 1, page: 1, items: 99, pages: 1 }, errors: [] }),
  })
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 1)
  assert.equal(typeof module.mapKulaJobs, 'function')
  if (source !== 'lionsbot') assert.equal(jobs[0].sourceListingComplete, true)
  else { assert.equal(jobs.length, 0); assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory') }
})

test('complete native zero requires a matching empty board; foreign inventory is never global empty', async () => {
  const empty = await setup(p => { p.data = []; p.meta = { count: 0, page: 1, pages: 0, items: 99 } }, {
    fetchText: async url => url.includes('www.avoma.com') ? '<a href="https://careers.kula.ai/avoma">Careers</a>' : model('avoma', []),
  })
  assert.equal(readInventoryEvidence(empty).status, 'verified-empty')
  assert.equal(readInventoryEvidence(empty).reportedTotal, 0)
  await assert.rejects(setup(p => { p.data = []; p.meta = { count: 0, page: 1, pages: 0, items: 99 } }))
})

test('mixed unknown remote office cannot silently become India; known mixed offices retain India location only', async () => {
  await assert.rejects(setup(p => p.data[0].ats_job.offices.push({ name: 'Remote', remote: true })))
  const jobs = await setup(p => p.data[0].ats_job.offices.push({ country: 'United States', country_code: 'US', location: 'Seattle, Washington, United States', city: 'Seattle' }))
  assert.equal(jobs[0].location, rows.avoma.ats_job.offices[0].location)
})

test('native closing instant is preserved for existing exact-expiry eligibility filtering', async () => {
  const jobs = await setup(p => { p.data[0].end_at = '2026-10-01T11:04:00.000Z' })
  assert.equal(jobs[0].closingDate, '2026-10-01T11:04:00.000Z')
  assert.equal(jobs[0].sourceClosingDateIsExact, true)
})

for (const field of ['launch_at', 'end_at']) for (const value of [
  '2026-02-30T12:00:00.000Z', '2025-02-29T12:00:00.000Z', '2026-04-31T12:00:00.000Z', '2026-01-01T24:00:00.000Z',
]) test(`rejects impossible calendar ${field} ${value}`, async () => {
  await assert.rejects(setup(p => { p.data[0][field] = value }), /invalid .* date/)
})

test('valid native leap-day dates remain exact', async () => {
  const jobs = await setup(p => { p.data[0].launch_at = '2024-02-29T12:00:00.000Z' })
  assert.equal(jobs[0].postingDate, '2024-02-29T12:00:00.000Z')
})

test('ACKO office 2011 exception is exact and source scoped', async () => {
  const office = { id: 2011, name: 'New Delhi', location: null, location_key: 'remote(new delhi)', country: null,
    country_code: null, state: null, city: null, remote: true, workplace: 'remote' }
  const module = await import('../../scraper/acko/script.js')
  const run = async mutate => {
    const row = clone(rows.acko); row.ats_job.offices = [clone(office)]; mutate?.(row)
    return module.run({ fetchText: async url => url.includes('www.acko.com') ? '<iframe src="https://careers.kula.ai/acko?jobs=true"></iframe>' : model('acko', [row]),
      fetchJson: async () => ({ data: [row], meta: { count: 1, page: 1, items: 99, pages: 1 }, errors: [] }) })
  }
  assert.equal((await run())[0].city, 'New Delhi')
  for (const change of [o => { o.id = 2012 }, o => { o.name = 'Delhi' }, o => { o.country = 'United States' }, o => { o.location_key = 'remote' }]) {
    await assert.rejects(run(row => change(row.ats_job.offices[0])))
  }
  await assert.rejects(setup(p => { p.data[0].ats_job.offices = [office] }))
})

test('legacy Lionsbot observed HTML never certifies complete or zero', async () => {
  const module = await import('../../scraper/lionsbot/script.js')
  const jobs = await module.run({ fetchText: async url => url.includes('www.lionsbot.com')
    ? '<title>Careers at LionsBot | Robotics Jobs in Singapore</title><h1>Start your career at LionsBot.</h1><p>Openings change often, so the live list is on the job board.</p><a href="https://careers.kula.ai/lionsbot">See open roles</a>'
    : `<title>LionsBot International Pte Ltd Careers | Open Jobs</title><link rel="canonical" href="https://careers.kula.ai/lionsbot" />${model('lionsbot', [rows.lionsbot])}` })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
