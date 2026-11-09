import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createSnowplowScraper} from './script.js'
import {inspectRetainedPackets} from './archivedDiagnostic.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const packet = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261105.json.gz', import.meta.url))))
const feed = 'https://snowplow.careers.hibob.com/api/job-ad'
const corporate = 'https://snowplow.io/careers'
const run = async (mutate = () => {}, collector = null) => {
  let audit, error
  const calls = []
  const fetchPage = async (url, init) => {
    const original = packet.packets.find(p => p.requestUrl === url)
    assert.ok(original, 'Missing original current public response: ' + url)
    const response = {status: original.status, url: original.url, contentType: original.contentType, body: original.body}
    mutate(response, url, calls)
    calls.push({url, init})
    return response
  }
  let jobs
  if(!collector){try{const d=await inspectRetainedPackets(packet.packets,mutate);return{...d,calls:d.requests,error:null}}catch(error){return{error,calls,audit}}}
  try { jobs = await (collector || createSnowplowScraper()).run({fetchPage, onAudit: value => { audit = value }, now: () => collector ? new Date().toISOString() : '2026-11-05T04:00:00.000Z'}) }
  catch (failure) { error = failure }
  return {jobs, evidence: jobs && readInventoryEvidence(jobs), audit, calls, error}
}
const edit = (response, change) => { const data = JSON.parse(response.body); change(data); response.body = JSON.stringify(data) }
const partial = result => {
  if (result.error) assert.equal(result.error.inventoryEvidence?.listingComplete, false)
  else {
    assert.equal(result.evidence.listingComplete, false)
    assert.equal(result.evidence.reportedTotal, null)
    assert.equal(result.evidence.indiaFacetCount, null)
  }
}

test('current corporate twelve roles reconcile with complete native criteria and all public application forms before checked India zero', async () => {
  const result = await run()
  assert.ifError(result.error)
  assert.equal(result.jobs.length, 0)
  assert.equal(result.evidence.listingComplete, true)
  assert.equal(result.evidence.reportedTotal, 12)
  assert.equal(result.evidence.indiaFacetCount, 0)
  assert.deepEqual(result.audit.canonicalCountryCounts, {US: 7, GB: 5})
  assert.equal(result.audit.corporateRoleProofs.length, 12)
  assert.equal(result.audit.detailProofs.filter(p => p.rawOpening && p.rawClosing).length, 12)
  assert.ok(result.audit.rawOpeningFeed.jobAdDetails.every(row => Array.isArray(row.postingLocations) && !row.postingLocations.length))
  assert.match(result.audit.originalEngineEvidence.reason, /additional-public-filter-scope/)
  assert.ok(result.calls.filter(c => c.url.includes('/api/')).every(c => c.init.headers.companyIdentifier === 'snowplow'))
})

test('pure closing role order changes preserve the same complete current native inventory', async () => {
  const result = await run((response, url, calls) => {
    if (url === feed && calls.some(c => c.url === feed)) edit(response, data => data.jobAdDetails.reverse())
  })
  assert.ifError(result.error)
  assert.equal(result.evidence.listingComplete, true)
  assert.equal(result.evidence.reportedTotal, 12)
})

test('actual catalog wrapper preserves twelve raw foreign roles and runner forbids authoritative-empty cleanup', async () => {
  const {createCatalogScraper, getScraperCatalog} = await import('../../scraper-support/providers/index.js')
  const {buildScraperAttemptDiagnostics, isAuthoritativeEmptyScrape, resolveZeroJobOutcome} = await import('../../scraper-support/runner.js')
  const provider = getScraperCatalog().find(value => value.source === 'snowplow')
  const scraper = createCatalogScraper(provider)
  const result = await run(() => {}, scraper)
  assert.ifError(result.error)
  assert.equal(result.jobs.length, 0)
  assert.equal(result.evidence.status, 'complete-inventory')
  assert.equal(result.evidence.reportedTotal, 12)
  assert.equal(result.evidence.indiaFacetCount, 0)
  assert.equal(buildScraperAttemptDiagnostics(result.jobs, undefined, provider).rawRecords, 12)
  assert.equal(resolveZeroJobOutcome(scraper, result.jobs, result.jobs), 'fetched-zero')
  assert.equal(isAuthoritativeEmptyScrape(scraper, result.jobs), false)
})

for (const [name, change] of [
  ['posting location India alternative', data => data.jobAdDetails[0].postingLocations.push({sourceType: 'country', country: 'India', displayValue: 'India'})],
  ['unknown country', data => data.jobAdDetails[0].country = 'Worldwide'],
  ['India alternative in complete description', data => data.jobAdDetails[0].description += '<p>Alternatively based in Bengaluru, India.</p>'],
  ['unreviewed geographic filters', data => data.filterGroups.cities.push({serverId: 'Bengaluru', value: 'Bengaluru'})],
  ['new native mandatory criteria', data => data.jobOpeningMetadata[0].mandatoryResidence = 'India'],
  ['missing role referenced by corporate inventory', data => data.jobAdDetails.pop()],
  ['unknown envelope pagination', data => data.nextPage = 'page2'],
]) test(name + ' cannot qualify current checked-source zero', async () => {
  const result = await run((response, url) => { if (url === feed) edit(response, change) })
  partial(result)
})

test('current native application alternate locations are retained and cannot certify zero', async () => {
  const result = await run((response, url) => {
    if (url.endsWith('/application-form')) edit(response, data => data.data.jobAd.postingLocations.push({displayValue: 'India'}))
  })
  partial(result)
  assert.ok(result.audit, 'Current application proof must retain an audit')
  assert.ok(result.audit.receipts.some(r => r.url.endsWith('/application-form') && JSON.parse(r.response.body).data.jobAd.postingLocations[0]?.displayValue === 'India'))
})

test('current nested mandatory application criteria cannot be ignored', async () => {
  const result = await run((response, url) => {
    if (url.endsWith('/application-form')) edit(response, data => data.data.jobAd.applicationForm['/applicationForm/questions'].value.push({isMandatory: true, text: 'Residence in India required'}))
  })
  partial(result)
})

test('late current row criteria drift cannot certify zero after opening proofs', async () => {
  const result = await run((response, url, calls) => {
    if (url === feed && calls.filter(c => c.url === feed).length === 2) edit(response, data => data.jobAdDetails[0].description += '<p>New qualification.</p>')
  })
  partial(result)
  assert.ok(result.audit, 'Closing comparison must retain opening and closing audit')
  assert.match(result.audit.gaps.join(';'), /closing cohort\/criteria changed/)
})

test('current declared native program drift remains incomplete', async () => {
  const result = await run((response, url) => { if (/\/6825\./.test(url)) response.body += ';/* drift */' })
  partial(result)
})

test('current hidden corporate hiring scope remains a coverage gap', async () => {
  const result = await run((response, url) => {
    if (url === corporate) response.body = response.body.replace('</body>', '<template><a href="https://jobs.lever.co/another">Jobs</a></template></body>')
  })
  partial(result)
})
