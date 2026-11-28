import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const previous=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-form-20261128.json.gz',import.meta.url))))
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
const oldForm=previous.packets.find(p=>p.requestedUrl===current.form.requestedUrl)
const historicalForm=Buffer.from(oldForm.bodyBase64,'base64').toString()
const renderer=current.assets.find(p=>p.url.includes('/javascript/'))
const oldRenderer=previous.packets.find(p=>p.requestedUrl.includes('new-webform-render.cf31892'))
const sha=body=>createHash('sha256').update(body).digest('hex')
function replay(edit=(p,body)=>body){
 const counts=new Map(),reads=[]
 return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const candidates=previous.packets.filter(p=>p.requestedUrl===url&&p.method===init.method&&(p.requestBody??'')===(init.body??''))
  const key=JSON.stringify([url,init.method,init.body]),index=counts.get(key)??0
  counts.set(key,index+1)
  let packet,body
  if(url===current.form.url){packet=current.form;body=packet.body}
  else if(url===renderer.url){packet=renderer;body=packet.body}
  else{packet=candidates[index];assert.ok(packet,'Only the historical native inventory and exact current form/renderer are replayed');body=Buffer.from(packet.bodyBase64,'base64').toString()}
  reads.push({url,method:init.method})
  return Object.defineProperties(new Response(edit(packet,body,index),{status:packet.status,headers:packet.headers}),{url:{value:packet.url},redirected:{value:false}})
 }}}
}

test('genuine current KANINI form differs only in two complete asset URLs',()=>{
 for(const row of [current.form,...current.assets]){
  assert.equal(row.status,200);assert.equal(row.requestedUrl,row.url)
  assert.equal(sha(row.body),row.sha256)
 }
 assert.equal(Buffer.byteLength(current.form.body),10070)
 assert.equal(current.form.sha256,'19cbeeb4a918b313206b6bf013ec644000d2799f8531eb7d0a9466064e212e8e')
 assert.equal(historicalForm
  .replace('new-webform-render.3bd34533918e2d81600c60782a092267.css','new-webform-render.acce4863325a692a744cfe524a95ce7c.css')
  .replace('new-webform-render.cf31892f523c34063f88f17e9e07e474.js','new-webform-render.082690d8aba11ae76b52f8df164b9068.js'),current.form.body)
})

test('historical inventory with the genuine current form preserves full question models and all scope holds',async()=>{
 const r=replay(),jobs=await run(r.options)
 assert.equal(jobs.length,11)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.nativeApplicationDeclarations.fullNativeHTML,current.form.body)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.nativeApplicationDeclarations.program.url,renderer.url)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.applicationValidationQualified,false)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.ok(job.nativeApplicationModel.webforms[0].sections.flatMap(section=>section.fields??[]).some(field=>field.api_name==='Applied_Job_ID'&&field.required===true))
 }
 assert.equal(r.reads.filter(row=>row.url===renderer.url).length,2)
 assert.equal(r.reads.filter(row=>row.url===profile.formAPI).length,2)
})

for(const [name,edit]of [
 ['changed current form ID',(packet,body)=>packet.url===current.form.url?body.replace(profile.formId,'2887000000000000'):body],
 ['an additional current inline application program',(packet,body)=>packet.url===current.form.url?body.replace('</body>','<script>window.unreviewedValidation=true</script></body>'):body],
 ['an unreviewed current renderer reference',(packet,body)=>packet.url===current.form.url?body.replace('new-webform-render.082690d8aba11ae76b52f8df164b9068.js','new-webform-render.unreviewed.js'):body],
 ['the former renderer at the current declared URL',(packet,body)=>packet.url===renderer.url?Buffer.from(oldRenderer.bodyBase64,'base64').toString():body],
 ['new renderer code outside the captured original',(packet,body)=>packet.url===renderer.url?body+';window.unreviewedValidation=true':body],
])test('current KANINI form deployment holds '+name,async()=>{
 let changed=false
 await assert.rejects(run(replay((packet,body,index)=>{const altered=edit(packet,body,index);changed||=altered!==body;return altered}).options),error=>error.failureKind==='parser_or_contract_error')
 assert.equal(changed,true,'the actual current declaration or program must be mutated')
})

test('a closing transition to a previously reviewed form release remains a changed full native model',async()=>{
 const r=replay((packet,body,index)=>packet.url===current.form.url&&index===1?historicalForm:body)
 const fetcher=r.options.fetchImpl
 r.options.fetchImpl=async(url,init)=>url===oldRenderer.url
  ?Object.defineProperties(new Response(Buffer.from(oldRenderer.bodyBase64,'base64'),{status:oldRenderer.status,headers:oldRenderer.headers}),{url:{value:url},redirected:{value:false}})
  :fetcher(url,init)
 await assert.rejects(run(r.options),/whole closing native/)
})
