import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {nativeFixture} from '../bizongo/nativeFixture.js'
const originalFetch=globalThis.fetch
const inactive=()=>{throw Error('Offline registered control has no active native transport')}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// Install before registry imports so legacy readers cannot escape observation.
// The preload blocks all other network IO, including before these imports.
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-declared-client-20261121.json.gz',import.meta.url))))
const legacy=nativeFixture(import.meta.url),sha=value=>createHash('sha256').update(value).digest('hex')
const source='brihaspathi',careers='https://brihaspathi.com/careers',metadataPath='scraper-support/providers/customProviders.json'
const provider=getScraperCatalog().find(row=>row.source===source);assert.ok(provider)
const metadataSHA256=sha(fs.readFileSync(metadataPath)),observations=[]
async function registered(changedDocument=false,missingClient=false){
 const calls=[];let rejected=false
 transport=async(value,init={})=>{
  const url=String(value),packet=url===careers?current.packets[0]:url===current.currentOwnerPacket.requestedURL?current.currentOwnerPacket:legacy.rows.findLast(row=>row.requestedUrl===url||row.finalUrl===url)
  const sourceOwned=!rejected&&init.redirect==='manual'&&Boolean(packet)
  calls.push({url,method:init.method??'GET',redirect:init.redirect??null,credentials:init.credentials??null,sourceOwned})
  if(!sourceOwned)throw Object.assign(Error('Offline control prohibits generic recovery after strict native rejection'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  let bytes=packet.bodyBase64?Buffer.from(packet.bodyBase64,'base64'):Buffer.from(packet.html)
  if(changedDocument&&url===careers){bytes=Buffer.concat([bytes,Buffer.from('<!-- unreviewed current source authority -->')]);rejected=true}
  let status=packet.status
  if(missingClient&&url===current.currentOwnerPacket.requestedURL){const original404=current.packets.find(row=>row.status===404);assert.ok(original404);bytes=Buffer.from(original404.bodyBase64,'base64');status=404;rejected=true}
  const response=new Response(bytes,{status,headers:packet.headers??{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.url??packet.finalURL??packet.finalUrl});return response
 }
 let jobs,error
 try{jobs=await createCatalogScraper(provider).run({signal:AbortSignal.timeout(20000)})}catch(caught){error=caught}finally{transport=inactive}
 const result={changedDocument,missingClient,calls,sourceOwnedCalls:calls.filter(row=>row.sourceOwned).length,genericRecoveryCalls:calls.filter(row=>!row.sourceOwned).length,returnedJobs:jobs?.length??null,error:error?{name:error.name,message:error.message,code:error.code??null}:null,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null}
 observations.push(result);return{...result,jobs,error}
}

test('actual registered default replays current declared client with only historical zero-enumeration semantics',async()=>{
 const result=await registered();assert.ifError(result.error);assert.equal(result.jobs.length,0);assert.equal(result.sourceOwnedCalls,6);assert.equal(result.genericRecoveryCalls,0)
 assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(result.jobs).listingComplete,true)
})

test('actual registered default preserves native current-authority rejection without generic recovery',async()=>{
 const result=await registered(true);assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.sourceOwnedCalls,1)
 assert.equal(result.genericRecoveryCalls,0,'Unreviewed native current authority must retain the strict source hold')
})

test('actual registered default preserves a missing reviewed current client hold without generic recovery',async()=>{
 const result=await registered(false,true);assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.sourceOwnedCalls,2)
 assert.equal(result.genericRecoveryCalls,0,'A missing reviewed native dependency must not re-enter generic company extraction')
})

test.after(()=>{
 const metadata=fs.readFileSync(metadataPath),afterSHA256=sha(metadata),rows=[]
 const visit=(value,path=[])=>{if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&value.source===source)rows.push({path,record:value});for(const[key,child]of Object.entries(value))if(child&&typeof child==='object')visit(child,[...path,Array.isArray(value)?Number(key):key])}
 visit(JSON.parse(metadata))
 const directory=process.env.BRIHASPATHI_REVIEW_OUTPUT??'reports/scraper-20261120-133018/agent2/brihaspathi-current/registered-controls'
 fs.mkdirSync(directory,{recursive:true})
 fs.writeFileSync(directory+'/result.json',JSON.stringify({assessedAt:new Date().toISOString(),source,mode:'actual registered default global-fetch transport replay; historical zero API packet is not current inventory proof',runOptionKeys:['signal'],unmockedNetworkBlockedBeforeImports:true,fetchDispatcherInstalledBeforeRegistryImports:true,physicalHTTPRequests:0,provider:{source:provider.source,modulePath:provider.modulePath,authoritativeCurrentPublication:provider.authoritativeCurrentPublication??null},metadata:{path:metadataPath,beforeSHA256:metadataSHA256,afterSHA256,stable:metadataSHA256===afterSHA256,matchingSourceRows:rows},observations},null,2)+'\n')
 globalThis.fetch=originalFetch;assert.equal(afterSHA256,metadataSHA256)
})
