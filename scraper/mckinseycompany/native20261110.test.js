import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,buildSearchApiUrl} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

// Genuine 2026-11-10 opening/closing HTTP bodies. Mutations below are labelled
// synthetic controls; no historical response has been manufactured.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native20261110.json.gz',import.meta.url))))
const replay=(mutate=()=>{},extra={})=>{
 const counts=new Map(),requests=[]
 const read=async(url,options)=>{
  options?.signal?.throwIfAborted()
  const index=counts.get(url)||0;counts.set(url,index+1);requests.push(url)
  const packet=fixture.packets.filter(p=>p.url===url)[index]
  assert.ok(packet,'Unexpected/unretained native occurrence '+url+' #'+index)
  const bytes=Buffer.from(packet.rawBodyBase64,'base64')
  assert.equal(bytes.length,packet.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  const isApi=url.startsWith('https://gateway.mckinsey.com/')
  const value=isApi?JSON.parse(bytes):bytes.toString('utf8')
  if(isApi)mutate(value,{url,index})
  return value
 }
 return {requests,run:()=>run({fetchText:read,fetchJson:read,...extra})}
}

test('McKinsey current native page-number pagination retains all48 India roles and full criteria',async()=>{
 const reader=replay(),jobs=await reader.run()
 assert.equal(jobs.length,48)
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,48)
 for(const job of jobs){
  assert.ok(job.jobDescription?.includes('What you will do:'))
  assert.ok(job.jobDescription?.includes('Your background:'))
  assert.ok(job.jobDescription.length>500)
  assert.equal(job.country,'India')
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(reader.requests.length,66)
 assert.ok(reader.requests.includes(buildSearchApiUrl({start:2})))
 assert.equal(readSourceObservationEvidence(jobs,'mckinseycompany').observedVacancyCount,613)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

test('McKinsey current public UI declares one-based page increments and full criteria fields',()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/program20261110.json.gz',import.meta.url))))
 const bytes=Buffer.from(packet.rawBodyBase64,'base64')
 assert.equal(bytes.length,packet.bodyBytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
 const code=bytes.toString()
 assert.ok(code.includes('Number(de.get("page")||1)+1'))
 assert.ok(code.includes('r({type:ti.SET_START,payload:le})'))
 assert.ok(code.includes('let{pageSize:s,start:c,filterQueryData:u,query:d}=r'))
 for(const name of ['whatYouWillDo','whoYouWillWorkWith','yourBackground'])assert.ok(code.includes(name))
})

test('McKinsey synthetic early empty native page cannot imply complete extraction',async()=>{
 const reader=replay((payload,{url})=>{if(url===buildSearchApiUrl({start:2}))payload.docs=[]})
 await assert.rejects(reader.run(),/pagination|total|inventory|incomplete/i)
})
test('McKinsey synthetic repeated native page cannot silently truncate the inventory',async()=>{
 const first=JSON.parse(Buffer.from(fixture.packets.find(p=>p.url===buildSearchApiUrl({start:1})).rawBodyBase64,'base64'))
 const reader=replay((payload,{url})=>{if(url===buildSearchApiUrl({start:2}))payload.docs=structuredClone(first.docs)})
 await assert.rejects(reader.run(),/duplicate|pagination|inventory/i)
})
test('McKinsey synthetic changed closing role criteria cannot be published as stable',async()=>{
 const reader=replay((payload,{index})=>{if(index===1&&payload.docs?.[0])payload.docs[0].whatYouWillDo='<p>Changed own-role duties.</p>'})
 await assert.rejects(reader.run(),/closing|changed|stable/i)
})
test('McKinsey synthetic metadata-only and inactive criteria remain missing descriptions',async()=>{
 const reader=replay(payload=>{for(const record of payload.docs||[]){
  record.whatYouWillDo='<template><p>Hidden duties must not qualify.</p></template>'
  record.yourBackground='<div hidden>Hidden qualifications must not qualify.</div>'
  record.whoYouWillWorkWith='<p>About our company and workplace.</p>'
  record.shortJobSummary='Apply now'
 }})
 const jobs=await reader.run()
 assert.equal(jobs.length,48)
 assert.ok(jobs.every(job=>job.jobDescription===null&&job.sourceDetailComplete===false))
})
test('McKinsey synthetic unaligned country arrays cannot borrow an India worksite',async()=>{
 const reader=replay(payload=>{for(const record of payload.docs||[])if(record.countries?.includes('India'))record.countries.push('India')})
 assert.equal((await reader.run()).length,0)
})
test('McKinsey synthetic cross-role native application ID conflicts are rejected',async()=>{
 const reader=replay(payload=>{for(const record of payload.docs||[])if(record.countries?.includes('India'))record.jobApplyURL='https://mckinsey.avature.net/careers/ApplicationMethods?folderId=999999'})
 await assert.rejects(reader.run(),/identity|application|native/i)
})
test('McKinsey preserves exact caller cancellation instead of accepting partial rows',async()=>{
 const controller=new AbortController(),reason=new Error('controlled McKinsey caller stop')
 const reader=replay((payload,{url})=>{if(url===buildSearchApiUrl({start:2}))controller.abort(reason)},{signal:controller.signal})
 await assert.rejects(reader.run(),error=>error===reason)
})
for(const [kind,extra] of [['source',{sourceTimeoutMs:5,requestTimeoutMs:100}],['request',{sourceTimeoutMs:100,requestTimeoutMs:5}]]){
 test('McKinsey '+kind+' deadline bounds an uncooperative injected request',async()=>{
  let timer
  try{
   const result=await Promise.race([
    run({fetchText:()=>new Promise(()=>{}),...extra}).then(()=>null,error=>error),
    new Promise(resolve=>{timer=setTimeout(()=>resolve('deadline not enforced'),250)}),
   ])
   assert.equal(result?.name,'TimeoutError')
   assert.match(result.message,new RegExp(kind+' deadline','i'))
  }finally{clearTimeout(timer)}
 })
}
test('McKinsey synthetic obsolete brief summaries cannot establish complete native detail',async()=>{
 const reader=replay(payload=>{for(const record of payload.docs||[]){
  for(const key of ['whatYouWillDo','yourBackground','whoYouWillWorkWith'])delete record[key]
  record.shortJobSummary='Brief summary only; full duties and qualifications unavailable.'
 }})
 const jobs=await reader.run()
 assert.equal(jobs.length,48)
 assert.ok(jobs.every(job=>job.sourceDetailComplete===false))
})
for(const [field,value] of [['whatYouWillDo',null],['yourBackground',{}],['whoYouWillWorkWith',[]],['whatYouWillDo','<div hidden>Invisible native duties.</div>']]){
 test('McKinsey synthetic malformed or inactive '+field+' cannot establish complete native detail',async()=>{
  const jobs=await replay(payload=>{for(const record of payload.docs||[])record[field]=value}).run()
  assert.equal(jobs.length,48)
  assert.ok(jobs.every(job=>job.sourceDetailComplete===false))
 })
}
for(const [kind,value] of [['country',['India']],['country',{name:'India'}],['city',['Mumbai']],['city','Toronto (Canada)'],['city','Toronto - Canada'],['city','Toronto / Canada'],['city','Unreviewed new worksite'],['country','<template>India</template>'],['city','<template>Mumbai</template>']]){
 test('McKinsey synthetic '+kind+' '+JSON.stringify(value)+' cannot qualify an India worksite',async()=>{
  const jobs=await replay(payload=>{for(const record of payload.docs||[]){
   for(let index=0;index<(record.countries||[]).length;index++)if(record.countries[index]==='India'){
    if(kind==='country')record.countries[index]=value
    else record.cities[index]=value
   }
  }}).run()
  assert.equal(jobs.length,0)
  assert.equal(readSourceObservationEvidence(jobs,'mckinseycompany').observedVacancyCount,613)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 })
}
for(const field of ['jobID','jobApplyURL','title'])test('McKinsey synthetic nonliteral '+field+' cannot establish native role identity',async()=>{
 const reader=replay(payload=>{for(const record of payload.docs||[])if(record.countries?.includes('India')){
  record[field]=field==='jobID'?[record[field]]:`<template>${record[field]}</template>`
 }})
 await assert.rejects(reader.run(),/native|identity|requisition/i)
})
