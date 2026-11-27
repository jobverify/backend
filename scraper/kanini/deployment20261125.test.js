import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261125.json.gz',import.meta.url))))
const originalClient=gunzipSync(fs.readFileSync(new URL('./test-data/current-form-client-20261118.js.gz',import.meta.url))).toString()
const originalForm=gunzipSync(fs.readFileSync(new URL('./test-data/current-form-20261118.html.gz',import.meta.url))).toString()
const text=p=>Buffer.from(p.bodyBase64,'base64').toString()
const homepage='https://kanini.com/',listing='https://kanini.com/careers/open-positions/'
function replay(edit=(p,body)=>body){
 const seen=new Map(),reads=[]
 return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const candidates=capture.packets.filter(p=>p.requestedUrl===url&&p.method===init.method&&(p.requestBody??'')===(init.body??''))
  const key=JSON.stringify([url,init.method,init.body]),count=seen.get(key)??0;seen.set(key,count+1)
  const p=candidates[count];assert.ok(p,'Only captured native opening/closing reads and declared blank search');reads.push({url,method:init.method})
  return Object.defineProperties(new Response(edit(p,text(p),count),{status:p.status,headers:p.headers}),{url:{value:p.url},redirected:{value:p.redirected}})
 }}}
}

test('KANINI current exact marketing order and Zoho form retain 11 full India roles, whole form, and scope holds',async()=>{
 const r=replay(),jobs=await run(r.options),e=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,11);assert.ok(jobs.every(j=>j.country==='India'&&j.jobDescription.length>100))
 assert.equal(e.nativeOpeningInventory.rows.length,25);assert.equal(e.nativeCountryUnknownRows,8);assert.equal(e.nativeExplicitForeignRows,6)
 assert.equal(e.closingFullNativeInventoryMatch,true);assert.equal(e.listingPaginationComplete,true)
 assert.equal(e.publicEligibility,null);assert.equal(e.browserEquivalenceComplete,false);assert.equal(e.applicationValidationQualified,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const job of jobs){
  assert.equal(job.nativeApplicationModel.info.company,'KANINI Software Solutions')
  assert.equal(job.applicationValidationQualified,false)
  assert.ok(job.nativeApplicationModel.webforms[0].sections.flatMap(s=>s.fields??[]).some(f=>f.api_name==='Applied_Job_ID'&&f.required===true))
 }
 assert.equal(e.nativeOpeningInventory.nativeApplicationDeclarations.fullNativeHTML,text(capture.packets.find(p=>p.requestedUrl.includes('/forms/3a2d'))))
 assert.equal(e.retainedResponses.length,r.reads.length)
})

for(const [label,edit]of [
 ['new inline hiring code',(p,body)=>p.requestedUrl===homepage?body.replace('</body>','<script>window.unreviewedHiringRule=true</script></body>'):body],
 ['changed marketing attributes',(p,body)=>p.requestedUrl===homepage?body.replace('ae35999531d1419dabbb72c65b68a6c4.js','unreviewed.js'):body],
 ['changed native search serialization',(p,body)=>p.requestedUrl===listing?body.replace('&action=get_all_jobs&page=','&action=get_other_jobs&page='):body],
 ['unknown complete form context',(p,body)=>p.requestedUrl.includes('/forms/3a2d')?body.replace('</body>','<script>window.unreviewedQuestion=true</script></body>'):body],
 ['unreviewed renderer body',(p,body)=>p.requestedUrl.includes('new-webform-render.cf31892')?body+';window.unreviewedValidation=true':body],
 ['old renderer substituted for current declared renderer',(p,body)=>p.requestedUrl.includes('new-webform-render.cf31892')?originalClient:body]
])test('KANINI current finite profiles reject '+label,async()=>{
 if(label==='changed native search serialization'){
  const original=text(capture.packets.find(p=>p.requestedUrl===listing));assert.ok(edit({requestedUrl:listing},original)!==original,'Mutation reaches the actual current declaration')
 }
 await assert.rejects(run(replay(edit).options),error=>error.failureKind==='parser_or_contract_error')
})

test('KANINI admits only the exact adjacent marketing pair reversal',async()=>{
 let mutated=false
 await assert.rejects(run(replay((p,body)=>{
  if(p.requestedUrl!==homepage)return body
  const declarations=body.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)
  const marketing=declarations.find(tag=>tag.includes('cdn-in.pagesense.io/js/kaninimarketing8600/ae35999531d1419dabbb72c65b68a6c4.js'))
  assert.ok(marketing);mutated=true
  return body.replace(marketing,'').replace('<script',marketing+'<script')
 }).options),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(mutated,true)
})

test('KANINI rejects a change between two reviewed complete form deployments at closing',async()=>{
 const r=replay((p,body,count)=>p.requestedUrl.includes('/forms/3a2d')&&count===1?originalForm:body)
 const originalFetch=r.options.fetchImpl
 r.options.fetchImpl=async(url,init)=>url==='https://static.zohocdn.com/recruit/javascript/new-webform-render.5e1789cf0193bff12e8805c3fd83a57f.js'
  ?Object.defineProperties(new Response(originalClient,{headers:{'content-type':'application/javascript'}}),{url:{value:url},redirected:{value:false}})
  :originalFetch(url,init)
 await assert.rejects(run(r.options),/closing/)
})

test('KANINI current full closing native descriptions remain exact',async()=>{
 let mutated=false
 await assert.rejects(run(replay((p,body,count)=>{
  if(p.requestedUrl==='https://kanini.com/jobs?job_id=2887000031418008'&&count===1){
   const changed=body.replace(/(<div\s+class="cont-jder"[^>]*>)/,'$1<p>Additional native criterion at closing.</p>')
   assert.ok(changed!==body,'Mutation reaches the actual full native criteria');mutated=true;return changed
  }
  return body
 }).options),/closing/)
 assert.equal(mutated,true)
})
