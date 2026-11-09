import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261107.json.gz',import.meta.url)))).packets
const role='https://loginext.hire.trakstar.com/jobs/fk0jrmm/'
async function execute(t,change=p=>p,options={}){
 const counts=new Map(),calls=[],fetchImpl=async(url,init={})=>{
  const p=packets.find(p=>p.url===url);assert.ok(p,'Captured public URL only '+url);assert.equal(init.method||'GET','GET')
  const count=(counts.get(url)||0)+1;counts.set(url,count);calls.push(url)
  const q=change({...p,body:Buffer.from(p.bodyBase64,'base64'),count})
  const r=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType}});Object.defineProperty(r,'url',{value:q.responseUrl||url});return r
 }
 const mock=t.mock.method(globalThis,'fetch',fetchImpl)
 try{return{jobs:await createCatalogScraper(getScraperCatalog().find(p=>p.source==='loginext')).run({fetchImpl,...options}),calls}}
 finally{mock.mock.restore()}
}
test('registered LogiNext recovers25 current native India roles with full visible criteria, identity, original dates and closing proof',async t=>{
 const{jobs,calls}=await execute(t);assert.equal(jobs.length,25)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.postingDate===j.sourceNativeJobPosting.datePosted))
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false&&j.sourceNativeJobPosting.identifier.value===j.jobId))
 assert.ok(jobs.every(j=>j.nativeDescriptionHTML&&j.jobDescription.length>1000&&j.applyUrl===j.sourceUrl+'?apply=true'))
 assert.equal(jobs.find(j=>j.jobId==='fk0qsz2').title,'Finance & Accounting Associate')
 assert.equal(jobs.find(j=>j.jobId==='fk0qsz2').sourceNativeJobPosting.title,'Finance &amp; Accounting Associate')
 assert.equal(jobs.find(j=>j.jobId==='fk0q2b6').sourceNativeJobPosting.title,'Client Operations Manager ')
 assert.equal(calls.filter(url=>url.includes('/jobs/fk')).length,50)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,25)
 assert.ok(jobs.nativeCollectionEvidence.unreconciledCorporateRoleReferences.length>0)
})
test('LogiNext current handoff cannot bind a foreign native tenant',async t=>{
 await assert.rejects(execute(t,p=>p.url.includes('www.loginextsolutions.com')?{...p,body:Buffer.from(p.body.toString().replaceAll('https://loginext.hire.trakstar.com','https://foreign.hire.trakstar.com'))}:p),/handoff|employer|native|contract|surface/)
})
test('LogiNext native role, employer and country contradictions cannot publish an India job',async t=>{
 for(const [from,to]of [[/"value"\s*:\s*"fk0jrmm"/g,'"value":"fk00000"'],[/"name"\s*:\s*"LogiNext"/g,'"name":"Foreign Employer"'],[/"title"\s*:\s*"Account Manager"/g,'"title":"Different Role"'],[/"addressCountry"\s*:\s*"India"/g,'"addressCountry":"United States"']]){
  await assert.rejects(execute(t,p=>p.url===role?{...p,body:Buffer.from(p.body.toString().replaceAll(from,to))}:p),/identity|employer|country|native|contract/)
 }
})
test('LogiNext rejects duplicate structured country keys even when the final value would agree with the visible page',async t=>{
 await assert.rejects(execute(t,p=>p.url===role?{...p,body:Buffer.from(p.body.toString().replace('"addressCountry": "India"','"addressCountry": "United States", "addressCountry": "India"'))}:p),/duplicate|country|native/)
})
test('LogiNext full criteria must remain visible and match the complete native description',async t=>{
 await assert.rejects(execute(t,p=>p.url===role?{...p,body:Buffer.from(p.body.toString().replace('class="jobdesciption"','class="jobdesciption" style="display:none"'))}:p),/description|criteria|visible|native|contract/)
})
test('LogiNext closing full native criteria change cannot reuse an earlier description behind a stable board',async t=>{
 await assert.rejects(execute(t,p=>p.url===role&&p.count===2?{...p,body:Buffer.from(p.body.toString().replaceAll('Enterprise Account Manager','Changed Closing Criteria'))}:p),/closing|criteria|changed|contract/)
})
test('LogiNext cannot publish a role past a native closing date',async t=>{
 await assert.rejects(execute(t,p=>p.url===role?{...p,body:Buffer.from(p.body.toString().replace('"employmentType" :','"validThrough" : "2026-01-01", "employmentType" :'))}:p),/closing|expired|native|contract/)
})
test('LogiNext access denial stops the native origin without returning an empty inventory',async t=>{
 let denied=0,after=0
 await assert.rejects(execute(t,p=>{
  if(denied&&p.url.startsWith('https://loginext.hire.trakstar.com'))after++
  if(p.url===role){denied++;return{...p,status:403,contentType:'text/html',body:Buffer.from('Forbidden')}}return p
 }),e=>e.status===403&&e.failureKind==='blocked_or_access_denied')
 assert.equal(denied,1);assert.equal(after,0)
})
