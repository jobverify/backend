import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,PROVIDER_METADATA} from '../../scraper/blueconic/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/blueconicBamboo20261106/capture.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(r=>[r.url,r]))
const replay=(mutate=()=>{})=>{
 const requests=[],audits=[]
 return {requests,audits,options:{fetchPage:async url=>{
  requests.push(url);const r=packets.get(url);assert.ok(r,'Only original BlueConic BambooHR entities: '+url)
  const packet={url,status:r.status,bodyBase64:r.bodyBase64,headers:r.headers};mutate(packet,url,requests);return packet
 },fetchJson:async url=>assert.fail('Obsolete parsed Greenhouse route: '+url),onAudit:a=>audits.push(a)}}
}
test('exported BlueConic collector follows current declared BambooHR and returns all three explicit India roles',async()=>{
 const r=replay(),jobs=await run(r.options)
 assert.equal(jobs.length,3);assert.deepEqual(new Set(jobs.map(j=>j.jobId)),new Set(['24','23','25']))
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceNativeRecord.description===j.sourceNativeDescriptionHTML))
 assert.equal(r.audits.length,1);assert.equal(r.audits[0].observations.length,3)
 assert.equal(r.audits[0].closingInventoryMatches,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(r.audits[0].companyGlobalTotal,null);assert.equal(r.audits[0].lifecycleCleanupAllowed,false)
 assert.ok(r.requests.every(u=>!u.includes('greenhouse')))
})
const html=(packet,transform)=>{packet.bodyBase64=Buffer.from(transform(Buffer.from(packet.bodyBase64,'base64').toString('utf8'))).toString('base64')}
const json=(packet,transform)=>html(packet,s=>{const value=JSON.parse(s);transform(value);return JSON.stringify(value)})
const primary='https://www.blueconic.com/about/careers/careers---open-positions'
const nativeFeed='https://blueconic.bamboohr.com/jobs/embed2.php?version=1.0.0&format=json'
for(const [label,from,to] of [
 ['tenant','data-domain="blueconic.bamboohr.com"','data-domain="other.bamboohr.com"'],
 ['department','data-departmentId=""','data-departmentId="18940"'],
 ['canonical','rel="canonical"','rel="alternate"'],
 ['inactive mount','id="BambooHR"','id="BambooHR" hidden'],
 ['authored integrity','src="https://blueconic.bamboohr.com/js/embed.js"','src="https://blueconic.bamboohr.com/js/embed.js" integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="'],
])test('rejects changed employer '+label+' before native role selection',async()=>{
 const r=replay((p,u)=>{if(u===primary)html(p,s=>{assert.ok(s.includes(from));return s.replace(from,to)})})
 await assert.rejects(run(r.options),/BlueConic/);assert.ok(!r.requests.some(u=>u.endsWith('/detail')))
})
test('rejects a changed declared client rather than executing it',async()=>{
 const r=replay((p,u)=>{if(u.endsWith('/js/embed.js'))html(p,s=>s+'\n// synthetic changed asset')})
 await assert.rejects(run(r.options),/embed client changed/)
})
test('contradictory primary document media type cannot qualify an active employer HTML handoff',async()=>{
 const r=replay((p,u)=>{if(u===primary)p.headers={'content-type':'text/plain'}})
 await assert.rejects(run(r.options),/media type/)
})
test('native status error cannot qualify a success-shaped old detail model',async()=>{
 const r=replay((p,u)=>{if(u.endsWith('/24/detail'))json(p,m=>m.meta.status=503)})
 await assert.rejects(run(r.options),/error envelope/)
})
for(const defect of ['duplicate','foreign URL','continuation','nested continuation'])test('retains native '+defect+' as an inventory failure',async()=>{
 const r=replay((p,u)=>{if(u===nativeFeed)json(p,m=>{
  if(defect==='duplicate')m.departments[0].positions.push({...m.departments[0].positions[0]})
  if(defect==='foreign URL')m.departments[0].positions[0].url='https://other.bamboohr.com/careers/24'
  if(defect==='continuation')m.nextCursor='more'
  if(defect==='nested continuation')m.meta={hasMore:true}
 })})
 await assert.rejects(run(r.options),/BlueConic/)
})
for(const defect of ['country missing','country conflict','identity','closed','criteria','error envelope'])test('withholds a native '+defect+' role and preserves its original observation',async()=>{
 const r=replay((p,u)=>{if(u.endsWith('/24/detail'))json(p,m=>{
  const j=m.result.jobOpening
  if(defect==='country missing')j.location.addressCountry=null
  if(defect==='country conflict')j.atsLocation.country='United States'
  if(defect==='identity')j.jobOpeningShareUrl='https://blueconic.bamboohr.com/careers/999'
  if(defect==='closed')j.jobOpeningStatus='Closed'
  if(defect==='criteria')j.description='Coming soon'
  if(defect==='error envelope')m.meta.error='native unavailable'
 })})
 if(defect==='error envelope'){await assert.rejects(run(r.options),/BlueConic/);return}
 const jobs=await run(r.options);assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.jobId!=='24'))
 assert.equal(r.audits[0].observations.length,3);assert.equal(readSourceObservationEvidence(jobs,'blueconic').observedVacancyCount,3)
 assert.equal(r.audits[0].observations.find(j=>j.jobId==='24').sourceCurrentNativeRoleQualified,false)
})
test('closing drift withholds publication rows while retaining all native observations and unknown totals',async()=>{
 const r=replay((p,u,requests)=>{if(u===nativeFeed&&requests.filter(v=>v===nativeFeed).length===2)json(p,m=>m.departments[0].positions[0].name+=' changed')})
 const jobs=await run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits[0].observations.length,3)
 assert.equal(r.audits[0].closingInventoryMatches,false);assert.equal(readSourceObservationEvidence(jobs,'blueconic').observedRecordCount,3)
})
test('403 ends the denied host without later source requests',async()=>{
 const r=replay((p,u)=>{if(u.endsWith('/careers/24'))p.status=403})
 await assert.rejects(run(r.options),e=>e.httpStatus===403&&e.failureKind==='blocked_or_access_denied'&&e.requestedUrl==='https://blueconic.bamboohr.com/careers/24')
 assert.equal(r.requests.at(-1),'https://blueconic.bamboohr.com/careers/24')
})
for(const status of [401,429,503])test('original HTTP '+status+' retains status and truthful category',async()=>{
 const r=replay((p,u)=>{if(u.endsWith('/careers/24'))p.status=status})
 await assert.rejects(run(r.options),e=>e.httpStatus===status&&e.status===status&&e.failureKind===(status===503?'network_or_timeout':'blocked_or_access_denied')&&e.message.includes('HTTP '+status))
 assert.equal(r.requests.at(-1),'https://blueconic.bamboohr.com/careers/24')
})
for(const kind of ['hidden mount','inert mount','hidden client'])test('raw retained '+kind+' duplicates cannot change the actual client DOM authority',async()=>{
 const r=replay((p,u)=>{if(u!==primary)return;html(p,s=>{
  const marker=/<div\b[^>]*\bid="BambooHR"[^>]*>/i;assert.ok(marker.test(s))
  const prefix=kind==='hidden client'?'<script hidden src="https://blueconic.bamboohr.com/js/embed.js"></script>':
   '<div id="BambooHR" '+(kind==='hidden mount'?'hidden data-domain="other.bamboohr.com"':'inert data-domain="blueconic.bamboohr.com"')+' data-version="1.0.0" data-departmentId="18940"></div>'
  return s.replace(marker,m=>prefix+m)
 })})
 await assert.rejects(run(r.options),/single retained/);assert.equal(r.requests.length,1)
})
test('default transport failure retains the original cause and network category',async()=>{
 const cause=Object.assign(Error('connection timed out'),{code:'UND_ERR_CONNECT_TIMEOUT'})
 await assert.rejects(run({fetchImpl:async()=>{throw new TypeError('fetch failed',{cause})}}),e=>e.failureKind==='network_or_timeout'&&e.cause?.cause===cause)
})
test('caller cancellation settles an original-response override that ignores its signal',async()=>{
 const c=new AbortController(),reason={opaque:'synthetic exact cancellation'}
 await assert.rejects(run({signal:c.signal,fetchPage:()=>{c.abort(reason);return new Promise(()=>{})}}),e=>e===reason)
})
test('awaited native observation callback preserves exact cancellation',async()=>{
 const r=replay(),c=new AbortController(),reason={opaque:'stop native audit'}
 await assert.rejects(run({...r.options,signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}}),e=>e===reason)
})
test('actual registered source metadata and dispatch use current native collector with no historical count authority',async()=>{
 const p=getScraperCatalog().find(p=>p.source==='blueconic');assert.equal(p.atsPlatform,'bamboohr')
 for(const metadata of [p,PROVIDER_METADATA]){
  assert.equal(metadata.verifiedAt,null);assert.equal(metadata.verifiedPublicJobCount,null);assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false)
 }
 const r=replay(),jobs=await createCatalogScraper(p).run(r.options);assert.equal(jobs.length,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('the default bounded Node reader handles the same original entities with manual anonymous GETs',async()=>{
 const audits=[]
 const jobs=await run({onAudit:a=>audits.push(a),fetchImpl:async(url,init)=>{
  const r=packets.get(url);assert.ok(r,url);assert.equal(init.redirect,'manual')
  assert.ok(!new Headers(init.headers).has('Cookie')&&!new Headers(init.headers).has('Authorization'))
  const response=new Response(Buffer.from(r.bodyBase64,'base64'),{status:r.status,headers:r.headers})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 assert.equal(jobs.length,3);assert.equal(audits.length,1);assert.equal(audits[0].closingInventoryMatches,true)
})
test('the established Infinity convention requests every qualified native role',async()=>{
 const r=replay(),jobs=await run({...r.options,maxJobs:Infinity});assert.equal(jobs.length,3)
})
test('a caller result cap retains all three original source observations and no completeness claim',async()=>{
 const r=replay(),jobs=await run({...r.options,maxJobs:1});assert.equal(jobs.length,1)
 assert.equal(readSourceObservationEvidence(jobs,'blueconic').observedVacancyCount,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('immediate original-response IO cannot return a success after its elapsed source deadline',async()=>{
 const r=replay()
 await assert.rejects(run({...r.options,timeoutMs:1}),e=>e.failureKind==='network_or_timeout'&&e.message==='BlueConic public source deadline')
})
test('a synchronous audit overrun rejects delivery and never invokes the next callback',async()=>{
 const r=replay();let entered=false,records=0
 await assert.rejects(run({...r.options,timeoutMs:250,onAudit:()=>{
  entered=true;const until=performance.now()+300;while(performance.now()<until){}
 },onRecords:()=>{records++}}),e=>e.failureKind==='network_or_timeout'&&e.message==='BlueConic public source deadline')
 assert.equal(entered,true);assert.equal(records,0)
})
