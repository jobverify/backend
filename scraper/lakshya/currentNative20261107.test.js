import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261107.json.gz',import.meta.url)))).packets
const detailUrl=packets.find(p=>p.url.includes('/api/v2/')).url
async function execute(t,change=p=>p){
 const calls=[],counts=new Map(),fetchImpl=async(url,init={})=>{
  const p=packets.find(p=>p.url===url&&(p.method||'GET')===(init.method||'GET')&&(p.requestBody||null)===(init.body||null))
  assert.ok(p,'Captured current public request only '+url+' '+(init.body||''))
  const count=(counts.get(url)||0)+1;counts.set(url,count);calls.push({url,method:init.method||'GET',body:init.body})
  const q=change({...p,body:Buffer.from(p.bodyBase64,'base64'),count})
  const r=new Response(q.body,{status:q.status,headers:{'content-type':q.contentType}});Object.defineProperty(r,'url',{value:q.responseUrl||url});return r
 }
 const mock=t.mock.method(globalThis,'fetch',fetchImpl)
 try{return{jobs:await createCatalogScraper(getScraperCatalog().find(p=>p.source==='lakshya')).run({fetchImpl}),calls}}
 finally{mock.mock.restore()}
}
test('registered Lakshya traverses the current employer-bound native cursor feed and returns23 full India roles',async t=>{
 const{jobs,calls}=await execute(t);assert.equal(jobs.length,23)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.postingDate&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(j=>j.sourceNativeDescriptionSections.description&&j.sourceNativeEmployerEvidence.accountUid==='26e1100d-0d4c-4840-a884-14ab40ea3d94'))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,24)
 assert.equal(jobs.nativeCollectionEvidence.nativeWidgetLocationRows.length,58)
 assert.equal(calls.filter(c=>c.method==='POST').length,6)
 assert.ok(calls.filter(c=>c.method==='POST').every(c=>JSON.parse(c.body).location.length===0))
 assert.equal(calls.filter(c=>c.url.includes('/api/v2/')).length,46)
})
test('Lakshya current employer handoff cannot change Workable tenant',async t=>{
 await assert.rejects(execute(t,p=>p.url==='https://lakshyadigital.com/careers/'?{...p,body:Buffer.from(p.body.toString().replaceAll('apply.workable.com/lakshyadigitalglobal','apply.workable.com/foreign'))}:p),/handoff|employer|Workable/)
})
test('Lakshya reciprocal native account cannot be replaced',async t=>{
 await assert.rejects(execute(t,p=>p.url.endsWith('/api/v1/accounts/lakshyadigitalglobal')?{...p,body:Buffer.from(p.body.toString().replace('26e1100d-0d4c-4840-a884-14ab40ea3d94','26e1100d-0d4c-4840-a884-14ab40ea3d95'))}:p),/account|identity|reciprocal/)
})
test('Lakshya native detail cannot contradict the explicit India listing country',async t=>{
 await assert.rejects(execute(t,p=>{
  if(p.url!==detailUrl)return p
  const model=JSON.parse(p.body);model.location.country='United States';model.location.countryCode='US'
  model.locations.forEach(l=>{l.country='United States';l.countryCode='US'})
  return{...p,body:Buffer.from(JSON.stringify(model))}
 }),/location|country|disagree|changed/)
})
test('Lakshya closing full native criteria drift withholds the affected role even with stable cursor inventory',async t=>{
 const{jobs}=await execute(t,p=>{
  if(p.url!==detailUrl||p.count!==2)return p
  const model=JSON.parse(p.body);model.description+=' Changed closing criteria.';return{...p,body:Buffer.from(JSON.stringify(model))}
 });assert.equal(jobs.length,22);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(!jobs.some(j=>detailUrl.endsWith('/'+j.jobId)))
})
test('Lakshya stops native access denial without another request to the denied origin',async t=>{
 let denied=0,after=0
 await assert.rejects(execute(t,p=>{
  if(denied&&p.url.startsWith('https://apply.workable.com'))after++
  if(p.url.includes('/api/v3/')){denied++;return{...p,status:403,contentType:'text/html',body:Buffer.from('Forbidden')}}return p
 }),e=>e.status===403&&e.failureKind==='blocked_or_access_denied')
 assert.equal(denied,1);assert.equal(after,0)
})
