import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-native.json.gz',import.meta.url))))
const CAREERS='https://celebaltech.com/careers',currentList='careers-091ce09ce7680f62.js',priorList='careers-7794f93b5502d572.js'
const api='https://celebal-connect-backend-prod-c2d0ghayhbgjhkc6.centralindia-01.azurewebsites.net/api/jobOpenings/'
function replay(edit=text=>text){const calls=[],seen=new Map();return{calls,options:{now:()=>fixture.capturedAt,fetchText:async url=>{
 const count=(seen.get(url)??0)+1;seen.set(url,count);calls.push(url)
 const p=fixture.packets.filter(p=>p.url===url)[count-1];assert.ok(p,'Only exact current native response sequence: '+url+' #'+count)
 const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256)
 return edit(bytes.toString(),url,count)
}}}}
test('Celebal current complete acquisition retains six own full India roles,31 original observations and every coverage hold',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(io.calls.length,18);assert.equal(jobs.length,6);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,31)
 assert.equal(jobs.nativeCollectionEvidence.candidateRoles,24);assert.equal(jobs.nativeCollectionEvidence.unknownCountry.length,18)
 assert.equal(jobs.nativeCollectionEvidence.nativeListClient.url,CAREERS.replace('/careers','')+'/_next/static/chunks/pages/'+currentList)
 assert.equal(jobs.nativeCollectionEvidence.nativeDetailClient.plainTextOnly,true)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('Celebal closing cannot substitute another reviewed list client inside the same publisher build',async()=>{
 const io=replay((text,url,count)=>url===CAREERS&&count===2?text.replaceAll(currentList,priorList):text)
 await assert.rejects(run(io.options),/closing publisher deployment changed/)
})
test('Celebal closing rechecks the exact selected current list bytes before returning any earlier roles',async()=>{
 const io=replay((text,url,count)=>url.endsWith(currentList)&&count===2?text+';unreviewedEmployerOverride()':text)
 await assert.rejects(run(io.options),/client program contract changed/)
})
test('Celebal current native rows with mixed or unqualified work countries retain their original observations',async()=>{
 const io=replay((text,url)=>{if(!url.startsWith(api))return text;const value=JSON.parse(text);for(const row of Array.isArray(value.data)?value.data:[value.data])if(row.id==='website-owner')row.location='Jaipur, India / London, United Kingdom';return JSON.stringify(value)})
 const jobs=await run(io.options);assert.equal(jobs.length,5);assert.equal(jobs.some(j=>j.jobId==='website-owner'),false)
 assert.ok(jobs.nativeCollectionEvidence.unknownCountry.some(row=>row.jobId==='website-owner'))
 assert.equal(jobs.nativeCollectionEvidence.observations.length,31)
})
test('Celebal current plain-text client holds authored hidden requirements and preserves their complete original data',async()=>{
 const io=replay((text,url)=>{if(!url.startsWith(api))return text;const value=JSON.parse(text);for(const row of Array.isArray(value.data)?value.data:[value.data])if(row.id==='website-owner')row.responsibilities[0]+='<span hidden>Mandatory clearance</span>';return JSON.stringify(value)})
 const jobs=await run(io.options);assert.equal(jobs.length,5);assert.deepEqual(jobs.nativeCollectionEvidence.criteriaHolds,['website-owner'])
 assert.match(jobs.nativeCollectionEvidence.observations.find(row=>row.nativeSourceRecord.id==='website-owner').nativeSourceRecord.responsibilities[0],/Mandatory clearance/)
})
test('Celebal current closing whole inventory criteria drift rejects opening-only roles',async()=>{
 const io=replay((text,url,count)=>{if(url!==api+'getAllJobs'||count!==2)return text;const value=JSON.parse(text);value.data[0].description+=' Changed closing requirement.';return JSON.stringify(value)})
 await assert.rejects(run(io.options),/closing whole native inventory or criteria changed/)
})
