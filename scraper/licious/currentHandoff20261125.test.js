import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {CAREERS_URL,CURRENT_JOBS_URL,LISTING_API_URL} from './nativeInventory.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/handoff.json.gz',import.meta.url))))
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-app-router-default-20261107.json.gz',import.meta.url))))
const prior=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-declared.json.gz',import.meta.url))))
const component='https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-c1cec5a194c4fed6.js'
// Current corporate/program originals combined with retained genuine native
// payloads exercise deployment compatibility. Live inventory is checked
// separately; this replay never manufactures role country or new vacancies.
function replay(edit=(_url,body)=>body){const reads=[];return{reads,options:{fetchPage:async(url,init)=>{
 reads.push(url)
 const captured=current.packets.find(packet=>packet.requestedURL===url)
 let body
 if(captured){const bytes=Buffer.from(captured.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),captured.sha256);body=bytes.toString()}
 else{const packet=prior.packets.find(packet=>packet.url===url)||old.packets.find(packet=>packet.requestedUrl===url&&packet.requestBody===(init.body??null));assert.ok(packet,'Only retained native response '+url);body=Buffer.from(packet.bodyBase64,'base64').toString()}
 return{url,status:200,body:edit(url,body)}
}}}}

test('Licious exact current whole component retains all native observations without inventing country or complete company scope',async()=>{
 const{reads,options}=replay(),jobs=await run(options),evidence=jobs.nativeCollectionEvidence
 assert.equal(current.synthetic,false);assert.ok(reads.includes(CAREERS_URL));assert.ok(reads.includes(CURRENT_JOBS_URL));assert.ok(reads.includes(component))
 assert.equal(jobs.length,0);assert.equal(evidence.observations.length,32);assert.equal(evidence.closingRecords.length,32)
 assert.ok(evidence.observations.every(row=>row.listingRecord&&row.detailRecord))
 assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.companyGlobalTotal,null);assert.equal(evidence.companyIndiaTotal,null)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.ok(evidence.reasons.some(reason=>reason.startsWith('native-role-country-unpublished:')))
})

test('Licious current exact component still rejects changed tenant initialization before inventory acquisition',async()=>{
 let changed=false
 const{reads,options}=replay((url,body)=>{
  if(url!==component)return body
  const next=body.replace('"careers","licious"','"careers","foreign"');changed=next!==body;return next
 })
 await assert.rejects(run(options),/client contract changed/);assert.equal(changed,true)
 assert.equal(reads.includes(LISTING_API_URL),false)
})

test('Licious current finite component does not admit a modified bootstrap merely because the initializer is unchanged',async()=>{
 let changed=false
 const{reads,options}=replay((url,body)=>{if(url!==component)return body;changed=true;return body+';globalThis.unreviewedRecruitment=true'})
 await assert.rejects(run(options),/client contract changed/);assert.equal(changed,true)
 assert.equal(reads.includes(LISTING_API_URL),false)
})

test('Licious current declaration rejects foreign and extra router carriers before reading any native vacancy endpoint',async()=>{
 for(const mode of['unknown','extra','srcdoc']){
  const{reads,options}=replay((url,body)=>url!==CURRENT_JOBS_URL?body:mode==='unknown'?body.replaceAll('page-c1cec5a194c4fed6.js','page-1111111111111111.js')
   :mode==='extra'?body.replace('</body>','<script src="/_next/static/chunks/app/content/careers/jobs/page-2222222222222222.js"></script></body>')
    :body.replace('id="mnhembedded"','id="mnhembedded" srcdoc="Additional application requirements"'))
  await assert.rejects(run(options),/current .*?(?:handoff|carrier)/);assert.equal(reads.includes(LISTING_API_URL),false)
 }
})
