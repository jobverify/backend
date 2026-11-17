import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {API,SURFACE,extractJobs} from './native.js'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-11-16-native-packets.json.gz',import.meta.url))))
const original=url=>{
 const packet=fixture.requests.find(packet=>packet.url===url)
 assert.equal(packet.status,200)
 assert.equal(packet.finalURL,url)
 return Buffer.from(packet.body,packet.bodyEncoding).toString('utf8')
}
const payload=()=>JSON.parse(original(API))

test('Pragya current plain WordPress publication preserves two complete observed roles and unknown workplaces',async()=>{
 const jobs=await run({fetchJson:async url=>{assert.equal(url,API);return payload()},fetchText:async url=>{assert.equal(url,SURFACE);return original(url)}})
 assert.deepEqual(jobs.map(job=>job.title),['Product Engineer','Purchase Executive'])
 assert.ok(jobs.every(job=>job.jobId===null&&job.country===null&&job.location===null&&job.postingDate===null))
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.jobDescription.includes('Qualification:')&&job.jobDescription.includes('Experience:')&&job.jobDescription.includes('Roll:')))
 assert.ok(jobs.every(job=>!job.jobDescription.includes('Apply now')))
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('Pragya current published API criteria still require independent matching own article text',()=>{
 const html=original(SURFACE).replace('B. Sc. from an accredited university','Changed native qualification')
 assert.throws(()=>extractJobs(payload(),{html}),/published API\/rendered role identity or content contradiction/)
})

test('Pragya plain publication cannot bind a different WordPress page or ambiguous application boundary',()=>{
 assert.throws(()=>extractJobs(payload(),{html:original(SURFACE).replace('id="post-5056"','id="post-9999"')}),/published.*carrier/)
 const value=payload()
 value[0].content.rendered+='<h3>Apply now</h3>'
 assert.throws(()=>extractJobs(value),/application boundary/)
})

test('Pragya plain publication rejects hidden or executable criterion carriers',()=>{
 for(const attribute of ['style="display:none"','onclick="unreviewed()"']){
  const value=payload()
  value[0].content.rendered=value[0].content.rendered.replace('<p><strong>Qualification:','<p '+attribute+'><strong>Qualification:')
  assert.throws(()=>extractJobs(value))
 }
})

test('Pragya matching label-only criteria cannot qualify a full description',async()=>{
 for(const missing of ['all','Qualification','Experience','Role']){
  const criteria=['Qualification','Experience','Role'].map(label=>'<p>'+label+': '+(missing==='all'||missing===label?'':'Native substantive requirement for '+label)+'</p>').join('')
  const content='<h3>Open positions</h3><h3>Product Engineer</h3>'+criteria+'<h3>Apply now</h3>'
  const value=payload();value[0].content.rendered=content
  const html='<html><head><title>Careers - Pragya Refrigeration</title><link rel="canonical" href="'+SURFACE+'"></head><body><article id="post-5056" class="page status-publish post-5056"><div class="container container--prose prose">'+content+'</div></article></body></html>'
  const jobs=await run({fetchJson:async()=>value,fetchText:async()=>html})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].jobDescription,null,missing+' lacks mandatory substantive criteria')
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].country,null)
  assert.ok(jobs[0].rawNativeRoleEvidence.unqualifiedNativeDescription)
 }
})
