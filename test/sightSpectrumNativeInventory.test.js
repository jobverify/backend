import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as source from '../scraper/sightspectrumtechnologysolutions/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/sightspectrumtechnologysolutions/fixtures/native-20261030.json.gz', import.meta.url))))
const actual = fixture[0].html
const transport = (mutate = value => value) => {
  const calls = [], counts = new Map()
  return { calls, fetchImpl: async (url, options) => {
    assert.equal(options.signal.aborted, false)
    calls.push(url); counts.set(url, (counts.get(url) || 0) + 1)
    const row = fixture.find(row => row.receipt.url === url)
    assert.ok(row, `Unexpected request ${url}`)
    const response = new Response(mutate(row.html, url, counts.get(url)), { status: 200, headers: { 'content-type': row.receipt.contentType } })
    Object.defineProperty(response, 'url', { value: url, configurable: true })
    return response
  } }
}
const execute = async (options = {}, mutate) => {
  const io = transport(mutate), audits = []
  // fetchText also makes this a network-free regression against the old runtime.
  const jobs = await source.run({ ...io, fetchText: async () => actual, onAudit: audit => audits.push(audit), ...options })
  return { jobs, audit: audits.at(-1), calls: io.calls }
}

test('unknown historical locations do not invent India or experience from Data Engineer title', () => {
  const html = '<section class="job-opening"><h2>Data Engineer</h2><p>chennai</p><p>Role Summary: Native SQL criteria only.</p></section>'
  const jobs = source.extractJobs(html)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].experienceRequired, null)
})

test('current Wix records retain native IDs, full raw JSONLD and criteria without city-country inference', () => {
  const jobs = source.extractJobs(actual)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => job.jobId), ['2e837e6a-9040-43ea-a066-6cc613adcb23', '94b98cd2-0767-426c-b55c-c44c0cdc8d6e'])
  assert.ok(jobs.every(job => job.country === null && job.sourceDetailComplete === false))
  assert.match(jobs[0].jobDescription, /Optimize database performance/)
  assert.match(jobs[0].jobDescription, /2\+ years of relevant experience/)
  assert.equal(jobs[0].experienceRequired, '2+ years')
  assert.equal(jobs[1].title, 'UI/UX Designer')
  assert.match(jobs[1].sourceNativeRecord.description, /Frontend Engineer/)
  assert.ok(jobs[1].sourceScopeGaps.includes('native-title-description-discrepancy'))
})

test('Data Engineer experience must come from real criteria rather than its title', () => {
  const jobs = source.extractJobs('<section class="job-opening"><h2>Data Engineer</h2><p>chennai</p><p>SQL skills required.</p></section>')
  assert.equal(jobs[0].experienceRequired, null)
})

test('unparsed historical mixed-country alternatives cannot collapse to India', () => {
  const jobs = source.extractJobs('<section class="job-opening"><h2>Engineer</h2><p>India / Germany</p><p>Native requirements.</p></section>')
  assert.equal(jobs[0].country, null)
})

test('India runtime retains two raw records in audit and advertises incomplete unknown scope, never verified empty', async () => {
  const { jobs, audit, calls } = await execute()
  assert.equal(jobs.length, 0)
  assert.ok(audit, 'Runtime must retain native records and incomplete scope audit')
  assert.equal(audit.nativeRecords.length, 2)
  assert.equal(audit.unknownCountryCount, 2)
  assert.equal(audit.cleanupEligible, false)
  assert.equal(audit.reportedTotal, null)
  assert.equal(audit.indiaFacetCount, null)
  assert.equal(audit.documents.length, 8)
  assert.equal(calls.length, 8)
  assert.equal(audit.nativeRecords[1].sourceNativeRecord.jobLocation.address, 'chennai')
  assert.ok(audit.channels.some(channel => channel.href?.endsWith('/job-board-and-careers-page')))
  assert.ok(audit.channels.some(channel => channel.attrs?.['aria-label'] === 'Resume Upload'))
  assert.deepEqual(readInventoryEvidence(jobs), { status: 'coverage-gap', surface: source.CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched: 8, reportedTotal: null, indiaFacetCount: null, verifiedAt: audit.verifiedAt, reason: 'sightspectrum-native-country-and-inventory-scope-unresolved' })
})

test('global inspection preserves both countryless records and their contradictory raw JD without claiming full details', async () => {
  const { jobs, audit } = await execute({ countryFilter: 'Global' })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.country === null && job.sourceDetailComplete === false && job.sourceListingComplete === false))
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false))
  assert.equal(audit.nativeRecords[1].sourceNativeRecord.title, 'UI/UX Designer')
  assert.match(audit.nativeRecords[1].sourceNativeRecord.description, /Frontend Engineer/)
})

test('invalid publication date is null in normalized observations and preserved intact in native data', async () => {
  const { jobs } = await execute({ countryFilter: 'Global' }, (html, url) => url === source.CAREERS_URL ? html.replace('"datePosted":"2026-04-28T07:08:59.051Z"', '"datePosted":"not-a-date"') : html)
  assert.equal(jobs[0].sourceNativeRecord.datePosted, 'not-a-date')
  assert.equal(jobs[0].postingDate, null)
  assert.ok(jobs[0].sourceScopeGaps.includes('unreviewed-native-schema'))
})

test('JSONLD and visible title mismatch remains raw, unbound and incomplete', async () => {
  const { audit } = await execute({}, (html, url) => url === source.CAREERS_URL ? html.replace('"title":"Data Engineer"', '"title":"Mandatory licensed specialist"') : html)
  assert.equal(audit.nativeRecords[0].sourceNativeRecord.title, 'Mandatory licensed specialist')
  assert.equal(audit.nativeRecords[0].sourceDetailComplete, false)
  assert.ok(audit.nativeRecords[0].sourceScopeGaps.includes('native-visible-role-binding-unresolved'))
})

test('empty or hidden structured criteria never become complete or silently disappear from raw audit', async () => {
  for (const description of ['', '<div style="opacity:0">Mandatory license required</div>']) {
    const { audit } = await execute({}, (html, url) => {
      if (url !== source.CAREERS_URL) return html
      return html.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/, (_, open, json, close) => { const row = JSON.parse(json); row.description = description; return open + JSON.stringify(row) + close })
    })
    assert.equal(audit.nativeRecords.length, 2)
    assert.equal(audit.nativeRecords[0].sourceNativeRecord.description, description)
    assert.equal(audit.nativeRecords[0].sourceDetailComplete, false)
  }
})

test('unknown mandatory metadata remains intact and role detail stays incomplete', async () => {
  const { audit } = await execute({}, (html, url) => url === source.CAREERS_URL ? html.replace('"title":"Data Engineer"', '"mandatoryLicense":{"eligibleCountries":["India"]},"title":"Data Engineer"') : html)
  assert.deepEqual(audit.nativeRecords[0].sourceNativeRecord.mandatoryLicense, { eligibleCountries: ['India'] })
  assert.ok(audit.nativeRecords[0].sourceScopeGaps.includes('unreviewed-native-schema'))
})

test('closing changes to criteria, styles, forms and secondary channels remain scope gaps with all raw snapshots', async () => {
  for (const extra of ['<style>body::after{content:"Hiring"}</style>', '<form action="https://other.example/jobs"></form>', '<iframe src="https://jobs.ashbyhq.com/other"></iframe>', '<div data-jobs="https://other.example">New role</div>']) {
    const { audit } = await execute({}, (html, url, count) => count === 2 && url === source.CAREERS_URL ? html.replace('</body>', extra + '</body>') : html)
    assert.equal(audit.openingClosingMatch, false)
    assert.equal(audit.nativeRecords.length, 2)
    assert.ok(audit.documents.at(-4).html.includes(extra))
    assert.equal(audit.cleanupEligible, false)
  }
})

test('body-only transport and HTTP, URL, MIME, body cap, abort failures cannot certify empty scope', async () => {
  await assert.rejects(source.run({ fetchText: async () => actual }), /metadata|transport/i)
  for (const change of [response => new Response(actual, { status: 403 }), response => { Object.defineProperty(response, 'url', { value: 'https://other.example/careers', configurable: true }); return response }, response => new Response(actual, { headers: { 'content-type': 'application/json' } })]) {
    const io = transport()
    await assert.rejects(source.run({ fetchImpl: async (...args) => change(await io.fetchImpl(...args)) }), /HTTP|URL|MIME|response/i)
  }
  await assert.rejects(source.run({ ...transport(), maxResponseBytes: 10 }), /cap|large|limit/i)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(source.run({ ...transport(), signal: controller.signal }), /abort/i)
})

test('missing or malformed native records and duplicate role identities fail closed', async () => {
  for (const mutate of [html => html.replace(/type="application\/ld\+json"/g, 'type="text/plain"'), html => html.replace('"title":"Data Engineer"', '"title":'), html => html.replaceAll('94b98cd2-0767-426c-b55c-c44c0cdc8d6e', '2e837e6a-9040-43ea-a066-6cc613adcb23')]) {
    await assert.rejects(execute({}, (html, url) => url === source.CAREERS_URL ? mutate(html) : html), /native|identity|JSON|binding/i)
  }
})

test('closing-only JD changes are retained independently and native inventory cannot be capped', async () => {
  const { audit } = await execute({}, (html, url, count) => count === 2 && url === source.CAREERS_URL ? html.replace('Strong SQL and Python skills', 'Mandatory license criteria changed') : html)
  assert.equal(audit.openingClosingMatch, false)
  assert.match(audit.closingNativeRecords[0].sourceNativeRecord.description, /Mandatory license criteria changed/)
  assert.match(audit.nativeRecords[0].sourceNativeRecord.description, /Strong SQL and Python skills/)
  await assert.rejects(execute({ maxJobs: 1 }), /cap|truncat/i)
})
