import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-data-20261121.json.gz',import.meta.url))))
const RealDate=Date,originalFetch=globalThis.fetch,inactive=()=>{throw Error('Only exact retained JK native originals are permitted')}
// The clock replays expired signed read URLs at their original acquisition time.
// It changes no publisher bytes and permits no physical network request.
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixture.observedAt]))}static now(){return RealDate.parse(fixture.observedAt)}}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// Preimport transport installation is intentional. Registered calls below pass
// only signal; callbacks/fetchImpl options would disable generic recovery.
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence,sourceLifecycleCleanupForbidden}=await import('../../scraper-support/utils/inventoryEvidence.js')
const {inventoryCleanupOptions}=await import('../../scraper-support/utils/scraperOutcome.js')
const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
const {extractionDetailHealth}=await import('../../scraper-support/utils/extractionDetailHealth.js')
const provider=getScraperCatalog().find(row=>row.source==='jkfennerindialtd');assert.ok(provider)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),metadata='scraper-support/providers/customProviders.json',beforeSHA256=sha(fs.readFileSync(metadata)),observations=[]
const details=fixture.packets.filter(p=>p.phase==='native-details'),carriers=fixture.packets.filter(p=>p.phase==='native-criteria-carriers')

async function registered(mode){
 const calls=[],occurrences=new Map();let rejected=false,nativeComplete=false
 transport=async(value,init={})=>{
  const url=String(value),method=init.method??'GET',packet=fixture.packets.find(row=>row.url===url&&row.method===method)
  const sourceOwned=!rejected&&!nativeComplete&&init.redirect==='manual'&&init.credentials==='omit'&&Boolean(packet)
  calls.push({url,method,sourceOwned,redirect:init.redirect??null})
  if(!sourceOwned)throw Object.assign(Error('Current native hold forbids generic or unbound recovery'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  if(method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(packet.requestBody))
  let bytes=Buffer.from(packet.bodyBase64,'base64'),status=packet.status;assert.equal(sha(bytes),packet.sha256)
  const occurrence=(occurrences.get(url)??0)+1;occurrences.set(url,occurrence)
  if(mode==='authority-drift'&&url===fixture.packets[0].url){bytes=Buffer.concat([bytes,Buffer.from('<p>All applications are closed.</p>')]);rejected=true}
  if(mode==='detail-denial'&&url===details[0].url){status=403;rejected=true}
  if(mode==='all-models-held'&&packet.phase==='native-details'){const json=JSON.parse(bytes);json.data.positionDetails.krAsAndKPIs.htmlText+='<p>Unreviewed mandatory qualification.</p>';bytes=Buffer.from(JSON.stringify(json))}
  if(occurrence===2&&url===(mode==='all-models-held'?details[1].url:carriers[1].url))nativeComplete=true
  const response=new Response(bytes,{status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
 let jobs,error
 try{jobs=await createCatalogScraper(provider).run({signal:AbortSignal.timeout(25000)})}catch(caught){error=caught}finally{transport=inactive}
 const observation={mode,callerOptionKeys:['signal'],replayClock:fixture.observedAt,originalOpeningOnly:true,closingSimulatedByOriginalPacketReplay:true,physicalHTTPRequests:0,sourceOwnedCalls:calls.filter(row=>row.sourceOwned).length,genericRecoveryCalls:calls.filter(row=>!row.sourceOwned).length,calls,returnedJobs:jobs?.length??null,error:error?{name:error.name,message:error.message}:null,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null,companyGlobalTotal:null,companyIndiaTotal:null}
 if(jobs){const analysis=analyzePublishableJobs(jobs);observation.indiaFilteredJobs=analysis.indiaJobs.length;observation.eligibleFilteredJobs=analysis.eligibleJobs.length;observation.inventoryEvidence=readInventoryEvidence(jobs);observation.cleanupForbidden=sourceLifecycleCleanupForbidden(jobs);observation.detailHealth=extractionDetailHealth(analysis.indiaJobs);observation.cleanupOptions=inventoryCleanupOptions({rawRecords:jobs.length,jobs:analysis.indiaJobs.length,eligibleJobs:analysis.eligibleJobs.length,inventoryEvidence:observation.inventoryEvidence,detailHealth:observation.detailHealth})}
 observations.push(observation);return{...observation,jobs,error}
}

test('actual signal-only registered native originals retain2full models, unknown country and effective lifecycle hold',async()=>{
 const result=await registered('originals');assert.ifError(result.error);assert.equal(result.jobs.length,2);assert.equal(result.sourceOwnedCalls,30);assert.equal(result.genericRecoveryCalls,0)
 assert.equal(result.indiaFilteredJobs,0);assert.equal(result.eligibleFilteredJobs,0);assert.equal(result.cleanupForbidden,true);assert.deepEqual(result.cleanupOptions,{replaceExisting:false})
 assert.equal(result.inventoryEvidence.lifecycleCleanupAllowed,false);assert.equal(result.inventoryEvidence.listingComplete,false)
 for(const job of result.jobs){assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.applyUrl,null);assert.equal(job.sourceDetailComplete,false);assert.ok(job.jobDescription)}
})

for(const[mode,expected]of[['authority-drift',1],['detail-denial',12]])test('actual signal-only registered '+mode+' preserves native rejection without generic recovery',async()=>{
 const result=await registered(mode);assert.ok(result.error);assert.equal(result.sourceOwnedCalls,expected);assert.equal(result.genericRecoveryCalls,0,'Native authority/access hold must not re-enter generic extraction')
})

test('actual signal-only registered all-held models preserve source evidence and cleanup prohibition without fallback',async()=>{
 const result=await registered('all-models-held');assert.ifError(result.error);assert.equal(result.sourceOwnedCalls,26);assert.equal(result.genericRecoveryCalls,0)
 assert.equal(result.jobs.length,0);assert.equal(result.jobs.nativeCollectionEvidence.openingNativeRows,2);assert.equal(result.jobs.nativeCollectionEvidence.heldRecords.length,2)
 assert.equal(result.cleanupForbidden,true);assert.deepEqual(result.cleanupOptions,{replaceExisting:false});assert.equal(result.inventoryEvidence.status,'coverage-gap')
})

test.after(()=>{
 globalThis.fetch=originalFetch;globalThis.Date=RealDate
 const afterSHA256=sha(fs.readFileSync(metadata)),output=process.env.JKFENNER_REGISTERED_RESULT
 if(output)fs.writeFileSync(output,JSON.stringify({source:'jkfennerindialtd',assessedAt:new RealDate().toISOString(),mode:'actual stock registered default, signal-only; zero-network original-body replay with original acquisition clock',metadata:{path:metadata,beforeSHA256,afterSHA256},provider:{source:provider.source,modulePath:provider.modulePath,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null},observations},null,2)+'\n')
 assert.equal(afterSHA256,beforeSHA256)
})
