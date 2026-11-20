import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readTeradyneListing,readTeradyneRole} from './currentPublication20261119.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url)))),at=fixture.observedAt
const text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8'),first=fixture.models[0].rows.find(r=>r.url.includes('/Teradyne/job/')&&r.title.includes('India'))
const criteria=(html,extra)=>{const d=document(html),n=d.nodes(n=>n.attrs.itemprop==='description')[0];assert.ok(n);return html.slice(0,n.openEnd)+extra+html.slice(n.openEnd)}
async function replay(change){const counts=new Map(),calls=[],saved=globalThis.fetch;globalThis.fetch=async()=>assert.fail('The source must use its native Response transport');try{
 const jobs=await run({now:()=>at,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const count=counts.get(url)||0;counts.set(url,count+1);const p=fixture.responses.filter(r=>r.requestedUrl===url)[count];assert.ok(p,'Only original declared requests '+url)
  const changed=change?.(text(p),url,count),packet=typeof changed==='object'?changed:{body:changed??text(p),status:p.status}
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers??p.headers}),'url',{value:p.url})
 }});return{jobs,calls}
}finally{globalThis.fetch=saved}}

test('Teradyne current own production entry qualifies only exact-brand India roles from the mixed keyword result without frozen UI or vacancy hashes',async()=>{
 const {jobs,calls}=await replay();assert.equal(jobs.length,7);assert.equal(new Set(jobs.map(j=>j.jobId)).size,7)
 assert.ok(jobs.every(j=>j.company==='Teradyne'&&j.nativeEmployerDisplayName==='Teradyne'&&j.country==='India'&&j.sourceUrl.includes('/Teradyne/job/')&&!j.sourceDetailComplete&&!j.lifecycleCleanupAllowed))
 assert.ok(!calls.some(url=>url.includes('/Universal-Robots/job/')));assert.equal(jobs.nativeCollectionEvidence.openingNativeRecords.length,26)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs[0].jobId,new URL(first.url).pathname.split('/').filter(Boolean).at(-1));assert.ok(jobs[0].sourceDescription)
})

test('Teradyne employer, authored availability, expired date and whole foreign workplace contradictions hold affected native roles',async()=>{
 for(const label of ['<div>Employer: Universal Robots</div>','<section>Work Country: Canada</section>','<p>Job Status: Draft</p>','<div>Closing Date: 2020-01-01</div>','This position has been filled.']){
  const {jobs}=await replay((body,url)=>url===first.url?criteria(body,label):body);assert.equal(jobs.length,6);assert.ok(!jobs.some(j=>j.sourceUrl===first.url))
 }
 const {jobs}=await replay((body,url)=>url===first.url?body.replaceAll('content="Remote, India, IN"','content="Toronto, CA"'):body);assert.equal(jobs.length,6)
})

test('Teradyne independently closed publication retains known criteria and original dates when optional role closing is unavailable',async()=>{
 const {jobs}=await replay((body,url,n)=>url===first.url&&n===1?{body:'Unavailable',status:503}:body);assert.equal(jobs.length,7)
 const job=jobs.find(j=>j.sourceUrl===first.url);assert.ok(job.sourceDescription);assert.ok(job.postingDate);assert.equal(job.sourceNativeRoleDetailClosingQualified,false)
})

test('Teradyne missing criteria stays explicit partial without inventing dates or company completeness',async()=>{
 const {jobs}=await replay((body,url)=>{if(url!==first.url)return body;const d=document(body),n=d.nodes(n=>n.attrs.itemprop==='description')[0];return body.slice(0,n.start)+body.slice(n.end)})
 assert.equal(jobs.length,7);const job=jobs.find(j=>j.sourceUrl===first.url);assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false);assert.ok(job.postingDate)
})

test('Teradyne denied native origin stops subsequent requests while preserving prior independently qualified roles',async()=>{
 const {jobs,calls}=await replay((body,url,n)=>url===first.url&&n===1?{body:'Restricted',status:403}:body);assert.equal(jobs.length,1);assert.equal(calls.at(-1),first.url)
 assert.equal(jobs.nativeCollectionEvidence.optionalRoleFailures.at(-1).status,403)
})

test('Teradyne whole own posting labels and contradictory compound country values remain authoritative outside criteria',()=>{
 const packet=fixture.responses.find(r=>r.requestedUrl.includes('/search/')),row=readTeradyneListing(text(packet),packet.requestedUrl).rows.find(r=>r.sourceUrl===first.url),html=text(fixture.responses.find(p=>p.requestedUrl===first.url)),d=document(html),owner=d.nodes(n=>n.attrs.itemtype?.endsWith('/JobPosting'))[0]
 for(const extra of ['<div>Job Status: Draft (not published)</div>','<div>Employer: Other Company</div>','<div>Closing Date: 2020-01-01</div>','<div>Country: Canada</div>'])assert.throws(()=>readTeradyneRole(html.slice(0,owner.closeStart)+extra+html.slice(owner.closeStart),row,at))
 const mixed='Toronto, Canada / '+row.locations[0];assert.throws(()=>readTeradyneRole(html.replaceAll('content="'+row.locations[0]+'"','content="'+mixed+'"'),{...row,locations:[mixed]},at))
})

test('Teradyne original HTTP metadata and opaque caller cancellation cannot be replaced by body-only callbacks',async()=>{
 await assert.rejects(run({fetchText:async()=>''}),/metadata|transport/);const c=new AbortController(),reason={caller:'Teradyne'};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)
})
