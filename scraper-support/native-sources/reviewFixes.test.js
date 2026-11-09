import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runCloudMoyo } from '../../scraper/cloudmoyo/nativeCareers.js'
import { runRgbsi } from '../../scraper/rgbsi/nativeCareers.js'
import { countryName } from './jobPostingData.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../utils/indiaLocationFilter.js'
import { CLOUDMOYO_CATALOG } from '../../scraper/cloudmoyo/catalog.js'

globalThis.fetch = async () => { throw Error('Offline regression test prohibits HTTP') }
const fixtures = Object.fromEntries(['cloudmoyo', 'rgbsi'].map(source => [source,
  JSON.parse(gunzipSync(readFileSync(new URL(`../../scraper/${source}/fixtures/actual-http-20261031.json.gz`, import.meta.url))))]))
const resourceURL = value => { const url = new URL(value);url.hash = '';return url.href }
const apiIndex = page => new URL(page.url).hostname === 'api.smartrecruiters.com'
  && /^\/v1\/companies\/[^/]+\/postings$/.test(new URL(page.url).pathname)
const execute = async (source, mutate = page => page) => {
  const queues = new Map(), requests = [], seen = new Map(), missing = [], replayedDetails = []
  for (const row of fixtures[source].responses.filter(row => source !== 'rgbsi' || row.purpose !== 'declared-native-board')) {
    const key = resourceURL(row.url)
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  let audit
  const jobs = await (source === 'cloudmoyo' ? runCloudMoyo : runRgbsi)({
    now: () => '2026-10-31T00:00:00.000Z',
    fetchPage: async url => {
      requests.push(url)
      let row = queues.get(resourceURL(url))?.shift()
      // Same-ID refresh controls reuse the genuine detail bytes solely for an
      // offline cache regression. They are not distinct live closing evidence.
      if (!row && new URL(url).hostname === 'api.smartrecruiters.com'
        && /\/postings\/\d+$/.test(new URL(url).pathname)) {
        row = fixtures.rgbsi.responses.find(item => resourceURL(item.url) === resourceURL(url))
        if (row) replayedDetails.push(url)
      }
      if (!row) { missing.push(url);throw Error('No archived test response for ' + url) }
      const count = (seen.get(url) || 0) + 1;seen.set(url, count)
      const bytes = Buffer.from(row.bodyBase64, 'base64'), text = bytes.toString('utf8')
      const original = Buffer.from(text).equals(bytes) ? text : null
      const page = mutate({ html: original, bodyBase64: row.bodyBase64, status: row.status,
        url: row.finalURL, headers: structuredClone(row.responseHeaders), count })
      if (page.html !== original && typeof page.html === 'string') page.bodyBase64 = Buffer.from(page.html).toString('base64')
      return page
    }, onAudit: value => { audit = value }
  })
  assert.deepEqual(missing, [])
  return { jobs, audit, requests, replayedDetails }
}

test('R1 artificial canonical conflicts cannot qualify origin, credentials, port, protocol or a non-role route', async () => {
  for (const canonical of ['https://unrelated.example/jobs/other-4481007123',
    'http://www.linkedin.com/jobs/view/other-at-cloudmoyo-4481007123',
    'https://user@www.linkedin.com/jobs/view/other-at-cloudmoyo-4481007123',
    'https://www.linkedin.com:444/jobs/view/other-at-cloudmoyo-4481007123',
    'https://www.linkedin.com/company/other-4481007123',
    'https://www.linkedin.com/jobs/view/other-at-unrelated-4481007123']) {
    let changed = 0
    const { audit } = await execute('cloudmoyo', page => {
      if (new URL(page.url).pathname.endsWith('-4481007123')) page.html = page.html.replace(
        /(<link\b[^>]*rel="canonical"[^>]*href=")[^"]+("[^>]*>)/i,
        (_, start, end) => { changed++;return start + canonical + end })
      return page
    })
    assert.equal(changed, 1)
    const bad = audit.observations.find(job => job.sourceNativeJobPosting?.jobLocation?.address?.addressLocality === 'Dallas-Fort Worth Metroplex')
      || audit.observations.find(job => !job.sourceNativeRoleDetail.bound)
    assert.ok(bad)
    assert.equal(bad.sourceNativeRoleDetail.bound, false, canonical)
    assert.notEqual(bad.applyUrl, canonical)
    assert.equal(bad.country, null)
    assert.ok(audit.rawPages.some(page => page.originalText?.includes(canonical)))
    assert.equal(audit.observations.filter(job => job.sourceNativeRoleDetail.bound).length, 1)
  }
})

test('R2 artificial ZZ retains raw country, unresolved discovery and conservative public filtering', async () => {
  const { audit, jobs } = await execute('cloudmoyo', page => {
    if (new URL(page.url).pathname.endsWith('-4481007123')) page.html = page.html.replace('"addressCountry":"US"', '"addressCountry":"ZZ"')
    return page
  })
  const job = audit.observations.find(job => job.jobId === '4481007123')
  assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, 'ZZ')
  assert.equal(job.country, null)
  assert.equal(job.location, null)
  assert.deepEqual(job.locations, [])
  assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.ok(jobs.some(item => item.jobId === job.jobId))
  assert.equal(isIndiaJob(normalizeScrapedJob(job, CLOUDMOYO_CATALOG)), false)
})

test('R2 only explicit supported country and territory codes or names become country authority', () => {
  for (const input of ['ZZ', 'XA', 'XB', 'EU', 'EZ', 'UN', 'QO', 'AC', 'IC', 'UK', 'Unknown Region', 'Europe', '001', 'ZZZ']) {
    assert.equal(countryName(input), null, input)
  }
  for (const [input, expected] of [['IN', 'India'], ['United Kingdom', 'United Kingdom'], ['GB', 'United Kingdom'],
    ['DE', 'Germany'], ['Germany', 'Germany'], ['JP', 'Japan'], ['AU', 'Australia'], ['PR', 'Puerto Rico'],
    ['TW', 'Taiwan'], ['us', 'United States'], ['Canada', 'Canada']]) assert.equal(countryName(input), expected, input)
})

for (const source of ['cloudmoyo', 'rgbsi']) {
  test(`R3 ${source}: a genuine closing-only legacy positive receives criteria recovery`, async () => {
    let id
    const genuine = JSON.parse(Buffer.from(fixtures.rgbsi.responses.find(row => new URL(row.url).hostname === 'api.smartrecruiters.com'
      && new URL(row.url).pathname === '/v1/companies/RGBSI/postings').bodyBase64, 'base64').toString('utf8')).content[0]
    const { audit, requests } = await execute(source, page => {
      if (apiIndex(page)) {
        const data = JSON.parse(page.html)
        if (source === 'rgbsi' && page.count === 1) { id = String(data.content[0].id);data.content.shift();data.totalFound-- }
        if (source === 'cloudmoyo' && page.count === 2) {
          const record = structuredClone(genuine);record.company.identifier = 'CloudMoyo';delete record.ref
          // Artificial legacy positive; original CloudMoyo zero is untouched in
          // the fixture. No invented native detail response is supplied.
          id = String(record.id);data.content = [record];data.totalFound = 1
        }
        page.html = JSON.stringify(data)
      }
      return page
    })
    const job = audit.observations.find(job => job.sourceNativePlatform === 'smartrecruiters' && job.jobId === id)
    assert.ok(job, 'Known closing positive was not inspected')
    if (source === 'rgbsi') { assert.ok(job.jobDescription);assert.ok(requests.includes(genuine.ref));assert.equal(audit.observations.length, 205) }
    else { assert.equal(job.jobDescription, null);assert.equal(audit.observations.length, 3) }
    assert.equal(audit.sourceScopeComplete, false)
    assert.equal(audit.lifecycleCleanupAllowed, false)
  })

  test(`R3 ${source}: changed same-ID closing legacy records replace stale fields and request fresh detail`, async () => {
    let id, ref
    const real = JSON.parse(Buffer.from(fixtures.rgbsi.responses.find(row => new URL(row.url).hostname === 'api.smartrecruiters.com'
      && new URL(row.url).pathname === '/v1/companies/RGBSI/postings').bodyBase64, 'base64').toString('utf8')).content[0]
    const { audit, requests, replayedDetails } = await execute(source, page => {
      if (apiIndex(page)) {
        const data = JSON.parse(page.html)
        if (source === 'cloudmoyo') {
          const record = structuredClone(real);record.company.identifier = 'CloudMoyo';delete record.ref
          data.content = [record];data.totalFound = 1
        }
        const row = data.content[0];id = String(row.id);ref = row.ref
        if (page.count === 1) row.location = { ...row.location, country: 'in', fullLocation: 'Artificial opening, India' }
        page.html = JSON.stringify(data)
      }
      return page
    })
    const job = audit.observations.find(job => job.sourceNativePlatform === 'smartrecruiters' && job.jobId === id)
    assert.ok(job)
    assert.equal(job.country, 'United States')
    assert.equal(job.sourceNativeAPIIndexRecord.location.country, 'us')
    assert.equal(audit.observations.filter(item => item.sourceNativePlatform === 'smartrecruiters' && item.jobId === id).length, 1)
    if (source === 'rgbsi') { assert.equal(requests.filter(url => url === ref).length, 2);assert.deepEqual(replayedDetails, [ref]);assert.ok(job.jobDescription) }
    assert.ok(audit.issues.some(issue => /legacy-native-opening-closing/.test(issue.kind)))
  })
}
