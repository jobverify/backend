import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { createPurplleScraper } from './script.js'

test('Purplle resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPurplle\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'purplle')
})

const capture = JSON.parse(readFileSync(new URL('./fixtures/official-careers.json', import.meta.url)))
const discovery = JSON.parse(readFileSync(new URL('./fixtures/linkedin-discovery.json', import.meta.url)))
const details = JSON.parse(readFileSync(new URL('./fixtures/linkedin-native-details.json', import.meta.url)))
const capturedResponse=(body,status,url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r}
const fixtureFetch = async url => {
  const key = value => new URL(value).pathname.replace(/\/$/, '')
  const item = [capture, ...details, ...discovery].find(item => key(item.url) === key(url))
  assert.ok(item, `uncaptured URL ${url}`)
  return capturedResponse(item.body,item.status,item.finalUrl)
}

test('Purplle comments contain three historical roles and none are emitted as current jobs', async () => {
  const jobs = await createPurplleScraper({ fetchImpl: fixtureFetch }).run()
  assert.deepEqual(jobs.map(job => job.jobId), ['4480815433', '4479287979', '4479503345', '4448025772', '4474047271', '4405646318', '4474129089', '4474113514', '4441617213'])
  assert.equal(jobs.filter(job=>job.country==='India').length,6)
  assert.equal(jobs.filter(job=>job.country===null).length,3)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.ok(jobs.every(job => job.sourceDescription?.length > 100 && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.activeApplyVerified === true && job.closingDate === null))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Purplle stops at HTTP429 without emitting unvisited cards', async () => {
  const attempted = []
  const jobs = await createPurplleScraper({ fetchImpl: async url => {
    attempted.push(url)
    return fixtureFetch(url)
  } }).run()
  assert.equal(jobs.length, 9)
  assert.equal(attempted.filter(url => url.includes('/jobs/view/')).length, 10)
  assert.equal(jobs.find(job => job.jobId === '4474107749'), undefined)
  assert.match(readInventoryEvidence(jobs).reason, /429/)
})

test('Purplle refuses a changed corporate email or outgoing employer identity', async () => {
  for (const html of [capture.body.replaceAll('career@purplle.com', 'career@other.com'), capture.body.replaceAll('/company/2706205', '/company/123')]) {
    await assert.rejects(createPurplleScraper({ fetchImpl: async url => capturedResponse(html,200,url) }).run(), { code: 'PURPLLE_COVERAGE_GAP' })
  }
})

test('Purplle bounds uncooperative fetch and response body by the aggregate deadline', async () => {
  for (const fetchImpl of [async () => new Promise(() => {}), async url => capturedResponse(new ReadableStream({pull(){return new Promise(()=>{})}}),200,url)]) {
    await assert.rejects(createPurplleScraper({ fetchImpl, timeoutMs: 15 }).run(), { code: 'PURPLLE_COVERAGE_GAP' })
  }
})

test('Purplle propagates exact caller abort through an uncooperative body read', async () => {
  const controller = new AbortController(), reason = new Error('stop-purplle')
  await assert.rejects(createPurplleScraper({ fetchImpl: async url => capturedResponse(new ReadableStream({pull(){controller.abort(reason);return new Promise(()=>{})}}),200,url) }).run({ signal: controller.signal }), error => error === reason)
})

test('Purplle rejects newly introduced structured role scope or expiry until reconciled', async () => {
  await assert.rejects(createPurplleScraper({ fetchImpl: async url => {
    const response = await fixtureFetch(url)
    const html = await response.text()
    return capturedResponse(url.includes('4480815433') ? html.replace('</head>', '<script type="application/ld+json">{"@type":"JobPosting","validThrough":"2020-01-01","jobLocation":{"address":{"addressCountry":"US"}}}</script></head>') : html,response.status,response.url)
  } }).run(), { code: 'PURPLLE_COVERAGE_GAP' })
})

test('Purplle requires exact response URL before trusting body identity', async () => {
  await assert.rejects(createPurplleScraper({ fetchImpl: async url => {const r=await fixtureFetch(url);return capturedResponse(await r.text(),r.status,undefined)} }).run(), { code: 'PURPLLE_COVERAGE_GAP' })
})

test('Purplle cancels oversized streamed native bodies before reading remaining chunks', async () => {
  let cancelled = false
  await assert.rejects(createPurplleScraper({ fetchImpl: async url => capturedResponse(new ReadableStream({pull(c){c.enqueue(new Uint8Array(3000001))},cancel(){cancelled=true}}),200,url) }).run(), { code: 'PURPLLE_COVERAGE_GAP' })
  assert.equal(cancelled, true)
})

test('Purplle hidden native JD remains eligible with null description after active role verification', async () => {
  const jobs = await createPurplleScraper({ fetchImpl: async url => {
    const response = await fixtureFetch(url), html = await response.text()
    return capturedResponse(url.includes('4480815433')
      ? html.replace(/<div\b([^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*)>/, '<div hidden $1>') : html,response.status,response.url)
  } }).run()
  assert.equal(jobs.length, 9)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].activeApplyVerified, true)
})

test('Purplle raw gzip evidence matches receipt and response body SHA256 manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json', import.meta.url)))
  const sha = value => createHash('sha256').update(value).digest('hex')
  for (const item of manifest.evidence) {
    const compressed = readFileSync(new URL(`./fixtures/${item.file}`, import.meta.url)), receipt = gunzipSync(compressed)
    assert.equal(sha(compressed), item.sha256)
    assert.equal(sha(receipt), item.uncompressedSha256)
    const parsed = JSON.parse(receipt), responses = Array.isArray(parsed) ? parsed : [parsed]
    assert.deepEqual(responses.map(response => sha(response.body)), item.observations.map(observation => observation.bodySha256))
  }
})
