import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const searchPacket=fixture.packets.find(packet=>packet.url.includes('/api/jobs?'))
const payload=JSON.parse(Buffer.from(searchPacket.bodyBase64,'base64'))
const packets=new Map()
for(const packet of fixture.packets){if(!packets.has(packet.url))packets.set(packet.url,[]);packets.get(packet.url).push(packet)}
function replay(change=()=>{},options={}){
 const seen=new Map(),calls=[]
 const fetchImpl=async(url,init)=>{
  url=String(url);calls.push({url,init});const index=seen.get(url)||0;seen.set(url,index+1)
  const packet=structuredClone(packets.get(url)?.[index]);assert.ok(packet,'actual declared current native packet '+url+' #'+index)
  packet.html=Buffer.from(packet.bodyBase64,'base64').toString('utf8');change(packet,url,index)
  const response=new Response(packet.html,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 return{calls,result:run({now:()=>fixture.capturedAt,fetchImpl,
  // Labelled legacy callbacks reproduce the old dropped-wrapper failure;
  // they cannot qualify a production current HTTP proof.
  fetchText:async()=>Buffer.from(fixture.packets[0].bodyBase64,'base64').toString('utf8'),fetchJson:async()=>structuredClone(payload),...options})}
}

test('the current own Jibe data envelope does not drop all four native roles',()=>{
 const jobs=extractSearchResults(payload)
 assert.equal(jobs.length,4)
 assert.equal(jobs[0].jobId,'7969');assert.equal(jobs[0].country,'India')
})

test('the current registered Ellucian collector reconciles full own role models twice and preserves all criteria',async()=>{
 const reader=replay(),jobs=await reader.result
 assert.equal(jobs.length,4,JSON.stringify(jobs.nativeCollectionEvidence?.passes[0].holds.map(({nativeID,reason})=>({nativeID,reason}))))
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.company,'Ellucian Higher Education Systems')
  assert.equal(job.sourceNativeDetail.hiring_organization,'Ellucian')
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.match(job.sourceUrl,/^https:\/\/careers\.ellucian\.com\/jobs\/\d+\?lang=en-us$/)
  assert.match(job.applyUrl,/^https:\/\/india-ellucian\.icims\.com\/jobs\/\d+\/login$/)
  assert.ok(job.jobDescription.length>5000)
  assert.deepEqual(job.sourceNativeFullCriteria,{description:job.sourceNativeDetail.description,responsibilities:job.sourceNativeDetail.responsibilities,qualifications:job.sourceNativeDetail.qualifications,benefits:job.sourceNativeDetail.benefits})
  assert.equal(job.closingDate,null)
 }
 assert.equal(jobs.nativeCollectionEvidence.openingClosingMatched,true)
 assert.equal(jobs.nativeCollectionEvidence.passes[0].nativeRows.length,4)
 assert.equal(jobs.nativeCollectionEvidence.passes[1].nativeRows.length,4)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.ok(reader.calls.every(({init})=>init.method==='GET'&&init.redirect==='manual'&&init.credentials==='omit'))
})

const editRecords=(packet,change)=>{
 const value=JSON.parse(packet.html)
 if(Array.isArray(value.jobs))for(const row of value.jobs)change(row.data)
 else change(value)
 packet.html=JSON.stringify(value)
}
for(const [name,change]of[
 ['native country conflict',row=>{if(row.req_id==='7969')row.country_code='US'}],
 ['different own employer',row=>{if(row.req_id==='7969')row.hiring_organization='Another Employer'}],
 ['different application account',row=>{if(row.req_id==='7969')row.apply_url='https://other-employer.icims.com/jobs/7969/login'}],
 ['additional unreviewed criterion',row=>{if(row.req_id==='7969')row.additionalQualifications='A new mandatory native licence'}],
 ['hidden native qualification',row=>{if(row.req_id==='7969')row.qualifications+='<p hidden>A new mandatory native licence</p>'}],
])test(name+' cannot publish the target role',async()=>{
 const reader=replay((packet,url)=>{if(url.includes('/api/jobs'))editRecords(packet,change)})
 const jobs=await reader.result
 assert.equal(jobs.some(job=>job.jobId==='7969'),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('closing-only full criteria changes cannot be certified by opening models',async()=>{
 const reader=replay((packet,url,index)=>{if(index===1&&url.includes('/api/jobs/7969/'))editRecords(packet,row=>{row.qualifications+='<p>New current mandatory licence</p>'})})
 await assert.rejects(reader.result,/closing|changed/)
})

test('unreviewed current declared client bytes cannot qualify native models',async()=>{
 const reader=replay((packet,url)=>{if(url.includes('app.jibecdn.com/'))packet.html+='\nwindow.searchConfig={country:"US"};'})
 await assert.rejects(reader.result,/client|program/)
})

test('no exact current native jobs is held without inventing a verified India zero',async()=>{
 const reader=replay((packet,url)=>{if(url.includes('/api/jobs?')){const value=JSON.parse(packet.html);value.jobs=[];value.totalCount=0;value.count=0;packet.html=JSON.stringify(value)}})
 const jobs=await reader.result
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})

for(const notice of ['This job is not available.','This position is currently unavailable.','This position has been filled.','This role is closed.'])test('explicit native unavailability is held: '+notice,async()=>{
 const reader=replay((packet,url)=>{if(url.includes('/api/jobs'))editRecords(packet,row=>{if(row.req_id==='7969')row.description+='<p>'+notice+'</p>'})})
 const jobs=await reader.result
 assert.equal(jobs.some(job=>job.jobId==='7969'),false)
 assert.ok(jobs.length>0,'other genuine native jobs remain qualified')
})

test('a foreign base cannot replace the current publisher account context',async()=>{
 const reader=replay((packet,url)=>{if(url.includes('/jobs/locations/'))packet.html=packet.html.replace('<base href="/">','<base href="https://another-employer.invalid/">')})
 await assert.rejects(reader.result,/base/)
})

test('an uncooperative transport settles at the source deadline',async()=>{
 const reader=replay(undefined,{sourceDeadlineMs:25,fetchImpl:()=>new Promise(()=>{})})
 await assert.rejects(reader.result,/deadline|timeout/)
})

test('oversized native streaming input is cancelled before it can qualify publisher or jobs',async()=>{
 let cancelled=false
 const reader=replay(undefined,{fetchImpl:async url=>{
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}})
  const response=new Response(body,{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(url)});return response
 }})
 await assert.rejects(reader.result,/byte bound/)
 assert.equal(cancelled,true)
})

for(const [name,inject,closingOnly]of[
 ['duplicate native country',body=>body.replace('"country":"India"','"country":"United States","country":"India"'),false],
 ['duplicate original qualification',body=>body.replace('"qualifications":','"qualifications":"A new mandatory native licence","qualifications":'),false],
 ['closing-only duplicate qualification',body=>body.replace('"qualifications":','"qualifications":"A new closing mandatory native licence","qualifications":'),true],
])test(name+' is rejected before original JSON fields are collapsed',async()=>{
 let changed=0
 const reader=replay((packet,url,index)=>{
  if(url.includes('/api/jobs/7969/')&&(!closingOnly||index===1)){const original=packet.html;packet.html=inject(packet.html);assert.notEqual(packet.html,original);changed++}
 })
 await assert.rejects(reader.result,/duplicate|ambiguous/i)
 assert.ok(changed>0)
})

for(const reason of ['explicit-caller-stop',Object.freeze(new Error('explicit-caller-stop'))])test('an opaque or frozen caller abort reason is preserved',async()=>{
 const controller=new AbortController();controller.abort(reason)
 const reader=replay(undefined,{signal:controller.signal})
 await assert.rejects(reader.result,error=>error===reason)
 assert.equal(reader.calls.length,0)
})
