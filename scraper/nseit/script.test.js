import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { run } from './script.js'

test('NSEIT upstream failures cannot become a successful zero inventory', async () => {
  const failure = new Error('upstream unavailable')
  await assert.rejects(run({ fetchImpl: async () => { throw failure } }), error => error === failure)
})

test('NSEIT aggregate deadline bounds an uncooperative fetch and preserves abort reason', async () => {
  await assert.rejects(run({ fetchImpl: () => new Promise(() => {}), timeoutMs: 15 }), /NSEIT aggregate deadline exceeded/)
})

test('NSEIT caller abort is preserved even during an uncooperative response body', async () => {
  const controller = new AbortController(), reason = new Error('cancelled by caller')
  const pending = run({ signal: controller.signal, fetchImpl: async () => ({ ok: true, status: 200, url: 'https://www.dexitglobal.com/careers/', text: () => new Promise(() => {}) }), timeoutMs: 1000 })
  setTimeout(() => controller.abort(reason), 10)
  await assert.rejects(pending, error => error === reason)
})

test('importing NSEIT with dry-run argument has no fetch or persistence side effects', () => {
 const child = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('import fetched')};await import('./scraper/nseit/script.js')`], { encoding: 'utf8' })
 assert.equal(child.status, 0, child.stderr)
})
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/official-responses.json.gz', import.meta.url))))
const setup = (change = value => value) => {
 const calls = []
 const fetchImpl = async url => {
  calls.push(url)
  const capture = captures.find(c => c.url === url)
  assert.ok(capture, 'unexpected request ' + url)
  return { status: capture.status, ok: capture.status === 200, url: capture.finalUrl || url, text: async () => change(capture.body, url) }
 }
 return { fetchImpl, calls, now: () => '2026-10-23T05:00:00.000Z' }
}
test('native DEXIT successor city-only role preserves country gap with no invented India count', async () => {
 const options = setup(), jobs = await run(options)
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].country, null)
 assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
 assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
 assert.equal(readInventoryEvidence(jobs).listingComplete, false)
 assert.match(readInventoryEvidence(jobs).reason, /native-country-unresolved/)
 assert.equal(jobs.nativeCollectionEvidence.listingRecords.length, 1)
 const fact = jobs.nativeCollectionEvidence.details[0]
 assert.equal(fact.id, '35855')
 assert.equal(fact.nativePublicationDate, '2025-09-02T20:32:29+05:30')
 assert.equal(fact.legalEmployer, 'DEXIT Global Limited')
 assert.match(fact.sourceDescription, /Provide Prompt/)
 assert.equal(options.calls.length, 3)
})
test('native explicit India addresses can publish full JD and retain public posting date', async () => {
 const options = setup((body, url) => url.includes('/currentopenings/') ? body.replace('"address":"Mumbai"', '"address":{"addressLocality":"Mumbai","addressCountry":"IN"}') : body)
 const jobs = await run(options)
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].country, 'India')
 assert.equal(jobs[0].postingDate, '2025-09-02T20:32:29+05:30')
 assert.equal(jobs[0].sourceScopeComplete, false)
 assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
test('hidden and inert detail descriptions never become eligible source content', async () => {
 for (const attrs of ['hidden', 'inert', 'style="content-visibility:hidden"']) {
  const jobs = await run(setup((body, url) => url.includes('/currentopenings/') ? body.replace('<div class="awsm-job-entry-content entry-content">', '<div ' + attrs + ' class="awsm-job-entry-content entry-content">') : body))
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.details[0].sourceDescription, null)
  assert.equal(jobs.nativeCollectionEvidence.details[0].sourceDetailComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /native-description-missing/)
 }
})
test('NSEIT rejects successor identity drift and redirected foreign job pages', async () => {
 await assert.rejects(run(setup(body => body.replaceAll('Formerly known as NSEIT Limited', 'formerly another company'))), /successor identity/)
 const options = setup(), fetcher = options.fetchImpl
 options.fetchImpl = async url => ({ ...await fetcher(url), url: 'https://example.com/careers/' })
 await assert.rejects(run(options), /native redirect/)
})
test('NSEIT follows next native inventory page and preserves unknown secondary country scope', async () => {
 const options = setup(), base = options.fetchImpl
 options.fetchImpl = async url => {
  if (url === 'https://www.dexitglobal.com/careers/page/2/') return { status:200, url, text:async()=> captures.find(c=>c.url.endsWith('/careers/')).body.replaceAll('35855','35856') }
  const response = await base(url)
  if (url.endsWith('/careers/')) { const body = await response.text(); response.text = async()=>body.replace('</div><!-- #content -->', '<a class="next page-numbers" href="https://www.dexitglobal.com/careers/page/2/">Next</a></div><!-- #content -->') }
  return response
 }
 const jobs = await run(options)
 assert.equal(jobs.nativeCollectionEvidence.listingRecords.length, 2)
 assert.equal(jobs.nativeCollectionEvidence.pagesFetched, 2)
})
test('NSEIT contradictory explicit country and state never publish', async () => {
 await assert.rejects(run(setup((body,url)=>url.includes('/currentopenings/') ? body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressRegion":"California","addressCountry":"IN"}') : body)), /country\/state conflict/)
})
test('heading-only native description retains an incomplete discovery fact', async () => {
 const jobs = await run(setup((body,url)=>url.includes('/currentopenings/') ? body.replace(/<div class="awsm-job-entry-content entry-content">[\s\S]*?<\/div><!-- \.awsm-job-entry-content -->/, '<div class="awsm-job-entry-content entry-content"><h2>Helpdesk Executive</h2><p><strong>Job Profile: '+ 'Responsibilities '.repeat(10) +'</strong></p></div>') : body))
 assert.equal(jobs.length,1)
 assert.equal(jobs.nativeCollectionEvidence.details[0].sourceDescription,null)
})
test('NSEIT visible location drift stops publication rather than trusting unrelated schema', async () => {
 await assert.rejects(run(setup((body,url)=>url.includes('/currentopenings/') ? body.replaceAll('Mumbai', 'Toronto, Canada') : body)), /visible location conflict/)
})
test('NSEIT date-only closing window includes the entire public closing day', async () => {
 const jobs = await run(setup((body,url)=>url.includes('/currentopenings/') ? body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressCountry":"IN"}').replace('"datePosted":','"validThrough":"2026-10-23","datePosted":') : body))
 assert.equal(jobs.length,1)
})



test('NSEIT explicit India roles with missing active descriptions remain partial eligible records', async () => {
 for (const attrs of ['hidden', 'inert', 'style="content-visibility:hidden"']) {
  const jobs = await run(setup((body,url)=>url.includes('/currentopenings/') ? body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressCountry":"IN"}').replace('<div class="awsm-job-entry-content entry-content">','<div '+attrs+' class="awsm-job-entry-content entry-content">') : body))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDescription,null)
  assert.equal(jobs[0].jobDescription,null)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceDetailStatus,'missing-description')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 }
})
test('NSEIT rejects invalid finite transport budgets before starting a request', async () => {
 for (const timeoutMs of [0,-1,Infinity,NaN,'1000',2147483648]) {
  let requests=0
  await assert.rejects(run({timeoutMs,fetchImpl:async()=>{requests++;throw Error('fetch started')}}),/invalid timeoutMs/)
  assert.equal(requests,0)
 }
})
test('NSEIT requests manual redirect handling and rejects redirect status before reading body', async () => {
 let reads=0, calls=0
 await assert.rejects(run({fetchImpl:async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return {status:302,url,text:async()=>{reads++;return ''}}}}),/native HTTP 302/)
 assert.equal(calls,1)
 assert.equal(reads,0)
})
test('NSEIT streaming body limit cancels the oversized response before parsing or further requests', async () => {
 let requests=0,cancelled=0,reads=0
 const body={getReader:()=>({read:async()=>{reads++;return {done:false,value:new Uint8Array(12)}},cancel:async()=>{cancelled++},releaseLock(){}})}
 await assert.rejects(run({maxResponseBytes:10,fetchImpl:async url=>{requests++;return {status:200,url,body}}}),/native response exceeds byte limit/)
 assert.equal(requests,1)
 assert.equal(reads,1)
 assert.equal(cancelled,1)
})
test('NSEIT aggregate body budget counts all fetched documents', async () => {
 const options=setup()
 options.maxTotalBytes=700000
 await assert.rejects(run(options),/native aggregate body exceeds byte limit/)
 assert.equal(options.calls.length,2)
})
test('NSEIT marks date-only closing dates as inexact for persistence day-end handling', async () => {
 for (const [closing,exact] of [['2026-10-23',false],['2026-10-23T20:00:00+05:30',true]]) {
  const jobs=await run(setup((body,url)=>url.includes('/currentopenings/') ? body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressCountry":"IN"}').replace('"datePosted":','"validThrough":'+JSON.stringify(closing)+',"datePosted":') : body))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceClosingDateIsExact,exact)
 }
})
