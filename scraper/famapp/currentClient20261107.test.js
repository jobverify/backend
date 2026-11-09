import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createFamAppScraper} from './script.js'
import {createFampayScraper} from '../fampay/script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const API='https://api.lever.co/v0/postings/fampay?mode=json'
const options=(change=(_url,body)=>body)=>{
 const seen=new Map(),packet=url=>{const row=capture.packets.find(r=>r.requestUrl===url);assert.ok(row,'Only declared native current URLs: '+url);return row}
 return{fetchPage:async url=>{const r=packet(url);return{status:r.status,url:r.url,html:r.body}},fetchImpl:async url=>{
  const r=packet(url),count=(seen.get(url)??0)+1;seen.set(url,count)
  const response=new Response(change(url,r.body,count),{status:r.status,headers:{'content-type':r.contentType}});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('FamApp and Fampay follow the current declared native tenant with all original criteria and a closing read',async()=>{
 for(const factory of[createFamAppScraper,createFampayScraper]){
  const jobs=await factory().run(options());assert.equal(jobs.length,17)
  assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
  assert.ok(jobs.every(j=>j.jobDescription.length>800))
  const first=jobs.find(j=>j.jobId==='09c9d0cd-f422-4138-a065-8d45e71d01a7')
  assert.ok(first.jobDescription.includes('Perks That Go Beyond the Paycheck'))
  const original=JSON.parse(capture.packets.find(r=>r.requestUrl===API).body).find(r=>r.id===first.jobId)
  assert.ok(first.jobDescription.includes(original.descriptionPlain.trim()))
  for(const section of original.lists)assert.ok(first.jobDescription.includes(section.content.trim()))
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 }
})
test('Fam current native channel rejects changed program, native tenant identity and closing criteria',async()=>{
 await assert.rejects(createFamAppScraper().run(options((url,body)=>url.endsWith('2cyegqtq_3d48.js')?body.replace('fampay','foreign'):body)),/client|program|profile/i)
 await assert.rejects(createFampayScraper().run(options((url,body)=>url===API?body.replaceAll('jobs.lever.co/fampay/','jobs.lever.co/foreign/'):body)),/identity|tenant|native/i)
 await assert.rejects(createFamAppScraper().run(options((url,body,count)=>url===API&&count===2?body.replace('Controllership','Changed criterion'):body)),/closing|changed/i)
})
test('Fam does not infer India from a city when the native country is absent',async()=>{
 for(const country of[null,'ZZ']){
  const jobs=await createFamAppScraper().run(options((url,body)=>url===API?JSON.stringify(JSON.parse(body).map((j,i)=>i?j:{...j,country})):body))
  assert.equal(jobs.length,16);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 }
})
