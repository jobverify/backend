import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as clari from '../../scraper/clari5/script.js'
import * as cbnits from '../../scraper/cbnits/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/clari5Cbnits20261106/capture.json.gz',import.meta.url))))
const descriptionExpectations=JSON.parse(fs.readFileSync(new URL('./fixtures/clari5Cbnits20261106/description-expectations.json',import.meta.url),'utf8')).documents
const get=url=>{assert.ok(fixture.documents[url], 'Only genuine captured URLs may be replayed: '+url);return fixture.documents[url].html}
const archive=get(clari.CAREERS_URL),listings=clari.extractArchiveListings(archive)
const first=listings[0],detail=get(first.sourceUrl)
const replaceForm=(html,transform)=>html.replace(/<form\b[^>]*\bid="sjb-application-form"[\s\S]*?<\/form>/i,transform)
const comparableContent=value=>value.replace(/\s/g,'').replace(/[–—]/g,'-')

test('Clari5 accepts the seven genuine current detail pages with their actual visible role titles and full criteria',()=>{
 assert.equal(listings.length,7)
 for(const listing of listings){
  const job=clari.extractJobDetail(get(listing.sourceUrl),listing)
  assert.equal(job.jobId,listing.jobId)
  assert.equal(job.title.replace(/[–—]/g,'-'),listing.title)
  assert.equal(job.country,'India')
  assert.equal(job.sourceUrl,listing.sourceUrl)
  assert.equal(comparableContent(job.jobDescription),comparableContent(descriptionExpectations[listing.sourceUrl].completeDescriptionWithoutWhitespace))
  assert.doesNotMatch(job.title,/Job \| Clari5 Careers/)
 }
})
test('Clari5 current full source replay follows exactly the current seven archive links and remains incomplete',async()=>{
 const requested=[]
 const jobs=await clari.run({fetchText:async url=>{requested.push(url);return get(url)},now:()=> '2026-11-06T08:45:00.000Z'})
 assert.equal(jobs.length,7)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,7)
 assert.deepEqual(requested,[clari.HOMEPAGE_URL,clari.CAREERS_URL,...listings.map(row=>row.sourceUrl)])
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.verifiedAt,null)
 for(const job of jobs) assert.equal(job.lifecycleCleanupAllowed,false)
})
test('Clari5 rejects a canonical URL belonging to another role',()=>{
 const changed=detail.replace('<link rel="canonical" href="'+first.sourceUrl+'"','<link rel="canonical" href="'+listings[1].sourceUrl+'"')
 assert.throws(()=>clari.extractJobDetail(changed,first),/Clari5.*detail|Clari5.*identity/i)
})
test('Clari5 binds the form job ID to the archive role instead of silently returning another vacancy',()=>{
 const changed=replaceForm(detail,form=>form.replace('name="job_id" value="'+first.jobId+'"','name="job_id" value="'+listings[1].jobId+'"'))
 assert.notEqual(changed,detail)
 assert.throws(()=>clari.extractJobDetail(changed,first),/Clari5.*detail|Clari5.*identity/i)
})
test('Clari5 cannot qualify a hidden application form',()=>{
 const changed=replaceForm(detail,form=>form.replace('<form ','<form style="display:none" '))
 assert.throws(()=>clari.extractJobDetail(changed,first),/Clari5.*detail|Clari5.*identity/i)
})
test('Clari5 cannot qualify an application form inside a template',()=>{
 const changed=replaceForm(detail,form=>'<template>'+form+'</template>')
 assert.throws(()=>clari.extractJobDetail(changed,first),/Clari5.*detail|Clari5.*identity/i)
})
test('Clari5 requires genuine visible description content after accepting a changed title',()=>{
 const changed=detail.replace('<div class="job-description">','<div class="job-description" hidden>')
 assert.throws(()=>clari.extractJobDetail(changed,first),/Clari5.*description|Clari5.*detail/i)
})
test('CBNITS generic introductory job-openings copy is not a published vacancy',()=>{
 assert.equal(cbnits.hasServerRenderedJobsSignal(get(cbnits.CAREERS_URL)),false)
})
test('CBNITS current original route and declared chunk yield discovery with unknown inventory, without the legacy API',async()=>{
 const requested=[]
 const jobs=await cbnits.run({fetchText:async url=>{requested.push(url);return get(url)}})
 assert.deepEqual(jobs,[])
 assert.deepEqual(requested,[cbnits.CAREERS_URL,cbnits.extractBundleUrl(get(cbnits.CAREERS_URL))])
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'discovery-only')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
})
test('CBNITS still detects a real active job detail or application link',()=>{
 assert.equal(cbnits.hasServerRenderedJobsSignal('<h2>Current Openings</h2><a href="/career/software-engineer">Software Engineer</a>'),true)
 assert.equal(cbnits.hasServerRenderedJobsSignal('<a href="/apply">Apply Now</a>'),true)
})
test('CBNITS still detects an actual structured JobPosting record',()=>{
 assert.equal(cbnits.hasServerRenderedJobsSignal('<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Engineer"}</script>'),true)
})
test('CBNITS ignores inert and script-string copies of vacancy markup',()=>{
 const inert='<a href="/career/software-engineer">Apply Now</a>'
 assert.equal(cbnits.hasServerRenderedJobsSignal('<template>'+inert+'</template><script>const old='+JSON.stringify(inert)+'</script>'),false)
})
