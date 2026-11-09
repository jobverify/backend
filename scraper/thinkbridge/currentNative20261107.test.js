import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createThinkbridgeScraper,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const options=(change=(_url,body)=>body)=>{const seen=new Map();return{fetchText:async url=>{const row=capture.packets.find(r=>r.requestUrl===url);assert.ok(row,'Only current official URLs: '+url);const count=(seen.get(url)??0)+1;seen.set(url,count);return change(url,row.body,count)}}}
test('thinkbridge reads all current full native descriptions and withholds unbounded remote locations',async()=>{
 const jobs=await createThinkbridgeScraper().run(options());assert.equal(jobs.length,4)
 assert.ok(jobs.every(j=>j.country==='India'&&j.jobDescription.length>1500&&j.sourceDetailComplete&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,10);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.every(j=>/^https:\/\/careers\.thinkbridge\.com\/jobs\/Careers\/\d+\//.test(j.applyUrl)))
})
test('thinkbridge rejects changed native employer, work country and closing criteria',async()=>{
 for(const change of[
  (url,body)=>url.includes('full-stack-engineer-with-claude-code')?body.replaceAll('"name": "thinkbridge"','"name": "Other employer"'):body,
  (url,body)=>url.includes('full-stack-engineer-with-claude-code')?body.replace('"addressCountry": "India"','"addressCountry": "United States"'):body,
  (url,body,count)=>url!==CAREERS_URL&&count===2?body.replace('About Role','Changed native criterion'):body,
 ])await assert.rejects(createThinkbridgeScraper().run(options(change)),/native|employer|country|closing|changed/i)
})
