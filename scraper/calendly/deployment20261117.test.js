import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261117.json.gz',import.meta.url))))
const second=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261117-second.json.gz',import.meta.url))))
const HOME='https://calendly.com/careers',FEED='https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true'
const ISLAND='https://calendly.com/_astro/islands.Bjp5RwAt.js'
const replay=(change=(_url,row)=>row,capture=fixture)=>{
 const counts=new Map()
 return async url=>{
  const count=counts.get(url)||0;counts.set(url,count+1)
  const originals=capture.responses.filter(row=>row.url===url),row=originals[count]
  assert.ok(row,'No invented native response: '+url+' read '+(count+1))
  const packet=change(url,{...row,body:Buffer.from(row.bodyBase64,'base64').toString('utf8')},count+1)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
}

test('Calendly Nov17 exact current declared deployment reconciles all five full foreign roles and bounded India zero',async()=>{
 for(const row of fixture.responses)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 const jobs=await run({fetchImpl:replay()}),evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[])
 assert.equal(audit.publisher.signatureSHA256,'9032655e44fbe71ad56259acc36d9037ef676412401366ffae553acb81b800b9')
 assert.equal(audit.publisher.activeCarrierCount,96)
 assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,5);assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(isVerifiedEmptyEvidence(evidence),false)
 assert.equal(audit.companyGlobalScopeQualified,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.fullClosingPublisherRenderersBoardFeedAndEveryRoleReconciled,true)
 const native=JSON.parse(Buffer.from(fixture.responses.find(row=>row.url===FEED).bodyBase64,'base64')).jobs
 assert.deepEqual(audit.roles.map(role=>role.id),native.map(role=>role.id))
 for(const role of audit.roles){
  assert.equal(role.country,'United States');assert.equal(role.employer,'Calendly')
  assert.equal(role.fullCriteriaOutsideStructuredPayRangesExact,true)
  assert.equal(role.closingFullRoleCriteriaAndIdentityUnchanged,true)
  assert.deepEqual(role.sourceNativeRecord,native.find(row=>row.id===role.id))
 }
})

for(const[name,url,edit]of[
 ['changed executable bytes',ISLAND,body=>body+'\nwindow.extra=true'],
 ['another recruitment declaration',HOME,body=>body+'<a href="https://other.example/jobs">Other jobs</a>'],
 ['unreviewed index declaration',HOME,body=>body.replaceAll('index.yMV3JoNH.js','index.future.js')],
])test('Calendly Nov17 withholds zero for '+name,async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((current,row)=>current===url?{...row,body:edit(row.body)}:row)}),/program|renderer/)
})

test('Calendly Nov17 still withholds zero for an explicit India role',async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((url,row)=>{
  if(url!==FEED)return row
  const payload=JSON.parse(row.body);payload.jobs[0].location.name='India';payload.jobs[0].offices=[]
  return {...row,body:JSON.stringify(payload)}
 })}),/India role requires/)
})

test('Calendly Nov17 still checks closing executable bytes',async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((url,row,count)=>url===ISLAND&&count===2?{...row,body:row.body+'\nwindow.extra=true'}:row)}),/closing.*renderer/)
})

test('Calendly Nov17 second declared deployment independently reconciles all original foreign records and criteria',async()=>{
 for(const row of second.responses)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 const jobs=await run({fetchImpl:replay(undefined,second)}),evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[])
 assert.equal(audit.publisher.signatureSHA256,'b874ded46402f78dfb78b362be51441eae77b68cb9359b3ebe850a4312425e2f')
 assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,5);assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.lifecycleCleanupAllowed,false);assert.equal(isVerifiedEmptyEvidence(evidence),false)
 assert.equal(audit.companyGlobalScopeQualified,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.fullClosingPublisherRenderersBoardFeedAndEveryRoleReconciled,true)
 const native=JSON.parse(Buffer.from(second.responses.find(row=>row.url===FEED).bodyBase64,'base64')).jobs
 assert.equal(audit.roles.length,native.length)
 for(const role of audit.roles){
  assert.equal(role.country,'United States');assert.equal(role.employer,'Calendly')
  assert.equal(role.fullCriteriaOutsideStructuredPayRangesExact,true);assert.equal(role.closingFullRoleCriteriaAndIdentityUnchanged,true)
  assert.deepEqual(role.sourceNativeRecord,native.find(row=>row.id===role.id))
 }
})

const SECOND_ISLAND='https://calendly.com/_astro/islands.DYNsjXxJ.js'
test('Calendly second deployment rejects changed executable bytes',async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((url,row)=>url===SECOND_ISLAND?{...row,body:row.body+'\nwindow.extra=true'}:row,second)}),/renderer/)
})
test('Calendly second deployment keeps its closing executable check',async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((url,row,count)=>url===SECOND_ISLAND&&count===2?{...row,body:row.body+'\nwindow.extra=true'}:row,second)}),/closing.*renderer/)
})
for(const [name,edit,expected]of[
 ['India scope',payload=>{payload.jobs[0].location.name='India';payload.jobs[0].offices=[]},/India role requires/],
 ['employer identity',payload=>{payload.jobs[0].company_name='Different company'},/employer.*identity/],
])test('Calendly second deployment still rejects changed '+name,async()=>{
 await assert.rejects(()=>run({fetchImpl:replay((url,row)=>{
  if(url!==FEED)return row
  const payload=JSON.parse(row.body);edit(payload);return {...row,body:JSON.stringify(payload)}
 },second)}),expected)
})
