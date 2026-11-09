import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../../../scraper-support/utils/sourceObservationEvidence.js'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function replayGenuineRegisteredDefault(){
 const root=new URL('./',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),read=record=>{
  const bytes=gunzipSync(readFileSync(new URL(record.bodyFile??record.file,root)))
  assert.equal(bytes.length,record.bytes??record.bodyBytes);assert.equal(sha(bytes),record.sha256??record.bodySHA256);return bytes
 },packets=manifest.records.map(record=>({...record,bytes:read(record)})),original=JSON.parse(read(manifest.originalFullOutput))
 assert.equal(packets.length,8);assert.equal(manifest.fixtureProvenance.closingReadsActuallyCaptured,true)
 const priorFetch=globalThis.fetch,calls=[]
 globalThis.fetch=async(input,init)=>{
  assert.ok(init.signal instanceof AbortSignal);init.signal.throwIfAborted()
  const row=packets[calls.length];assert.ok(row,'No unrecorded ninth request')
  const actual={url:String(input),method:init.method,redirect:init.redirect,credentials:init.credentials,referrerPolicy:init.referrerPolicy,requestHeaders:Object.fromEntries(new Headers(init.headers))}
  const expected=Object.fromEntries(Object.keys(actual).map(key=>[key,row[key]]));assert.deepEqual(actual,expected);assert.equal(init.body,undefined);calls.push(actual)
  const response=new Response(row.bytes,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response
 }
 let jobs
 try{const provider=getScraperCatalog().find(row=>row.source==='langchain');assert.ok(provider);jobs=await createCatalogScraper(provider).run()}
 finally{globalThis.fetch=priorFetch}
 assert.equal(calls.length,8)
 const replay=JSON.parse(JSON.stringify({jobs,audit:jobs[Symbol.for('jobverify.verified-recruitment-observations')],inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'langchain')}))
 const ignoredRuntimeFields=[]
 function normalizeClocks(value){
  const out=structuredClone(value),audit=out.audit.nativeInventoryAudit
  for(const key of ['executionStartedAt','executionCompletedAt','physicalAcquisitionStartedAt','physicalAcquisitionCompletedAt']){
   assert.ok(Number.isFinite(Date.parse(audit[key])));audit[key]='<runtime clock>';if(!ignoredRuntimeFields.includes('audit.nativeInventoryAudit.'+key))ignoredRuntimeFields.push('audit.nativeInventoryAudit.'+key)
  }
  audit.retainedResponses.forEach((row,index)=>{for(const key of ['sourceRequestedAt','sourceCompletedAt']){
   assert.ok(Number.isFinite(Date.parse(row[key])));row[key]='<runtime clock>';const path=`audit.nativeInventoryAudit.retainedResponses[${index}].${key}`;if(!ignoredRuntimeFields.includes(path))ignoredRuntimeFields.push(path)
  }})
  assert.ok(Number.isFinite(Date.parse(out.inventory.verifiedAt)));out.inventory.verifiedAt='<runtime clock>';if(!ignoredRuntimeFields.includes('inventory.verifiedAt'))ignoredRuntimeFields.push('inventory.verifiedAt')
  return out
 }
 assert.deepEqual(normalizeClocks(replay),normalizeClocks(original))
 const audit=replay.audit.nativeInventoryAudit
 assert.equal(audit.fullNativeModels.length,99);assert.equal(audit.countryRelations.inspected,128);assert.equal(audit.countryRelations.worksiteUnresolved,2)
 assert.equal(audit.allRoleDetailHealth.contentComplete,true);assert.equal(audit.allRoleDetailHealth.missingCriteria,0)
 assert.equal(audit.configuredBoardInventoryComplete,false);assert.equal(audit.configuredBoardIndiaCount,null);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(jobs.length,0)
 const payload=JSON.parse(packets[4].bytes.toString('utf8'))
 assert.deepEqual(audit.fullNativeModels.map(model=>model.nativeSourceRecord),payload.jobs)
 for(let index=0;index<8;index++){assert.equal(audit.retainedResponses[index].bodySHA256,packets[index].bodySHA256);assert.equal(audit.retainedResponses[index].bodyBytes,packets[index].bodyBytes)}
 return{source:'langchain',mode:'offline exact8 original response replay through registered DEFAULT .run() and global request init',networkRequests:0,replayedOriginalRequests:calls.length,allOriginalResponseBytes:packets.reduce((n,row)=>n+row.bodyBytes,0),allRequestIdentityAndInitExact:true,entireSerializedOutputEqualExceptExplicitClocks:true,originalFullOutputBytes:manifest.originalFullOutput.bytes,originalFullOutputSHA256:manifest.originalFullOutput.sha256,ignoredRuntimeFields,ignoredRoleOrBusinessFields:[],retainedNativeModels:99,typedCountryRelations:audit.countryRelations,allCriteriaPresent:true,returnedIndiaJobs:0,configuredBoardIndiaCount:null,configuredBoardComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,originalPhysicalAcquisitionStartedAt:original.audit.nativeInventoryAudit.physicalAcquisitionStartedAt,originalPhysicalAcquisitionCompletedAt:original.audit.nativeInventoryAudit.physicalAcquisitionCompletedAt,replayExecutionIsNotFreshAcquisition:true}
}
