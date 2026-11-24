import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const key=url=>{const u=new URL(url);u.hash='';return u.href}
const packets=new Map(fixture.packets.map(p=>[key(p.requestedURL),p]))
const transport=(change=()=>{},closing=false)=>{
 const counts=new Map()
 return async url=>{
  const k=key(url),p=packets.get(k);assert.ok(p,'No uncaptured publisher request: '+k)
  const n=(counts.get(k)??0)+1;counts.set(k,n)
  let body=Buffer.from(p.bodyBase64,'base64').toString('utf8')
  if(k==='https://www.kpit.com/careers-overview/'){
   assert.ok(body.includes('Site Kit by Google 1.191.0'))
   body=body.replace('Site Kit by Google 1.191.0','Site Kit by Google 1.192.0')
  }
  if(!closing||n===2)body=change(k,body)
  return Object.defineProperty(new Response(body,{status:p.status,headers:p.headers}),'url',{value:key(p.url)})
 }
}
test('registered KPIT retains all native facts across the observed unrelated WordPress release change',async()=>{
 const fetchImpl=transport((url,body)=>body),saved=globalThis.fetch;globalThis.fetch=fetchImpl
 try{
  const provider=getScraperCatalog().find(p=>p.source==='kpit')
  const jobs=await createCatalogScraper(provider).run({fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,13);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,16)
  assert.equal(jobs.nativeCollectionEvidence.heldRows.length,3)
  assert.equal(jobs.nativeCollectionEvidence.wholeNativeRoleModelsClosingReconciled,true)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.ok(job.sourceNativeRecord.job.description.length>200);assert.equal(job.activeApplyVerified,false)}
 }finally{globalThis.fetch=saved}
})
export {transport}

test('a current own corporate closure cannot be hidden by an unchanged native handoff',async()=>{
 const m=await import('./currentNativeFacts20261121.js')
 const p=packets.get('https://www.kpit.com/careers-overview/')
 const body=Buffer.from(p.bodyBase64,'base64').toString('utf8').replace('</body>','<div>All job applications are closed.</div></body>')
 assert.throws(()=>m.readCorporate(body),/closed|availability/i)
})

test('a current own listing closure cannot be contradicted by a published API status',async()=>{
 const m=await import('./currentNativeFacts20261121.js')
 const p=packets.get('https://www.kpit.com/job-listing/?country=India&location=&exp=&show_all=1')
 const body=Buffer.from(p.bodyBase64,'base64').toString('utf8').replace('</h3>','</h3><p>This position is closed.</p>')
 assert.throws(()=>m.readCards(body),/closed|availability/i)
})

test('a rejected corporate original is retained before parsing with its original digest',async()=>{
 const {run,CAREERS_URL}=await import('./currentNativeFacts20261121.js')
 await assert.rejects(run({fetchImpl:transport((url,body)=>url===CAREERS_URL?body.replace('</body>','<div>Applications are closed.</div></body>'):body)}),error=>{
  assert.match(error.message,/closed/i)
  assert.ok(error.recruitmentObservations.rawPublisherResponses?.some(r=>r.url===CAREERS_URL&&r.body.includes('Applications are closed.')&&/^[a-f0-9]{64}$/.test(r.originalBodySHA256)))
  return true
 })
})
