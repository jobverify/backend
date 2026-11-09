import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createChronusScraper,CAREER_PAGE_URL,OPENINGS_API_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const options=(change=(_url,body)=>body)=>{
 const seen=new Map(),row=url=>{const r=capture.packets.find(r=>r.requestUrl===url);assert.ok(r,'Only declared current native URLs: '+url);return r}
 return{fetchText:async url=>row(url).body,fetchImpl:async url=>{
  const r=row(url),count=(seen.get(url)??0)+1;seen.set(url,count)
  const response=new Response(change(url,r.body,count),{status:r.status,headers:{'content-type':r.contentType}});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('Chronus recognizes the current reviewed native client and proves the configured public widget is empty at closing',async()=>{
 const jobs=await createChronusScraper().run(options());assert.equal(jobs.length,0)
 const proof=readInventoryEvidence(jobs);assert.equal(proof.status,'verified-empty');assert.equal(proof.firstParty,true);assert.equal(proof.listingComplete,true)
 assert.equal(proof.surface,OPENINGS_API_URL);assert.equal(proof.reportedTotal,0)
})
test('Chronus rejects a different current tenant or changed widget program',async()=>{
 for(const name of['0ac16jm9wnz4f.js','rbox_api.js'])await assert.rejects(createChronusScraper().run(options((url,body)=>url.endsWith(name)?body.replace('8241','9999'):body)),/program|client|tenant|profile/i)
})
test('Chronus never treats a missing native region or unavailable native inventory as empty',async()=>{
 await assert.rejects(createChronusScraper().run(options((url,body)=>url===CAREER_PAGE_URL?body.replaceAll('job-openings','missing-region'):body)),/region|client|native/i)
 await assert.rejects(createChronusScraper().run(options((url,body)=>url===OPENINGS_API_URL?'{}':body)),/inventory|array|native/i)
})
test('Chronus retains a coverage gap for a positive native record without a verified country or full criteria',async()=>{
 for(const location of[{city:'Chennai',country:null},{city:'Chennai',country:'Unknown'},{city:'Chennai',country:'India'}]){
  const jobs=await createChronusScraper().run(options((url,body)=>url===OPENINGS_API_URL?JSON.stringify([{id:123,title:'Current native role',company_name:'Chronus',location}]):body))
  assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
 }
})
