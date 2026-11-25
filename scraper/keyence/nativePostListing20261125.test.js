import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-post-listing-20261125.json.gz',import.meta.url))))
const api='https://keyence.darwinbox.in/ms/candidateapi/',listing=api+'job/alljobs?companyId=main'
const firstId='a6b050e76290c2'
function replay(change=(p,value)=>value){
 const consumed=new Map(),reads=[];let audit
 return{reads,get audit(){return audit},options:{onAudit:value=>{audit=value},fetchImpl:async(url,init)=>{
  reads.push({url,method:init.method,body:init.body})
  if(init.method==='POST')assert.equal(url,listing,'Only the published read-only listing POST is allowed')
  else assert.equal(init.method,'GET')
  if(url===listing)assert.deepEqual(JSON.parse(init.body),{companyId:'main',page:1,sort_option:'new',limit:10})
  const matches=fixture.packets.filter(p=>p.url===url&&p.method===init.method),index=consumed.get(url)??0
  const p=url.startsWith(api)?matches[index]:matches[0]
  assert.ok(p,'Only captured native current method/URL observations may be read: '+init.method+' '+url)
  consumed.set(url,index+1)
  let body=Buffer.from(p.bodyBase64,'base64').toString()
  if(url.startsWith(api))body=JSON.stringify(change(p,JSON.parse(body),index))
  const headers=new Headers(p.headers)
  for(const name of p.setCookieNames??[])headers.append('set-cookie',name+'=controlled-fixture-session; Path=/')
  return Object.defineProperties(new Response(body,{status:p.status,headers}),{url:{value:p.finalURL},redirected:{value:p.redirected}})
 }}}
}
test('Keyence current declared client uses the real native listing POST and retains ten full original listing/detail records',async()=>{
 const r=replay(),jobs=await run(r.options)
 assert.equal(jobs.length,10);assert.equal(r.reads.filter(p=>p.url===listing).length,2)
 assert.equal(r.reads.filter(p=>p.url===api+'groupcompanycareersetting').length,2)
 assert.ok(r.reads.every(p=>!p.url.startsWith(api+'job?page=')))
 assert.equal(r.audit.nativeTotal,10);assert.equal(r.audit.openingSignature,r.audit.closingSignature)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.ok(job.sourceDescription.length>100)
  assert.equal(job.sourceNativeListingRecord.id,job.jobId);assert.equal(job.sourceNativeJob.id,job.jobId)
  assert.equal(job.sourceNativeListingPayload.data.find(row=>row.id===job.jobId).id,job.jobId)
  assert.equal(job.closingDate,new Date(job.sourceNativeListingRecord.job_posting.careers.to*1000).toISOString())
  assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceScopeComplete,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false,'Changed shell remains unqualified')
})
test('Keyence modern listing foreign country or extra location alternative cannot become an India record',async()=>{
 for(const mutate of[row=>{row.country='United States'},row=>{row.tool_tip_locations.push('Boston, United States')},row=>{row.officelocation_show_arr+=',Boston, United States (BOS_Boston)'}]){
  const r=replay((p,value)=>{if(p.url===listing)mutate(value.data.find(row=>row.id===firstId));return value})
  const jobs=await run(r.options);assert.equal(jobs.some(job=>job.jobId===firstId),false)
  assert.ok(r.audit.reasons.includes('native-role-country-alternatives-unresolved:'+firstId))
 }
})
test('Keyence modern listing location IDs must exactly reconcile with independently fetched detail',async()=>{
 const r=replay((p,value)=>{if(p.url===listing)value.data.find(row=>row.id===firstId).officelocation_arr[0]='a0000000000000';return value})
 const jobs=await run(r.options);assert.equal(jobs.some(job=>job.jobId===firstId),false)
})
test('Keyence an extra modern listing criterion holds detail qualification while preserving the complete original payload',async()=>{
 const r=replay((p,value)=>{if(p.url===listing)value.data.find(row=>row.id===firstId).qualification='Additional licence required';return value})
 const job=(await run(r.options)).find(job=>job.jobId===firstId)
 assert.ok(job);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeListingRecord.qualification,'Additional licence required')
 assert.ok(r.audit.reasons.some(reason=>reason.startsWith('unreviewed-listing-schema:')))
})
test('Keyence employer account identity remains exact on the current native route',async()=>{
 const r=replay((p,value)=>{if(p.url.includes('getCompanyConfig'))value.message.company.company_name='Other employer';return value})
 await assert.rejects(run(r.options),/native employer\/account\/main-board identity changed/)
 assert.equal(r.reads.some(p=>p.url===listing),false)
})
test('Keyence current listing total and public posting windows remain checked',async()=>{
 for(const mutate of[value=>{value.job_counts=11},value=>{value.data[0].job_posting.careers.from++},value=>{value.data[0].job_posting.careers.to='later'}]){
  const r=replay((p,value)=>{if(p.url===listing)mutate(value);return value})
  await assert.rejects(run(r.options),/pagination incomplete|publication|closing epoch/)
 }
})
test('Keyence a closing modern listing criterion change remains a visible coverage gap',async()=>{
 const r=replay((p,value,index)=>{if(p.url===listing&&index===1)value.data[0].experience='10 - 20 Years';return value})
 const jobs=await run(r.options);assert.equal(jobs.length,10)
 assert.ok(r.audit.reasons.includes('closing-native-inventory-or-full-details-changed'))
 assert.notEqual(r.audit.openingSignature,r.audit.closingSignature)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
