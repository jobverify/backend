import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAlgoworksTechnologiesScraper } from '../scraper/algoworkstechnologies/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/algoworkstechnologies/fixtures/native-20261029.json.gz', import.meta.url))))
const root='https://algoworks.keka.com/careers/'
const id='c1623220-7738-4bff-ba91-5a9f0bbe01fc'
function transport(change = ()=>{}, responseChange = ()=>{}, onRequest = ()=>{}) {
 const files=structuredClone(fixture); change(files)
 return async url=>{
  onRequest(url,files)
  let name = url === 'https://www.algoworks.com/careers/' ? 'algoworks-official' : url===root+'api/embedjobs/js/'+id ? 'algoworks-renderer' : url===root+'api/organization/default/careerportalinfo' ? 'algoworks-portal' : url===root+'api/embedjobs/default/active/'+id ? 'algoworks-active' : url===root+'api/jobs/default/active' ? 'algoworks-board-active' : url===root+'api/embedjobs/grouplinkstatus/'+id ? 'algoworks-grouplink' : /^https:\/\/algoworks.keka.com\/careers\/jobdetails\/\d+$/.test(url) ? 'detail-'+url.split('/').pop() : null
  if(!name || files[name+'.txt']===undefined)throw Error('Unexpected request '+url)
  const response = new Response(files[name+'.txt'],{status:200})
  Object.defineProperty(response,'url',{value:url,configurable:true})
  return responseChange(response,url) || response
 }
}
test('current official Keka handoff recovers all 34 raw identities with honest country-only and remote locations',async()=>{
 const jobs=await createAlgoworksTechnologiesScraper().run({fetchImpl:transport()})
 assert.equal(jobs.length,34)
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,34)
 assert.equal(jobs.find(j=>j.jobId==='90535').city,null)
 assert.equal(jobs.find(j=>j.jobId==='90535').location,'India')
 assert.equal(jobs.find(j=>j.jobId==='92037').city,'Remote')
 assert.equal(jobs.find(j=>j.jobId==='81923').city,'Remote')
 assert.equal(jobs.find(j=>j.jobId==='93498').city,'Noida')
 assert.equal(jobs.find(j=>j.jobId==='93147').jobDescription,'LINQ Non-Surge')
 assert.equal(jobs.find(j=>j.jobId==='93147').sourceDetailComplete,false)
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal,34)
 assert.equal(readInventoryEvidence(jobs)?.listingComplete,true)
})
for(const [label,change] of [
 ['countryless description',f=>{let a=JSON.parse(f['algoworks-active.txt']);a.find(j=>j.id===90535).description='<div>Senior developer with no country</div>';f['algoworks-active.txt']=JSON.stringify(a)}],
 ['conflicting role country',f=>{let a=JSON.parse(f['algoworks-active.txt']);a.find(j=>j.id===92037).description+='<div>Location: United States</div>';f['algoworks-active.txt']=JSON.stringify(a)}],
 ['native inventory envelope',f=>{f['algoworks-active.txt']=JSON.stringify({jobs:JSON.parse(f['algoworks-active.txt']),hasMore:true})}],
 ['mismatched detail identity',f=>{f['detail-93498.txt']=f['detail-93498.txt'].replaceAll('93498','99999')}],
 ['board inventory mismatch',f=>{f['algoworks-board-active.txt']='[]'}],
 ['group linked employer scope',f=>{f['algoworks-grouplink.txt']='{"isGroupLinked":true}'}],
])test('fails closed on '+label,async()=>{await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(change)}))})
test('does not turn a capped inventory into a complete source check',async()=>{
 await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(),maxJobs:1}),/cap|limit/i)
})
test('cancellation stops recovery before emitting jobs',async()=>{const c=new AbortController();c.abort();await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(),signal:c.signal}))})
for(const [label,change] of [
 ['missing response URL',r=>{Object.defineProperty(r,'url',{value:''});return r}],
 ['accepted 202 response',r=>{Object.defineProperty(r,'status',{value:202});return r}],
 ['foreign redirected response',r=>{Object.defineProperty(r,'url',{value:'https://unrelated.example/jobs'});return r}],
])test('rejects '+label,async()=>{await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(()=>{},(r,u)=>u.endsWith('jobdetails/93498')?change(r):r)}))})
for(const [label,edit]of [
 ['hidden title',s=>s.replace('<h1 ','<h1 hidden ')],
 ['hidden full description',s=>s.replace('class="job-description-container','hidden class="job-description-container')],
 ['template-only detail',s=>'<template>'+s+'</template>'],
 ['duplicate visible title',s=>s+'<h1>Manager</h1>'],
 ['inert scalar IDs',s=>s.replaceAll('selectedJobId=','hidden selectedJobId=')],
])test('rejects '+label,async()=>{await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(f=>{f['detail-93498.txt']=edit(f['detail-93498.txt'])})}))})
test('rejects inventory that changes while details are being hydrated',async()=>{
 await assert.rejects(createAlgoworksTechnologiesScraper().run({fetchImpl:transport(()=>{},()=>{},(url,files)=>{
  if(url.endsWith('jobdetails/93498')){const rows=JSON.parse(files['algoworks-active.txt']).slice(1);files['algoworks-active.txt']=JSON.stringify(rows);files['algoworks-board-active.txt']=JSON.stringify(rows)}
 })}))
})
