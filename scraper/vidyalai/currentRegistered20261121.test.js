import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const originalFetch=globalThis.fetch,inactive=()=>{throw Error('No unmocked current registered network is permitted')}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// Global interception precedes registry imports; source runs get only signal.
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence,sourceLifecycleCleanupForbidden}=await import('../../scraper-support/utils/inventoryEvidence.js')
const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
const {inventoryCleanupOptions}=await import('../../scraper-support/utils/scraperOutcome.js')
const {extractionDetailHealth}=await import('../../scraper-support/utils/extractionDetailHealth.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261121.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='vidyalai');assert.ok(provider)
const metadataPath='scraper-support/providers/customProviders.json',sha=bytes=>createHash('sha256').update(bytes).digest('hex'),beforeSHA256=sha(fs.readFileSync(metadataPath)),observations=[]
async function registered(mode){
 const calls=[];let rejected=false
 transport=async(value,init={})=>{
  const url=String(value),packet=fixture.packets.find(row=>row.url===url),sourceOwned=!rejected&&init.redirect==='manual'&&init.credentials==='omit'&&Boolean(packet)
  calls.push({url,method:init.method??'GET',redirect:init.redirect??null,sourceOwned})
  if(!sourceOwned)throw Object.assign(Error('Offline control prohibits generic extraction after current native hold'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  let body=Buffer.from(packet.bodyBase64,'base64'),status=packet.status
  if(mode==='authority-drift'&&url===fixture.packets[0].url){body=Buffer.concat([body,Buffer.from('<!-- current native authority changed -->')]);rejected=true}
  if(mode==='missing-declared-role'&&url===fixture.packets[3].url){status=404;rejected=true}
  const response=new Response(body,{status,headers:packet.headers});Object.defineProperty(response,'url',{value:url});return response
 }
 let jobs,error
 try{jobs=await createCatalogScraper(provider).run({signal:AbortSignal.timeout(25000)})}catch(caught){error=caught}finally{transport=inactive}
 const observation={mode,runOptionKeys:['signal'],sourceOwnedCalls:calls.filter(row=>row.sourceOwned).length,genericRecoveryCalls:calls.filter(row=>!row.sourceOwned).length,calls,returnedJobs:jobs?.length??null,error:error?{name:error.name,message:error.message}:null,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null}
 observation.nativeIndiaInventoryTotal=null;observation.nativeEligibleInventoryTotal=null
 if(jobs){const analysis=analyzePublishableJobs(jobs);observation.operationalFilteredIndiaJobs=analysis.indiaJobs.length;observation.operationalEligibleJobs=analysis.eligibleJobs.length;observation.inventoryEvidence=readInventoryEvidence(jobs);observation.lifecycleForbidden=sourceLifecycleCleanupForbidden(jobs);observation.cleanupOptions=inventoryCleanupOptions({inventoryEvidence:observation.inventoryEvidence,detailHealth:extractionDetailHealth(analysis.indiaJobs)})}
 observations.push(observation);return{...observation,jobs,error}
}
test('actual signal-only current registered data retains all16full criteria and no inferred India or cleanup authority',async()=>{
 const result=await registered('originals');assert.ifError(result.error);assert.equal(result.jobs.length,16);assert.equal(result.sourceOwnedCalls,36);assert.equal(result.genericRecoveryCalls,0)
 assert.equal(result.operationalFilteredIndiaJobs,0);assert.equal(result.operationalEligibleJobs,0);assert.equal(result.lifecycleForbidden,true);assert.deepEqual(result.cleanupOptions,{replaceExisting:false})
 assert.equal(result.inventoryEvidence.status,'coverage-gap');assert.equal(result.inventoryEvidence.lifecycleCleanupAllowed,false);assert.equal(result.jobs.nativeCollectionEvidence.nativePayload.length,16)
 for(const job of result.jobs){assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.link,null);assert.equal(job.applyUrl,null);assert.ok(job.jobDescription)}
})
for(const[mode,expected]of[['authority-drift',1],['missing-declared-role',3]])test('actual signal-only registered '+mode+' must retain native rejection without generic recovery',async()=>{
 const result=await registered(mode);assert.ok(result.error);assert.equal(result.sourceOwnedCalls,expected);assert.equal(result.genericRecoveryCalls,0,'Current native hold must not re-enter generic country/criteria extraction')
})
test.after(()=>{
 globalThis.fetch=originalFetch
 const afterSHA256=sha(fs.readFileSync(metadataPath)),directory=process.env.VIDYALAI_REVIEW_OUTPUT
 if(directory){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/result.json',JSON.stringify({assessedAt:new Date().toISOString(),source:'vidyalai',mode:'actual stock signal-only registered default; global transport original replay; no onAudit/fetchImpl source options',physicalHTTPRequests:0,metadata:{path:metadataPath,beforeSHA256,afterSHA256},provider:{source:provider.source,modulePath:provider.modulePath,parser:provider.parser,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null},observations},null,2)+'\n')}
 assert.equal(afterSHA256,beforeSHA256)
})
