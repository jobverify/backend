import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const read = name => JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'))
const captures = [read('official-response.json'), read('published-careers-response.json'), ...read('native-details.json'),read('native-us-detail.json')]
const replay = (mutate = x => x) => async url => {
  const row = captures.find(r => r.url === url)
  assert.ok(row, `Uncaptured URL: ${url}`)
  const r = mutate({ ...row })
  return { status:r.status, url:r.finalUrl, text:async()=>r.body }
}
test('RoboMQ reads only exact native employer details from mixed official search', async()=>{
  const jobs=await run({fetchImpl:replay()})
  assert.equal(jobs.length,3)
  assert.deepEqual(jobs.map(j=>j.id),['4475545026','4474128262','4462733185'])
  assert.ok(jobs.every(j=>j.country==='India'&&j.city==='Jaipur'&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
  assert.ok(jobs.every(j=>j.sourceDescription.length>500))
  assert.equal(jobs[0].postingDate,'2026-10-08T07:05:33.000Z')
  assert.equal(jobs[2].postingDate,'2026-09-03T00:19:49.000Z')
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
})
test('RoboMQ never reports upstream failure as verified empty',async()=>{
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),{code:'ROBOMQ_COVERAGE_GAP'})
})
test('RoboMQ preserves exact caller abort even if transport ignores signals',async()=>{
  const c=new AbortController(),reason=Error('stop'); const task=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason)
  await assert.rejects(task,e=>e===reason)
})
test('RoboMQ bounded deadline includes a stalled body',async()=>{
  await assert.rejects(run({timeoutMs:20,fetchImpl:async url=>({status:200,url,text:()=>new Promise(()=>{})})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
const mutatePosting = change => replay(r=>{
  if(r.url.includes('/jobs/view/'))r.body=r.body.replace(/(<script[^>]+type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,body,end)=>{
    const p=JSON.parse(body);if(p['@type']!=='JobPosting')return all;change(p);return start+JSON.stringify(p)+end
  })
  return r
})
test('RoboMQ refuses a mismatched legal employer',async()=>{
  await assert.rejects(run({fetchImpl:mutatePosting(p=>{p.hiringOrganization.sameAs='https://www.linkedin.com/company/other'})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
test('RoboMQ retains missing descriptions without inventing prose',async()=>{
  const jobs=await run({fetchImpl:mutatePosting(p=>{p.description='&lt;strong&gt;Responsibilities&lt;/strong&gt;&lt;p hidden&gt;Build production services&lt;/p&gt;'})})
  assert.ok(jobs.every(j=>j.sourceDescription===null&&j.sourceDetailComplete===false))
})
test('RoboMQ preserves native exact expiry for existing eligibility filters',async()=>{
  const jobs=await run({fetchImpl:replay()})
  assert.equal(jobs[0].closingDate,'2026-11-07T07:05:33.000Z')
  assert.equal(jobs[0].sourceClosingDateIsExact,true)
})
test('RoboMQ refuses impossible calendar dates',async()=>{
  await assert.rejects(run({fetchImpl:mutatePosting(p=>{p.datePosted='2026-02-30T00:00:00.000Z'})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
test('RoboMQ excludes future publications without changing old source dates',async()=>{
  const jobs=await run({now:()=> '2026-10-23T05:30:00Z',fetchImpl:mutatePosting(p=>{p.datePosted='2027-10-08T07:05:33.000Z';p.validThrough='2027-11-08T07:05:33.000Z'})})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('RoboMQ rejects contradictory country and foreign region',async()=>{
  await assert.rejects(run({fetchImpl:mutatePosting(p=>{if(p.jobLocation.address.addressCountry==='IN')p.jobLocation.address.addressRegion='California'})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
test('RoboMQ rejects contradictory country labels in native locality',async()=>{
  await assert.rejects(run({fetchImpl:mutatePosting(p=>{if(p.jobLocation.address.addressCountry==='IN')p.jobLocation.address.addressLocality='Toronto, Canada'})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
