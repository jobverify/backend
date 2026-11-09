import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as wingify from '../../scraper/wingify/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'wingify')
const text = (name) => readFileSync(path.join(directory, name), 'utf8')
const json = (name) => JSON.parse(text(name))
const firstParty = json('first-party-jobs.json')
const active = json('keka-active-jobs.json')
const kekaPages = json('keka-detail-pages.json')
const abPages = json('abtasty-detail-pages.json')
const requests = []
const execute = ({ mutateFirst, mutateActive, mutateText, failUrl, signal } = {}) => wingify.run({
  signal,
  fetchJson: async (url) => {
    requests.push(url)
    if (url === failUrl) throw new Error('upstream503 ' + url)
    if (url === wingify.CAREER_PORTAL_INFO_URL) return json('keka-portal-info.json')
    if (url === wingify.FIRST_PARTY_JOBS_URL) { const rows = structuredClone(firstParty); mutateFirst?.(rows); return rows }
    if (url === wingify.ACTIVE_JOBS_URL) { const rows = structuredClone(active); mutateActive?.(rows); return rows }
    throw new Error('Unexpected JSON ' + url)
  },
  fetchText: async (url) => {
    requests.push(url)
    if (url === failUrl) throw new Error('upstream503 ' + url)
    let body
    if (url === wingify.CAREERS_URL) body = text('careers-current.html')
    else if (url === wingify.KEKA_BOARD_URL) body = text('keka-board-current.html')
    else if (url === 'https://careers.abtasty.com/jobs') body = text('abtasty-jobs-current.html')
    else if (url === 'https://careers.abtasty.com/jobs.rss') body = text('abtasty-jobs.rss')
    else if (url.startsWith('https://wingify.keka.com/careers/jobdetails/')) body = kekaPages[url.split('/').pop()]
    else if (url.startsWith('https://careers.abtasty.com/jobs/')) body = abPages[url.split('/').pop().split('-')[0]]
    if (!body) throw new Error('Unexpected text ' + url)
    return mutateText ? mutateText(body, url) : body
  },
  now: () => '2026-10-08T19:30:00.000Z',
})

test('Wingify reconciles its current first-party Keka plus Teamtailor union and retains the Keka-only Delhi UK-sales role', async () => {
  requests.length = 0
  const jobs = await execute()
  assert.equal(jobs.length, 16)
  assert.equal(new Set(jobs.map((job) => job.jobId)).size, 16)
  assert.ok(jobs.every((job) => job.country === 'India' && job.jobDescription && job.applyUrl && job.source === 'wingify'))
  const ukSales = jobs.find((job) => job.jobId === '63642')
  assert.ok(ukSales, 'The independently verified Keka-only India job must be included')
  assert.equal(ukSales.city, 'Delhi')
  assert.equal(ukSales.title, 'Senior SDR - Inbound/Outbound (UK)')
  assert.ok(!jobs.some((job) => job.jobId === '136690'), 'Conflicting Latin America/IN role must not be published as India')
  assert.equal(requests.filter((url) => url.includes('/careers/jobdetails/')).length, 22)
  assert.equal(requests.filter((url) => /^https:\/\/careers\.abtasty\.com\/jobs\/\d+/.test(url)).length, 9)
})

test('Wingify marks every returned job and attached inventory evidence partial while geography is unresolved', async () => {
  const jobs = await execute()
  assert.ok(jobs.every((job) => job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, 31)
  assert.match(evidence.reason, /136690/)
  assert.match(evidence.reason, /Latin America/)
  assert.match(evidence.reason, /IN/)
})

test('Wingify rejects unrecognized handoff hosts, duplicate rows, stale IDs, and mismatched first-party titles', async () => {
  const mutations = [
    (rows) => { rows[0].careerPortalUrl = 'https://other.keka.com/careers/jobdetails/143827' },
    (rows) => { rows.push(structuredClone(rows[0])) },
    (rows) => { rows[0].title = 'Wrong title' },
    (rows) => { rows[21].careerPortalUrl = 'https://careers.abtasty.com/jobs/9999999-wrong' },
    (rows) => { rows[21].jobId = '9999999' },
  ]
  for (const mutateFirst of mutations) await assert.rejects(execute({ mutateFirst }), /Wingify.*(?:first-party|handoff|inventory|reconcil|identity)/i)
})

test('Wingify rejects malformed or duplicate Keka inventories instead of silently skipping records', async () => {
  for (const mutateActive of [
    (rows) => { rows.push(structuredClone(rows[0])) },
    (rows) => { rows[0].id = null },
    (rows) => { rows[0].title = '' },
    (rows) => { rows[0].jobLocations = null },
  ]) await assert.rejects(execute({ mutateActive }), /Wingify.*(?:Keka|inventory|listing|identity)/i)
})

test('Wingify validates public Keka detail identity and published description even for rows omitted by the composite feed', async () => {
  const mutations = [
    (body) => body.replace(/selectedJobId="63642"/g, 'selectedJobId="63641"'),
    (body) => body.replace(/Senior SDR - Inbound\/Outbound \(UK\)/g, 'Wrong identity'),
    (body) => body.replace('Founded in ', 'Wrong description in '),
  ]
  for (const mutation of mutations) await assert.rejects(execute({ mutateText: (body, url) => url.endsWith('/63642') ? mutation(body) : body }), /Wingify.*Keka.*(?:detail|conflict|identity)/i)
})

test('Wingify requires complete matching Teamtailor board and RSS inventories', async () => {
  await assert.rejects(execute({ mutateText: (body, url) => url === 'https://careers.abtasty.com/jobs.rss' ? body.replace(/<item>[\s\S]*?<\/item>/, '') : body }), /Wingify.*(?:Teamtailor|AB Tasty|inventory)/i)
  await assert.rejects(execute({ mutateText: (body, url) => url === 'https://careers.abtasty.com/jobs' ? body.replace(/\/jobs\/8438877-/g, '/jobs/9999999-') : body }), /Wingify.*(?:Teamtailor|AB Tasty|inventory)/i)
})

test('Wingify uses explicit AB Tasty detail country, never geography inferred from a job title', async () => {
  await assert.rejects(execute({ mutateText: (body, url) => url.includes('/jobs/8438877-') ? body.replace(/"addressCountry":"GB"/g, '"addressCountry":"IN"') : body }), /Wingify.*(?:country|location|scope|detail)/i)
  await assert.rejects(execute({ mutateText: (body, url) => url.includes('/jobs/8438877-') ? body.replace(/"value"\s*:\s*"8438877"/g, '"value":"8438878"') : body }), /Wingify.*(?:detail|identity)/i)
})

test('Wingify keeps any required detail outage as a failure, with no partial success from transport errors', async () => {
  await assert.rejects(execute({ failUrl: 'https://wingify.keka.com/careers/jobdetails/63642' }), /upstream503/)
  await assert.rejects(execute({ failUrl: firstParty.find((job) => job.jobId === '8438877').careerPortalUrl }), /upstream503/)
})

test('Wingify preserves cancellation before any public fetch', async () => {
  requests.length = 0
  const controller = new AbortController()
  controller.abort(new Error('cancel Wingify inventory'))
  await assert.rejects(execute({ signal: controller.signal }), /cancel Wingify inventory/)
  assert.equal(requests.length, 0)
})

test('Wingify fails when the independently published AB Tasty handoff disappears', async () => {
  await assert.rejects(execute({ mutateFirst: (rows) => { rows.splice(21) } }), /Wingify.*first-party AB Tasty handoff/i)
})

test('Wingify never returns an empty success when all India candidates remain unresolved', async () => {
  await assert.rejects(execute({ mutateActive: (rows) => {
    for (const row of rows) if (row.id !== 136690) row.jobLocations = [{ name: 'Paris', city: 'Paris', countryCode: 'FR', countryName: 'France' }]
  } }), /Wingify.*unresolved.*no independently verified India inventory/i)
})

test('Wingify also excludes contradictory explicit country names and codes', async () => {
  const jobs = await execute({ mutateActive: (rows) => { rows[1].jobLocations[0].countryName = 'France' } })
  assert.equal(jobs.length, 15)
  assert.ok(!jobs.some((job) => job.jobId === String(active[1].id)))
  assert.match(readInventoryEvidence(jobs).reason, /France\/IN/)
  assert.ok(jobs.every((job) => job.sourceListingComplete === false))
})

test('Wingify forwards and observes cancellation after a public request', async () => {
  const controller = new AbortController()
  let count = 0
  await assert.rejects(wingify.run({ signal: controller.signal, fetchText: async (_url, { signal }) => {
    assert.equal(signal, controller.signal)
    count += 1
    controller.abort(new Error('cancel after first public request'))
    return text('careers-current.html')
  } }), /cancel after first public request/)
  assert.equal(count, 1)
})
