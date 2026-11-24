import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {currentAtosDocument,currentAtosRole} from './currentNative20261115.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-role-rows-20261121.json.gz',import.meta.url))))
const [mumbai,cgo,identity]=fixture.reviewedNewRows
const selected=fixture.packets.find(packet=>packet.requestedURL.includes('optionsFacetsDD_country=IN')).requestedURL
async function replay(t,change){
 const counts=new Map(),calls=[],mutations=[]
 t.mock.method(globalThis,'fetch',()=>{throw Error('Only retained original Atos responses are permitted')})
 try{
  const jobs=await run({now:()=>fixture.capturedAt,requestIntervalMs:0,fetchImpl:async(value,init)=>{
   const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);calls.push(url)
   const original=fixture.packets.filter(packet=>packet.requestedURL===url)[index]
   assert.ok(original,'No guessed/current external response: '+url+' #'+index)
   const packet={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()}
   const before=JSON.stringify(packet);change?.(packet,url,index)
   if(JSON.stringify(packet)!==before)mutations.push({url,index})
   assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
   const response=new Response(Buffer.from(packet.body),{status:packet.status,headers:packet.headers})
   Object.defineProperty(response,'url',{value:packet.url});return response
  }})
  return{jobs,calls,mutations}
 }catch(error){return{error,calls,mutations}}
}

test('current complete row models add two roles with actual dates and preserve all16 proven roles',async t=>{
 const result=await replay(t);assert.ifError(result.error)
 const jobs=result.jobs
 assert.equal(jobs.length,18)
 for(const url of fixture.provenPriorRoleURLs)assert.ok(jobs.some(job=>job.sourceUrl===url),'Prior qualified role preserved: '+url)
 const lead=jobs.find(job=>job.sourceUrl===mumbai.url),sales=jobs.find(job=>job.sourceUrl===cgo.url)
 assert.ok(lead);assert.equal(lead.jobId,'551533');assert.equal(lead.postingDate,'2026-11-20T00:00:00.000Z')
 assert.match(lead.sourceNativeFullCriteria,/OutSystems/);assert.match(lead.sourceNativeFullCriteria,/Severn Trent specific standards/)
 assert.ok(sales);assert.equal(sales.jobId,'552274');assert.equal(sales.postingDate,'2026-11-14T02:00:00.000Z')
 assert.match(sales.sourceNativeFullCriteria,/12 to 15 years/);assert.match(sales.sourceNativeFullCriteria,/INR 25 Cr per annum/)
 for(const job of [lead,sales]){
  const packet=fixture.packets.find(packet=>packet.requestedURL===job.sourceUrl)
  const proof=currentAtosDocument(Buffer.from(packet.bodyBase64,'base64').toString(),{url:packet.url,headers:packet.headers})
  const original=currentAtosRole(proof,packet.url)
  assert.equal(job.sourceNativeFullCriteria,original.criteria);assert.deepEqual(job.sourceNativeRecord,original)
  assert.deepEqual(job.sourceNativeClosingRecord,original);assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,null)
  assert.equal(job.closingDate,null);assert.equal(job.sourceRenderedApplicationQualified,false)
 }
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,20)
 assert.equal(jobs.nativeCollectionEvidence.unqualifiedNativeRowCount,1)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(hold=>hold.url===identity.url&&hold.reason==='current-native-row-role-programme-criteria-or-publication-contract-unqualified'))
 assert.ok(jobs.nativeCollectionEvidence.holds.some(hold=>hold.reason==='authored-native-work-location-unconfirmed'))
 assert.equal(result.calls.filter(url=>url===mumbai.url).length,2);assert.equal(result.calls.filter(url=>url===cgo.url).length,2)
 assert.ok(!result.calls.includes(identity.url));assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeCollectionEvidence.verifiedZero,false)
})

test('current Identity-for-AI original page remains held because its full criteria are a separately authored PDF',()=>{
 const packet=fixture.packets.find(packet=>packet.requestedURL===identity.url)
 const proof=currentAtosDocument(Buffer.from(packet.bodyBase64,'base64').toString(),{url:packet.url,headers:packet.headers})
 assert.throws(()=>currentAtosRole(proof,packet.url),/linked complete native criteria require qualification/)
 assert.match(proof.originalHTML,/atos365-my\.sharepoint\.com/)
})

for(const[name,mutate]of[
 ['unknown executable programme',packet=>{packet.body=packet.body.replace('</head>','<script>window.unknownRolePolicy=true</script></head>')}],
 ['changed native Apply route programme',packet=>{packet.body=packet.body.replace(/(\bjobID\s*:\s*)1459169833\b/,(_match,prefix)=>prefix+'1459169834')}],
 ['changed disabled LinkedIn identity',packet=>{packet.body=packet.body.replace('551533-en_US','551534-en_US')}],
 ['foreign canonical publisher',packet=>{packet.body=packet.body.replace('rel="canonical" href="https://jobs.atos.net/','rel="canonical" href="https://another.example/')}],
 ['foreign structured work country',packet=>{packet.body=packet.body.replaceAll('Mumbai, IN','Mumbai, ID')}],
 ['foreign native hiring organization',packet=>{packet.body=packet.body.replace('content="Atos"','content="Another Employer"')}],
 ['changed original publication date',packet=>{packet.body=packet.body.replaceAll('Fri Nov 20 00:00:00 UTC 2026','Thu Nov 19 00:00:00 UTC 2026')}],
 ['attributed criteria schema change',packet=>{packet.body=packet.body.replace('data-careersite-propertyid="description"','data-careersite-propertyid="description" onclick="unknown()"')}],
 ['changed original closing criteria', (packet,index)=>{if(index===1)packet.body=packet.body.replace('OutSystems','UnreviewedPlatform')}],
 ['original publisher denial',packet=>{packet.status=403}],
])test('reviewed current role rejects '+name,async t=>{
 const result=await replay(t,(packet,url,index)=>{if(url===mumbai.url)mutate(packet,index)})
 assert.ok(result.mutations.length>0,'Negative control must alter the original response')
 assert.match(result.error?.message??'',/Atos current native/)
})

test('a newly changed listing publication tuple stays held without borrowing old role metadata',async t=>{
 const result=await replay(t,(packet,url)=>{if(url===selected)packet.body=packet.body.replaceAll('Nov 20, 2026','Nov 19, 2026')})
 assert.ifError(result.error);assert.ok(result.mutations.length>0)
 assert.equal(result.jobs.length,17);assert.ok(!result.jobs.some(job=>job.sourceUrl===mumbai.url))
 assert.ok(result.jobs.some(job=>job.sourceUrl===cgo.url));assert.ok(!result.calls.includes(mumbai.url))
 const hold=result.jobs.nativeCollectionEvidence.holds.find(hold=>hold.url===mumbai.url)
 assert.equal(hold.originalNativeRecord.nativeListingPublishDate,'Nov 19, 2026')
 assert.equal(result.jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
