import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readClient,readCareers,readRole,makeJob,CAREERS,apiURL} from './nativeModels.js'
import {runUnosecurNative} from './nativeCareers.js'
import {createUnosecurPublicRead} from './publicRead.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-client-20261128.json.gz',import.meta.url))))
const prefix=fixture.packets,currentURL=prefix[2].requestedUrl,currentSource=prefix[2].body
const unpack=name=>gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))).toString('utf8')
const priorURL=fs.readFileSync(new URL('./fixtures/client-20261113.url.txt',import.meta.url),'utf8'),priorSource=unpack('client-20261113.js.gz')
const nativeResponse=packet=>{const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response}
test('current complete genuine native client qualifies passive data with exact unchanged public producer fingerprints',()=>{
 const prior=readClient(priorSource,priorURL),current=readClient(currentSource,currentURL)
 assert.equal(current.bodySHA256,'1708e4df433151d271bb3144129ad122099901e340d2a5e2be0b7325d11d0ea7')
 assert.deepEqual(current.declarations,prior.declarations)
 assert.equal(current.apiBaseURL,'https://app.reczee.com/api/v1')
 assert.equal(current.currentPassiveDataOnly,true);assert.equal(current.programExecuted,false)
})
test('current genuine corporate inventory retains all nine explicit native declarations and first whole posting',()=>{
 const page=readCareers(prefix[0].body),role=readRole(prefix[1].body,page.rows[0])
 assert.equal(page.rows.length,9);assert.equal(page.rows.filter(row=>row.nativeLocationLabel==='Bangalore, India').length,4)
 const client=readClient(currentSource,role.clientURL)
 assert.equal(apiURL(page.rows[0].sourceUrl,client),'https://app.reczee.com/api/v1/requisitions/from-slug/UYfYR?company_slug=unosecur')
})
test('current client passive qualification cannot become full criteria/application authority on historical genuine native data',()=>{
 // A labeled cross-deployment projection control, not a current capture or job claim.
 const page=readCareers(unpack('careers-20261113.html.gz')),row=page.rows[0],role=readRole(unpack('role-marketing-20261113.html.gz'),row)
 const job=makeJob(unpack('role-marketing-api-20261113.json.gz'),row,role,page,readClient(currentSource,currentURL),'2026-11-28T04:00:00.000Z')
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceRenderedCriteriaComplete,false)
 assert.equal(job.sourceApplicationQualificationComplete,false);assert.equal(job.sourceAvailabilityVerified,false)
 assert.equal(job.sourcePublicContextValidated,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.country,null);assert.ok(job.nativeSourceRecord.api.data.requisition.job_description.length>300)
})
test('actual native prefix advances only to the exact declared public GET and stops typed403 without another role or refresh',async()=>{
 const calls=[],page=readCareers(prefix[0].body)
 const fetchImpl=async url=>{
  calls.push(url)
  const packet=prefix.find(row=>row.requestedUrl===url)
  if(packet)return nativeResponse(packet)
  assert.equal(url,'https://app.reczee.com/api/v1/requisitions/from-slug/UYfYR?company_slug=unosecur')
  const response=new Response('controlled terminal API boundary',{status:403,headers:{'content-type':'text/plain'}});Object.defineProperty(response,'url',{value:url});return response
 }
 await assert.rejects(runUnosecurNative({fetchImpl,minIntervalMs:0}),error=>error.httpStatus===403&&error.abortRetries===true)
 assert.deepEqual(calls,[CAREERS,page.rows[0].sourceUrl,currentURL,'https://app.reczee.com/api/v1/requisitions/from-slug/UYfYR?company_slug=unosecur'])
})
for(const [label,change]of [
 ['native GET method',source=>source.replace('method:"GET"','method:"POST"')],
 ['native endpoint',source=>source.replace('requisitions/from-slug/','requisitions/another/')],
 ['criteria renderer',source=>source.replace('content:t.job_description','content:t.title')],
 ['company parameter',source=>source.replace('company_slug:n','company_slug:"other"')],
 ['extra initialization',source=>source+';globalThis.unreviewed=true'],
])test('current '+label+' mutation remains outside the finite profile',()=>{
 assert.throws(()=>readClient(change(currentSource),currentURL),/changed declared client|current native/i)
})
test('exact current bytes cannot qualify another client release URL',()=>{
 assert.throws(()=>readClient(currentSource,currentURL.replace('78f87bc2','00000000')),/declared client|current native/i)
})
test('old reviewed client contract stays unchanged and does not acquire current passive marker',()=>{
 const prior=readClient(priorSource,priorURL)
 assert.equal(prior.bodySHA256,'8121c21c565097351e9ee508c1016485bc6835d398936b338c64ab8bb8ce7fab')
 assert.equal(Object.hasOwn(prior,'currentPassiveDataOnly'),false)
})
test('current prefix bodies have genuine complete hashes and do not claim a complete registered graph',()=>{
 assert.equal(prefix.length,3);assert.equal(fixture.provenance.registeredFullGraph,false)
 for(const row of prefix)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
})

const response=({status=200,headers={},cancel=()=>{},read=()=>{},url=CAREERS}={})=>({status,url,headers:new Headers({'content-type':'text/html',...headers}),body:{cancel,getReader(){read();return {read:async()=>({done:true}),cancel}}}})
const challenged=(error,status)=>error.httpStatus===status&&error.accessChallenge===true&&error.abortRetries===true&&error.failureKind==='blocked_or_access_denied'&&error.lifecycleCleanupAllowed===false
for(const [header,value,status]of [['cf-mitigated','challenge',200],['x-amzn-waf-action','challenge',200],['CF-MiTiGaTeD',' CHALLENGE ',200],['x-amzn-waf-action','\tChAlLeNgE\t',403]])test('transport rejects '+header+' explicit challenge HTTP'+status+' before native body reader',async()=>{
 let calls=0,reads=0,cancels=0
 const transport=createUnosecurPublicRead({minIntervalMs:0,fetchImpl:async()=>{calls++;return response({status,headers:{[header]:value},read:()=>reads++,cancel:()=>cancels++})}},[])
 try{await assert.rejects(transport.read(CAREERS),error=>challenged(error,status));assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancels,1)}finally{transport.close()}
})
test('transport ordinary nonchallenge header retains complete body stream contract',async()=>{
 let reads=0
 const transport=createUnosecurPublicRead({minIntervalMs:0,fetchImpl:async()=>response({headers:{'cf-mitigated':'not-a-challenge'},read:()=>reads++})},[])
 try{const result=await transport.read(CAREERS);assert.equal(result.receipt.rawText,'');assert.equal(reads,1)}finally{transport.close()}
})
for(const status of [403,429,503])test('transport typed HTTP'+status+' remains terminal with Retry-After preserved before read',async()=>{
 let calls=0,reads=0,cancels=0
 const transport=createUnosecurPublicRead({minIntervalMs:0,fetchImpl:async()=>{calls++;return response({status,headers:{'retry-after':'13'},read:()=>reads++,cancel:()=>cancels++})}},[])
 try{
  await assert.rejects(transport.read(CAREERS),error=>error.httpStatus===status&&error.abortRetries===true&&(status===403||error.retryDelayMs===13000))
  await assert.rejects(transport.read(CAREERS),/stopped source/)
  assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancels,1)
 }finally{transport.close()}
})
test('transport challenged-body cancellation failure cannot replace the typed challenge',async()=>{
 const transport=createUnosecurPublicRead({minIntervalMs:0,fetchImpl:async()=>response({headers:{'cf-mitigated':'challenge'},cancel:()=>{throw Error('controlled cleanup failure')}})},[])
 try{await assert.rejects(transport.read(CAREERS),error=>challenged(error,200))}finally{transport.close()}
})
test('transport foreign response identity stays fatal and disposes its unread body',async()=>{
 let cancels=0
 const transport=createUnosecurPublicRead({minIntervalMs:0,fetchImpl:async()=>response({url:'https://foreign.invalid/careers',cancel:()=>cancels++})},[])
 try{await assert.rejects(transport.read(CAREERS),/HTTP URL changed/);assert.equal(cancels,1)}finally{transport.close()}
})
test('transport pre-aborted opaque caller remains exact without reads or coercion',async()=>{
 const controller=new AbortController(),reason=Object.freeze({toString(){throw Error('coerced')}});controller.abort(reason)
 let calls=0;const transport=createUnosecurPublicRead({signal:controller.signal,minIntervalMs:0,fetchImpl:async()=>{calls++;return response()}},[])
 try{await assert.rejects(transport.read(CAREERS),error=>error===reason);assert.equal(calls,0)}finally{transport.close()}
})
test('transport abort-ignoring fetch still disposes its late unread response',async()=>{
 const controller=new AbortController(),reason=Object.freeze({message:'opaque late caller'});let resolveFetch,cancels=0,reads=0
 const transport=createUnosecurPublicRead({signal:controller.signal,minIntervalMs:0,fetchImpl:()=>new Promise(resolve=>{resolveFetch=resolve})},[])
 try{
  const pending=transport.read(CAREERS);await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
  await assert.rejects(pending,error=>error===reason)
  resolveFetch(response({read:()=>reads++,cancel:()=>cancels++}));await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(cancels,1);assert.equal(reads,0)
 }finally{transport.close()}
})

const registered=fixture.registeredCapture,expected=registered.expectedJobsExceptDuplicatedCollectionAudit
async function registeredReplay(transform=(packet)=>packet){
 let at=0
 const fetchImpl=async(url,options={})=>{
  const packet=structuredClone(registered.packets[at++]);assert.ok(packet,'no extra native request')
  assert.equal(url,packet.requestedUrl);assert.equal(options.method,'GET')
  return nativeResponse(transform(packet,at-1))
 }
 const provider=getScraperCatalog().find(row=>row.source==='unosecur')
 const jobs=await createCatalogScraper(provider).run({fetchImpl,minIntervalMs:0,now:expected[0].scrapedAt})
 assert.equal(at,40);return jobs
}
test('complete genuine40response registered replay retains every job field and raw opening/closing body with all current authority holds',async()=>{
 const jobs=await registeredReplay()
 assert.deepEqual(jobs.map(job=>Object.fromEntries(Object.entries(job).filter(([key])=>key!=='sourceNativeCollectionAudit'))),expected)
 assert.equal(jobs.length,9);assert.equal(jobs.filter(job=>job.country==='India').length,4)
 for(const job of jobs){
  assert.deepEqual(job.nativeSourceRecord,job.nativeClosingRecord)
  for(const key of ['sourceDetailComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceAvailabilityVerified','sourcePublicContextValidated','sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed'])assert.equal(job[key],false,key)
  assert.equal(job.sourceRawNativeClientJS,currentSource);assert.equal(job.sourceClosingRawNativeClientJS,currentSource)
  assert.equal(createHash('sha256').update(job.sourceRawNativeAPIJSON).digest('hex'),job.sourceRawNativeAPIJSONSHA256)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(readSourceObservationEvidence(jobs,'unosecur'),{source:'unosecur',recordKind:'vacancy-rows',observedRecordCount:9,observedVacancyCount:9,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})
const india=expected.find(job=>job.country==='India')
for(const [label,change]of [
 ['null API countries',(record)=>{for(const location of record.api.data.requisition.locations){location.country=null;location.country_code=null}}],
 ['contradictory API country',(record)=>{for(const location of record.api.data.requisition.locations){location.country='Germany';location.country_code='DE'}}],
 ['additional foreign applicant alternative',(record)=>{record.role.jobPosting.applicantLocationRequirements=[{name:'India'},{name:'Germany'}]}],
 ['additional foreign workplace prose',(record)=>{record.api.data.requisition.job_description+='<p>Work location: Berlin, Germany.</p>';record.role.jobPosting.description=record.api.data.requisition.job_description}],
])test('current passive data '+label+' stays unknown without country inference and retains full native criteria',()=>{
 const record=structuredClone(india.nativeSourceRecord);change(record)
 const job=makeJob(JSON.stringify(record.api),record.listing,record.role,record.careers,record.client,india.scrapedAt)
 assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.location,null)
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.deepEqual(job.nativeSourceRecord.api,record.api);assert.deepEqual(job.nativeSourceRecord.role,record.role)
})
test('whole closing native context drift holds the affected current role with complete opening and closing records',async()=>{
 const jobs=await registeredReplay((packet,index)=>{
  if(index===39){const data=JSON.parse(packet.body);data.data.requisition.title+=' changed internal native title';packet.body=JSON.stringify(data)}
  return packet
 })
 assert.equal(jobs.length,8)
 const held=jobs[0].sourceNativeCollectionAudit.heldNativeRows
 assert.equal(held.length,1);assert.equal(held[0].phase,'closing-role')
 assert.equal(held[0].reason,'closing whole role/API model changed')
 assert.deepEqual(JSON.parse(held[0].opening.rawAPIJSON),expected.at(-1).nativeSourceRecord.api)
 assert.match(held[0].closing.nativeRecord.api.data.requisition.title,/ changed internal native title$/)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('complete current role-declared CSS and vendor bodies remain retained and explicitly unqualified for browser execution',()=>{
 const assets=fixture.unqualifiedDeclaredAssets
 assert.equal(assets.provenance.publisherJavaScriptExecuted,false);assert.equal(assets.provenance.validCurrentCheck,false)
 assert.equal(assets.packets.length,2)
 assert.equal(assets.packets.reduce((sum,packet)=>sum+Buffer.byteLength(packet.body),0),3041819)
 for(const packet of assets.packets){assert.equal(packet.status,200);assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)}
 assert.match(prefix[1].body,/8\.bbe2e969\.chunk\.js/);assert.match(prefix[1].body,/main\.1bd59795\.chunk\.css/)
})
