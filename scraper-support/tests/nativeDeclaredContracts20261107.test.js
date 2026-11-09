import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { run as runTruecaller } from '../../scraper/truecallerindia/script.js'
import { run as runVakilsearch } from '../../scraper/vakilsearch/script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = path.join(import.meta.dirname, 'fixtures/declared-native-20261107/additional-captures')
const load = file => JSON.parse(gunzipSync(fs.readFileSync(file)))
const recorded = new Map(fs.readdirSync(directory).filter(file => file.endsWith('.json.gz')).map(file => {
  const packet = load(path.join(directory, file))
  return [packet.requestUrl, packet]
}))
for (const source of ['truecallerindia', 'vakilsearch']) for (const packet of load(path.join(import.meta.dirname, 'fixtures/declared-native-20261107/native-root/current', source, 'packets.json.gz'))) recorded.set(packet.requestUrl, packet)
const jobsPage = load(path.join(import.meta.dirname, 'fixtures/declared-native-20261107/native-root/discovery/truecaller-jobs.json.gz'))
recorded.set(jobsPage.requestUrl, jobsPage)
globalThis.fetch = async () => { throw Error('Regression replay prohibits live network') }

const replay = (change = (url, packet) => packet) => {
  const requests = [], counts = new Map()
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.redirect, 'manual')
    assert.ok(recorded.has(String(url)), 'Only an original declared native URL may be requested: ' + url)
    requests.push(String(url)); counts.set(String(url), (counts.get(String(url)) || 0) + 1)
    const packet = change(String(url), structuredClone(recorded.get(String(url))), counts.get(String(url)))
    const response = new Response(packet.body, { status: packet.status, headers: packet.headers || { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  }
  // fetchHtml is the old JSON-LD reader's injection, allowing the regression to
  // fail as a missing-current-inventory assertion without making live requests.
  return { requests, options: { fetchImpl, fetchHtml: async url => recorded.get(url).body, requestIntervalMs: 0, now: () => '2026-11-07T13:20:00.000Z' } }
}

test('Truecaller follows the current declared client feed and preserves qualified India native criteria', async () => {
  const r = replay(), jobs = await runTruecaller(r.options)
  assert.ok(jobs.length >= 15, 'The current employer-declared feed has seventeen explicit India office postings; the JSON-LD-only entry page emits zero')
  const job = jobs.find(job => job.jobId === '8280698')
  assert.ok(job)
  assert.equal(job.country, 'India')
  assert.match(job.jobDescription, /pricing/i)
  assert.equal(job.nativeSourceRecord.company_name, 'Truecaller')
  assert.equal(job.sourceCurrentNativeRoleQualified, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(r.requests.filter(url => url.endsWith('/jobs?content=true')).length >= 2)
})

test('Vakilsearch follows current corporate role links and keeps complete role criteria and Chennai country proof', async () => {
  const r = replay(), jobs = await runVakilsearch(r.options)
  assert.ok(jobs.length > 0, 'Current corporate careers publishes thirteen native role links; the historical Trakstar JSON-LD reader emits zero')
  const job = jobs.find(job => job.sourceUrl.endsWith('/accounting-and-taxation-expert'))
  assert.ok(job)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Chennai')
  assert.match(job.jobDescription, /CA \(Inter\/Semi qualified\)/)
  assert.match(job.jobDescription, /Age Group: 20/)
  assert.equal(job.sourceCurrentNativeRoleQualified, true)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(job.sourceNativeCountryEvidence.kind, 'exact-role-city-and-current-publisher-office-postal-country')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(r.requests.every(url => new URL(url).hostname === 'vakilsearch.com'))
})

test('Vakilsearch holds a mismatched own role without discarding independent qualified corporate roles', async () => {
  const r = replay((url, packet) => {
    if (url.endsWith('/accounting-and-taxation-expert')) {
      const prior = packet.body
      packet.body = packet.body.replace(/(<h1\b[^>]*>)Accounting and Taxation Analyst/, '$1Different Native Role')
      assert.notEqual(packet.body, prior, 'Own h1 fixture mutation must apply')
    }
    return packet
  })
  const jobs = await runVakilsearch(r.options)
  assert.ok(jobs.length > 0)
  assert.equal(jobs.some(job => job.sourceUrl.endsWith('/accounting-and-taxation-expert')), false)
})
