import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {eightfoldDocument,parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-contract-20261120.json.gz',import.meta.url))))
const id=fixture.qualifiedId,jobURL='/api/apply/v2/jobs/'+id+'?'
const replay=(mutate=(_url,body)=>body,strict=false)=>{
 const counts=new Map();let ordinal=0
 return {now:fixture.startedAt,fetchImpl:async(url,init)=>{
  const n=counts.get(url)??0;counts.set(url,n+1)
  const packet=strict?fixture.packets[ordinal++]:fixture.packets.filter(row=>row.requestedURL===url)[n]
  assert.ok(packet,'only recorded native current public reads')
  assert.equal(url,packet.requestedURL);assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.persistedSHA256)
  return Object.defineProperty(new Response(mutate(url,bytes.toString(),n+1),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}
}
const editModel=(html,edit)=>{
 const carrier=eightfoldDocument(html).entries.find(({node})=>node.attrs.id==='smartApplyData').node
 const raw=carrier.children[0],model=parseEightfoldJson(decodeHTML(raw));edit(model)
 const escaped=JSON.stringify(model).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
 return html.replace(raw,escaped)
}
const editJob=(body,edit)=>{const job=JSON.parse(body);edit(job);return JSON.stringify(job)}
test('HSBC exact current original sequence independently qualifies full India role and application',async()=>{
 const jobs=await run(replay(undefined,true))
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,id);assert.equal(jobs[0].country,'India')
 assert.ok(jobs[0].sourceDescription.includes('HSBC Software Development India'))
 assert.ok(jobs[0].sourceDescription.length>1000)
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('HSBC unrelated client deployment bytes cannot replace or invalidate independently qualified native role facts',async()=>{
 const jobs=await run(replay((url,body)=>url.includes('/gen/js/smartApply.')?body+'\n/* unrelated deployment marker */':body))
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,id)
})
for(const [name,edit] of [
 ['typed country', (url,body)=>url.endsWith('/careers/job/'+id)?editModel(body,m=>{m.all_applicable_locations[0].country='US'}):body],
 ['legal employer',(url,body)=>url.includes(jobURL)?editJob(body,j=>{j.job_description=j.job_description.replaceAll('HSBC Software Development India','Other legal employer')}):body],
 ['full criteria',(url,body)=>url.includes(jobURL)?editJob(body,j=>{j.job_description='<p>Additional mandatory condition.</p>'+j.job_description}):body],
 ['application account',(url,body)=>url.includes(jobURL)?editJob(body,j=>{j.apply_redirect_url=j.apply_redirect_url.replace('hsbcholdin','anotheraccount')}):body],
])test('HSBC current role still holds contradictory '+name,async()=>{
 await assert.rejects(run(replay(edit)),error=>/no currently verified native India technology roles/.test(error.message)&&error.nativeCollectionEvidence.lifecycleCleanupAllowed===false)
})
test('HSBC closing current native criteria drift cannot yield a role',async()=>{
 await assert.rejects(run(replay((url,body,n)=>url.includes(jobURL)&&n===2?editJob(body,j=>{j.job_description+='<p>Changed closing criterion.</p>'}):body)),error=>/criteria/.test(error.message)&&error.nativeCollectionEvidence.lifecycleCleanupAllowed===false)
})
