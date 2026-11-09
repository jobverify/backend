import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import * as bmc from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'

const root=new URL('./fixtures/',import.meta.url)
const proof=JSON.parse(readFileSync(new URL('provenance.json',root),'utf8'))
const capturedNow=new Date(proof.capturedAt)
const eligibleNativeIds=['47634','47679','47686','47687']
const fixtures=new Map(proof.receipts.map(row=>{
  const body=readFileSync(new URL(row.fixture,root),'utf8')
  assert.equal(createHash('sha256').update(body).digest('hex'),row.bodySha256)
  return [row.requestedURL,{...row,body}]
}))
const replay=async({change=(_file,body)=>body,failAt,options={}}={})=>{
  const requested=[]
  const jobs=await bmc.run({now:capturedNow,...options,fetchText:async(url,{signal}={})=>{
    signal?.throwIfAborted();requested.push(url)
    const fixture=fixtures.get(url)
    assert.ok(fixture,'unexpected or invented native URL '+url)
    if(fixture.fixture===failAt)throw Error('native HTTP503')
    return change(fixture.fixture,fixture.body)
  }})
  return {jobs,requested}
}

test('captured exact native five-page India snapshot retains25 roles while publication policy admits the four recent roles',async()=>{
  const {jobs,requested}=await replay()
  assert.equal(jobs.length,25)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,25)
  assert.equal(requested.length,31)
  assert.ok(jobs.every(job=>job.source==='bmcsoftware'&&job.country==='India'&&job.sourceDetailComplete===true))
  assert.ok(jobs.every(job=>job.applyUrl===`https://jobs.bmc.com/Careers/ApplicationMethods?jobId=${job.jobId}`))
  const publication=analyzePublishableJobs(jobs,{now:capturedNow})
  assert.deepEqual(publication.eligibleJobs.map(job=>job.jobId).sort(),eligibleNativeIds)
  assert.equal(publication.filterCounts.old,21)
  assert.equal(publication.filterCounts.emptyDescription,0)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'complete-inventory')
  assert.equal(evidence.reportedTotal,25)
  assert.equal(evidence.indiaFacetCount,25)
  assert.equal(evidence.pagesFetched,5)
  assert.equal(evidence.surface,bmc.INDIA_SEARCH_URL)
})

test('public display title and original older native date remain distinct from internal grade name',async()=>{
  const {jobs}=await replay()
  assert.equal(jobs.length,25)
  const job=jobs.find(job=>job.jobId==='47129')
  assert.equal(job.title,'Lead DevOps Engineer')
  assert.equal(job.sourceNativeJobName,'Lead DevOps Engineer - India')
  assert.equal(job.postingDate,'2026-06-18T00:00:00.000Z')
  assert.equal(job.closingDate,null)
  assert.ok(job.jobDescription.length>3000)
  assert.match(job.jobDescription,/Site Reliability|SRE/i)
})

test('missing or inert-only corporate India handoff fails before native enumeration',async()=>{
  await assert.rejects(replay({change:(file,body)=>file==='corporate-careers-http.html'
    ?body.replaceAll('1274=9406','1274=9999')+'<!-- <a href="'+bmc.INDIA_SEARCH_URL+'">India</a> -->':body}),/official|handoff|India/i)
})

test('native page overlap, count drift, missing continuation and changed filter cannot certify inventory',async()=>{
  for(const change of [
    (file,body)=>file==='india-listing-http-0002.html'?body.replaceAll('/47487','/47129').replaceAll('jobId=47487','jobId=47129'):body,
    (file,body)=>file==='india-listing-http-0002.html'?body.replace(/of\s+25(\s+results)/g,'of 26$1'):body,
    (file,body)=>file==='india-listing-http-0001.html'?body.replaceAll('jobOffset=6','jobOffset=12'):body,
    (file,body)=>file==='india-listing-http-0001.html'?body.replaceAll('1274=9406','1274=9999'):body,
  ]) await assert.rejects(replay({change}),/inventory|pagination|scope|range|identity|duplicate|count/i)
})

test('a page cap preserves useful observed jobs with explicitly incomplete inventory',async()=>{
  const {jobs}=await replay({options:{maxPages:1}})
  assert.equal(jobs.length,6)
  assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.sourceDetailComplete===true))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,25)
})

test('failed native role transport preserves enumeration and marks detail and lifecycle evidence incomplete',async()=>{
  const {jobs}=await replay({failAt:'role-47129-http.html'})
  assert.equal(jobs.length,25)
  const failed=jobs.find(job=>job.jobId==='47129')
  assert.equal(failed.sourceDetailComplete,false)
  assert.equal(failed.sourceDetailFailureKind,'upstream')
  assert.equal(failed.jobDescription,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.ok(jobs.every(job=>job.sourceListingComplete===false))
  const publication=analyzePublishableJobs(jobs,{now:capturedNow})
  assert.deepEqual(publication.eligibleJobs.map(job=>job.jobId).sort(),eligibleNativeIds)
  assert.equal(publication.filterCounts.old,21)
  // Missing descriptions remain inventory observations for later enrichment.
  assert.equal(publication.filterCounts.emptyDescription,0)
})

test('native detail country, title, JobID, canonical and application conflicts remain ineligible',async()=>{
  for(const alter of [
    body=>body.replace(/(>\s*Country\s*<\/div>[\s\S]*?field__value"[^>]*>\s*)India\b/,'$1United States'),
    body=>body.replace(/(<h2\b[^>]*banner__text__title[^>]*>\s*)Lead DevOps Engineer/,'$1Unrelated Role'),
    body=>body.replace(/(>\s*Job ID\s*<\/div>[\s\S]*?field__value"[^>]*>\s*)47129\b/,'$199999'),
    body=>body.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]+/, '$1https://unrelated.example/job/47129'),
    body=>body.replaceAll('ApplicationMethods?jobId=47129','ApplicationMethods?jobId=99999'),
  ]){
    const original=fixtures.get('https://jobs.bmc.com/Careers/JobDetail/Lead-DevOps-Engineer-India/47129').body
    assert.notEqual(alter(original),original)
    const {jobs}=await replay({change:(file,body)=>file==='role-47129-http.html'?alter(body):body})
    assert.equal(jobs.length,25)
    const rejected=jobs.find(job=>job.jobId==='47129')
    assert.equal(rejected.sourceDetailComplete,false)
    assert.equal(rejected.sourceDetailFailureKind,'identity-mismatch')
    assert.equal(rejected.jobDescription,null)
  }
})

test('inert or script-only role content does not become a full description',async()=>{
  const {jobs}=await replay({change:(file,body)=>file==='role-47129-http.html'
    ?body.replace(/<details\b[^>]*\bdetailDescription\b[^>]*>[\s\S]*?<\/details>/,
      '<details class="detailDescription"><h3 id="section1__title">Description and Requirements</h3><div id="section1__content"><div class="article__content__view__field --rich-text"><div class="article__content__view__field__value"><script>console.log("not JD")</script><template><p>Invented role content</p></template></div></div></div></details>'):body})
  assert.equal(jobs.length,25)
  const job=jobs.find(job=>job.jobId==='47129')
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailFailureKind,'missing-content')
  assert.equal(job.jobDescription,null)
})

test('caller abort stays authoritative even when injected transport returns native data',async()=>{
  const controller=new AbortController();controller.abort(new Error('caller cancelled'))
  await assert.rejects(replay({options:{signal:controller.signal}}),/caller cancelled/)
})

const reviewedNow=new Date('2026-10-20T22:12:21.958Z')
test('matching future native listing and detail publication dates cannot certify current jobs',async()=>{
  await assert.rejects(replay({options:{now:reviewedNow},change:(file,body)=>{
    if(file==='india-listing-http-0001.html')return body.replaceAll('Posted 18-Jun-2026','Posted 21-Oct-2026')
    if(file==='role-47129-http.html')return body.replaceAll('18-Jun-2026','21-Oct-2026')
    return body
  }}),/future/i)
})

test('direct native detail validation also rejects a future date against its injected check time',()=>{
  const listing=bmc.parseListing(fixtures.get(bmc.INDIA_SEARCH_URL).body).jobs.find(job=>job.jobId==='47129')
  const future={...listing,postingDate:'2026-10-21T00:00:00.000Z'}
  const detail=fixtures.get(listing.sourceUrl).body.replaceAll('18-Jun-2026','21-Oct-2026')
  assert.throws(()=>bmc.parseDetail(detail,future,{now:reviewedNow}),/future/i)
})

for(const [status,target] of [[202,'corporate-careers-http.html'],[206,'india-listing-http-0001.html']]){
  test(`default transport rejects HTTP${status} before parsing native inventory`,async t=>{
    let calls=0
    t.mock.method(globalThis,'fetch',async url=>{
      calls++;const fixture=fixtures.get(url);assert.ok(fixture)
      const response=new Response(fixture.body,{status:fixture.fixture===target?status:200})
      Object.defineProperty(response,'url',{value:url});return response
    })
    await assert.rejects(bmc.run({now:reviewedNow}),new RegExp('HTTP '+status))
    assert.equal(calls,status===202?1:2)
  })
}

test('default transport treats a partial-content native role as upstream failure without losing inventory',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{
    const fixture=fixtures.get(url);assert.ok(fixture)
    const response=new Response(fixture.body,{status:fixture.fixture==='role-47129-http.html'?206:200})
    Object.defineProperty(response,'url',{value:url});return response
  })
  const jobs=await bmc.run({now:reviewedNow})
  assert.equal(jobs.length,25)
  const failed=jobs.find(job=>job.jobId==='47129')
  assert.equal(failed.sourceDetailComplete,false)
  assert.equal(failed.sourceDetailFailureKind,'upstream')
  assert.equal(failed.jobDescription,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})
