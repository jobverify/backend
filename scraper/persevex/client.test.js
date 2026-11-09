import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import * as source from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFile(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const [careers, client] = await Promise.all(['current-careers.html', 'persevex-careers-client.js'].map(fixture))
const home = Buffer.from(JSON.parse(gunzipSync(await readFile(new URL('./fixtures/current-public-20261105.compact.json.gz', import.meta.url)))).receipts.find(row => row.transport === 'chrome-alternate-public-document' && row.url === source.HOMEPAGE_URL).bodyBase64, 'base64').toString('utf8')
const literal = client.match(/C=(\[\{id:"fe-dev"[\s\S]*?\}\]);function S/)?.[1]
const original = JSON.parse(literal.replace(/([{,])([a-zA-Z]+):/g, '$1"$2":'))
const changedClient = roles => client.replace(literal, JSON.stringify(roles))
const clientUrl = new URL([...careers.matchAll(/<script\b[^>]*src="([^"]+)/g)].map(x => x[1]).find(x => /careers\/page-/.test(x)), source.CAREERS_URL).href
const page = (url, html, status = 200) => ({ status, url, html })
const run = (overrides = {}) => {
  const calls = []
  const pages = new Map([[source.HOMEPAGE_URL, page(source.HOMEPAGE_URL, home)], [source.CAREERS_URL, page(source.CAREERS_URL, careers)], [clientUrl, page(clientUrl, client)]])
  const fetchPage = async url => {
    calls.push(url)
    if (overrides[url]) return overrides[url]
    assert.ok(pages.has(url), 'Unexpected request: ' + url)
    return pages.get(url)
  }
  return { calls, result: source.run({ fetchPage, fetchText: async url => (await fetchPage(url)).html }) }
}

test('Legacy public client supplies three explicitly India roles, complete published detail and unresolved-role evidence', async () => {
  const { calls, result } = run()
  const jobs = await result
  assert.deepEqual(calls, [source.HOMEPAGE_URL, source.CAREERS_URL, clientUrl, source.HOMEPAGE_URL, source.CAREERS_URL, clientUrl])
  assert.equal(jobs.length, 3)
  assert.deepEqual(new Set(jobs.map(j => j.jobId)), new Set(['fe-dev', 'content-lead', 'bd-exec']))
  for (const job of jobs) {
    const published = original.find(r => r.id === job.jobId)
    assert.equal(job.requisitionId, published.id)
    assert.equal(job.location, published.location)
    assert.equal(job.country, 'India')
    assert.equal(job.applyUrl, source.CAREERS_URL)
    assert.equal(job.sourceListingComplete, false)
    assert.ok(job.jobDescription.startsWith(published.description))
    for (const requirement of published.requirements) assert.ok(job.jobDescription.includes(requirement))
    assert.deepEqual(job.requirements, published.requirements)
    assert.ok(!job.jobDescription.includes('Official Persevex opening listed'))
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 6)
  assert.equal(evidence.indiaFacetCount, 3)
  assert.equal(evidence.pagesFetched, 6)
  assert.match(evidence.reason, /3.*unverified/)
  assert.match(evidence.reason, /social-intern.*Remote/)
})

test('HTML-only metadata cannot become a fabricated job description', () => {
  assert.throws(() => source.extractPublicJobs(careers), /published.*client|client.*required/i)
})

test('Entire client inventory is validated before geography filtering', () => {
  for (const patch of [{ description: '' }, { requirements: [] }, { id: '' }, { location: '' }]) {
    const roles = original.map(r => r.id === 'social-intern' ? { ...r, ...patch } : r)
    assert.throws(() => source.extractPublicJobs(careers, changedClient(roles)), /invalid.*role|malformed|requirements|description|identity/i)
  }
})

test('Duplicate stable ids, duplicate properties and executable data abort without JS evaluation', () => {
  const duplicate = original.map(r => r.id === 'social-intern' ? { ...r, id: 'fe-dev' } : r)
  assert.throws(() => source.extractPublicJobs(careers, changedClient(duplicate)), /duplicate/i)
  assert.throws(() => source.extractPublicJobs(careers, client.replace('id:"social-intern"', 'id:"social-intern",id:"other"')), /duplicate/i)
  globalThis.persevexTestExecuted = false
  try {
    assert.throws(() => source.extractPublicJobs(careers, client.replace('description:"Build and maintain', 'description:(globalThis.persevexTestExecuted=true),unused:"Build and maintain')), /literal|malformed|invalid/i)
    assert.equal(globalThis.persevexTestExecuted, false)
  } finally { delete globalThis.persevexTestExecuted }
})

test('Visible card count and every identity/metadata field must match the complete published array', () => {
  assert.throws(() => source.extractPublicJobs(careers.replace('>6</span> role', '>7</span> role'), client), /count|cards/i)
  assert.throws(() => source.extractPublicJobs(careers, changedClient(original.slice(0, 5))), /count|cards/i)
  for (const patch of [{ title: 'Unrelated vacancy' }, { department: 'Other' }, { location: 'Remote (Canada)' }, { type: 'Part-time' }]) {
    assert.throws(() => source.extractPublicJobs(careers, changedClient(original.map((r, i) => i ? r : { ...r, ...patch }))), /match|binding/i)
  }
})

test('The client must bind the same roles to visible detail and the first-party application modal', () => {
  for (const altered of [
    client.replace('children:t.description', 'children:t.other'),
    client.replace('onClick:()=>o(t.title,t.id)', 'onClick:()=>o("Other","other")'),
    client.replace('jobTitle:d.title,jobId:d.id', 'jobTitle:"Other",jobId:"other"'),
    client.replace('fetch("/api/applications"', 'fetch("https://elsewhere.example/applications"'),
    client.replace('M=C.filter', 'M=other.filter'),
  ]) assert.throws(() => source.extractPublicJobs(careers, altered), /client.*binding|application.*binding/i)
})

test('All unknown geography and unverified zero inventory remain failures', () => {
  const roles = original.map(r => ({ ...r, location: 'Remote' }))
  let html = careers
  for (const row of original) html = html.replaceAll(row.location, 'Remote')
  assert.throws(() => source.extractPublicJobs(html, changedClient(roles)), /India.*unverified|no verified India/i)
  assert.throws(() => source.extractPublicJobs(careers.replace('>6</span> role', '>0</span> role'), changedClient([])), /count|zero|empty/i)
})

test('Homepage, careers and client effective URLs retain exact HTTPS identity', async () => {
  for (const target of [source.HOMEPAGE_URL, source.CAREERS_URL, clientUrl]) {
    const expected = target === source.HOMEPAGE_URL ? home : target === source.CAREERS_URL ? careers : client
    await assert.rejects(run({ [target]: page('https://elsewhere.example/' + new URL(target).pathname, expected) }).result, /URL|identity|origin/i)
    await assert.rejects(run({ [target]: page(target.replace('https:', 'http:'), expected) }).result, /URL|identity|origin/i)
  }
})

test('Only the single same-origin careers chunk published on the verified page is fetched', async () => {
  const malicious = careers.replace('/_next/static/chunks/app/(main)/careers/page-', 'https://elsewhere.example/_next/static/chunks/app/(main)/careers/page-')
  const probe = run({ [source.CAREERS_URL]: page(source.CAREERS_URL, malicious) })
  await assert.rejects(probe.result, /client.*URL|same-origin|published.*client/i)
  assert.equal(probe.calls.length, 2)
})

test('The production fetcher rejects off-origin and HTTP redirects before following them', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const location of ['https://elsewhere.example/careers', 'http://www.persevex.com/careers']) {
      const calls = []
      globalThis.fetch = async (url, options) => {
        calls.push(url)
        assert.equal(options.redirect, 'manual')
        assert.ok(options.signal)
        return { status: 302, url, headers: { get: key => key === 'location' ? location : null } }
      }
      await assert.rejects(async () => source.fetchPersevexPage(source.CAREERS_URL), /untrusted.*redirect|redirect.*identity/i)
      assert.deepEqual(calls, [source.CAREERS_URL])
    }
  } finally { globalThis.fetch = originalFetch }
})

test('Contradictory foreign locations matching both cards and client never infer India from a city substring', () => {
  for (const location of ['Pune, United States', 'Remote (India / USA)', 'Bangalore, Singapore']) {
    const roles = original.map(role => role.id === 'fe-dev' ? { ...role, location } : role)
    const html = careers.replace(/(<h3 class="text-lg font-bold text-foreground">Frontend Developer<\/h3>[\s\S]*?)Remote \(India\)/, (_, prefix) => prefix + location)
    const jobs = source.extractPublicJobs(html, changedClient(roles))
    assert.equal(jobs.length, 2)
    assert.ok(jobs.every(job => job.jobId !== 'fe-dev' && job.country === 'India' && job.sourceListingComplete === false))
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 2)
    assert.match(readInventoryEvidence(jobs).reason, /4.*unverified/)
    assert.ok(readInventoryEvidence(jobs).reason.includes(location))
  }
})

test('Malformed contracts, changed response identity and all-unknown scope are guarded soft failures', async () => {
  await assert.rejects(run({ [clientUrl]: page(clientUrl, client.replace('id:"content-lead"', 'id:"fe-dev"')) }).result, error =>
    error.softFailure === true && error.abortRetries === true && error.failureKind === 'upstream_contract_changed' && /duplicate/.test(error.message))
  await assert.rejects(run({ [clientUrl]: page('https://elsewhere.example/client.js', client) }).result, error =>
    error.softFailure === true && error.abortRetries === true && error.failureKind === 'upstream_contract_changed')
  const roles = original.map(role => ({ ...role, location: 'Remote' }))
  let html = careers
  for (const role of original) html = html.replaceAll(role.location, 'Remote')
  await assert.rejects(run({ [source.CAREERS_URL]: page(source.CAREERS_URL, html), [clientUrl]: page(clientUrl, changedClient(roles)) }).result, error =>
    error.softFailure === true && error.abortRetries === true && error.code === 'PERSEVEX_GEOGRAPHY_UNVERIFIED')
})
