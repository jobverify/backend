import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const originalFetch=globalThis.fetch
const inactive=()=>{throw Error('Offline registered control has no active native transport')}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// The dispatcher exists before registry imports, including any cached fetch
// reference used by legacy recovery. The preload blocks every other network IO.
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261121.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const source='shivaamicloudservices',career='https://www.shivaami.com/assets/Careers-wCyxQTtJ.js'
const provider=getScraperCatalog().find(row=>row.source===source);assert.ok(provider)
const metadataPath='scraper-support/providers/customProviders.json',metadataSHA256=sha(fs.readFileSync(metadataPath))
const observations=[]
async function registered(changedCountry=false){
 const calls=[];let rejectionPacketReturned=false
 transport=async(value,init={})=>{
  const url=String(value),packet=fixture.packets.find(row=>row.requestedURL===url)
  const sourceOwned=!rejectionPacketReturned&&init.redirect==='manual'&&init.credentials==='omit'&&Boolean(packet)
  calls.push({url,method:init.method??'GET',redirect:init.redirect??null,credentials:init.credentials??null,sourceOwned})
  if(!sourceOwned)throw Object.assign(Error('Offline control prohibits generic recovery after strict native rejection'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  let bytes=Buffer.from(packet.bodyBase64,'base64')
  if(changedCountry&&url===career){const updated=Buffer.from(bytes.toString('utf8').replace('Mumbai, India','Mumbai, Nepal'));assert.notEqual(sha(updated),sha(bytes));bytes=updated;rejectionPacketReturned=true}
  const response=new Response(bytes,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 let jobs,error
 try{jobs=await createCatalogScraper(provider).run({signal:AbortSignal.timeout(20000)})}catch(caught){error=caught}finally{transport=inactive}
 const record={changedCountry,calls,sourceOwnedCalls:calls.filter(row=>row.sourceOwned).length,genericRecoveryCalls:calls.filter(row=>!row.sourceOwned).length,returnedJobs:jobs?.length??null,error:error?{name:error.name,message:error.message}:null,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null}
 observations.push(record);return{...record,jobs,error}
}
test('actual registered default current deployment preserves full native India roles and inventory holds',async()=>{
 const result=await registered();assert.ifError(result.error);assert.equal(result.jobs.length,3);assert.equal(result.sourceOwnedCalls,20);assert.equal(result.genericRecoveryCalls,0)
 for(const row of result.jobs){assert.equal(row.country,'India');assert.equal(row.location,'Mumbai, India');assert.ok(row.jobDescription.includes(row.sourceNativeRole.description));assert.equal(row.postingDate,null);assert.equal(row.sourceScopeComplete,false);assert.equal(row.sourceListingComplete,false);assert.equal(row.lifecycleCleanupAllowed,false);assert.equal(row.sourceRenderedApplicationQualified,false)}
 assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)
})
test('actual registered default does not enter generic recovery after native country rejection',async()=>{
 const result=await registered(true);assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.sourceOwnedCalls,4)
 assert.equal(result.genericRecoveryCalls,0,'Strict current-native country rejection must retain the source hold')
})
test.after(()=>{
 const metadata=fs.readFileSync(metadataPath),afterSHA256=sha(metadata),rows=[]
 const visit=(value,path=[])=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&value.source===source)rows.push({path,record:value});for(const[key,child]of Object.entries(value))if(child&&typeof child==='object')visit(child,[...path,Array.isArray(value)?Number(key):key])}
 visit(JSON.parse(metadata))
 const directory=process.env.SHIVAAMI_REVIEW_OUTPUT??'reports/scraper-20261120-133018/agent2/shivaami-current/registered-controls'
 fs.mkdirSync(directory,{recursive:true})
 fs.writeFileSync(directory+'/result.json',JSON.stringify({assessedAt:new Date().toISOString(),source,mode:'actual registered default global-fetch transport replay',unmockedNetworkBlockedBeforeImports:true,fetchDispatcherInstalledBeforeRegistryImports:true,physicalHTTPRequests:0,defaultTransportInterceptedAtGlobalFetch:true,provider:{source:provider.source,modulePath:provider.modulePath,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null},metadata:{path:metadataPath,beforeSHA256:metadataSHA256,afterSHA256,stable:afterSHA256===metadataSHA256,matchingSourceRows:rows},observations},null,2)+'\n')
 globalThis.fetch=originalFetch
 assert.equal(afterSHA256,metadataSHA256)
})
