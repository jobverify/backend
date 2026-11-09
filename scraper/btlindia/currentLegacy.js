import {collect} from './native.js'
import {readNativePdf} from './nativePdf.js'
import {transport,cap,budget} from './currentTransport.js'
import {runCurrentBtl} from './currentReader.js'
import {CAREERS,need,failure,isFailure} from './currentDeclarations.js'
import {readInventoryEvidence,attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence,attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export async function runLegacyBtl(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap');for(const k of ['onAudit','onRecords'])if(options[k]!==undefined&&typeof options[k]!=='function')throw TypeError('BTL India native invalid '+k)
 if(maxJobs===0||maxPages===0)return runCurrentBtl(options)
 const io=transport(options),{control}=io,readMs=budget(options.readTimeoutMs,15000,'read timeout'),attempts=[];let total=0
 const bounded=(kind,fn)=>async(url,init={})=>control.gate(async()=>{
  control.check();const address=new URL(url);need(attempts.length<128&&(kind==='html'?url===CAREERS:address.origin==='https://www.btlnet.co.in'&&/^\/admin\/image\/career\/[^/?#]+\.pdf$/i.test(address.pathname)&&!address.search&&!address.hash),'unadmitted or excessive text compatibility read')
  const attempt={url,kind,startedAt:new Date().toISOString(),originalByteEvidenceQualified:false};attempts.push(attempt)
  try{const value=await fn(url,{...init,signal:control.signal});control.check();need(kind==='html'?typeof value==='string':Buffer.isBuffer(value)||value instanceof Uint8Array,'invalid text compatibility adapter value');const length=kind==='html'?Buffer.byteLength(value):value.byteLength;total+=length;need(length>0&&length<=4*1024*1024&&total<=32*1024*1024,'empty or oversized text compatibility input');attempt.bodyBytes=length;return kind==='html'?value:Buffer.from(value)}
  catch(error){if(options.signal?.aborted)throw options.signal.reason;if(control.signal.aborted)throw control.signal.reason;if(isFailure(error))throw error;const wrapped=failure('text compatibility read failed');Object.defineProperty(wrapped,'cause',{value:error});attempt.error=wrapped.message;throw wrapped}
  finally{attempt.completedAt=new Date().toISOString()}
 },readMs,'read/body')
 try{
  control.check();const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now,time=new Date(clock).getTime();need(Number.isFinite(time),'invalid observation clock');const at=new Date(time).toISOString()
  const all=await collect({...options,now:()=>at,signal:control.signal,fetchText:bounded('html',options.fetchText),fetchPdf:bounded('pdf',options.fetchPdf||(async url=>{io.allow(url);return(await io.read(url,'pdf')).bytes})),decodePdf:(bytes,init)=>io.decode(()=>readNativePdf(bytes,init))});control.check()
  for(const job of all)Object.assign(job,{nativeOriginalByteEvidenceQualified:false,nativeModelClosingReconciled:false,fullNativeAuthoredDocumentAvailable:false,fullNativeAuthoredCriteriaAvailable:false,nativeCriteriaVisibilityQualified:false,nativeCriteriaComplete:false,sourceDetailComplete:false,sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,jobSpecificApplicationIdentityQualified:false,applicationVisited:false,activeApplyVerified:false})
  const heldRecords=all.map(job=>({title:job.title,reason:job.sourceDetailFailureKind,country:job.country??null,sourceScopeComplete:false})),audit={source:'btlindia',records:all,heldRecords,nativeObservedRecords:all.length,originalResponses:structuredClone(io.originals),compatibilityAttempts:attempts,nativeOriginalByteEvidenceQualified:false,wholeNativeModelsClosingReconciled:false,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,qualifiedIndiaRecords:0}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)));if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(all)));control.check()
  const jobs=all.slice(0,maxJobs);attachInventoryEvidence(jobs,readInventoryEvidence(all));attachSourceObservationEvidence(jobs,readSourceObservationEvidence(all,'btlindia'));Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone({...all.nativeCollectionEvidence,nativeOriginalByteEvidenceQualified:false,wholeNativeModelsClosingReconciled:false,compatibilityAttempts:attempts})});return jobs
 }catch(error){let candidate=error;if(!options.signal?.aborted&&!control.signal.aborted&&!isFailure(error)){candidate=failure('text compatibility contract failed');Object.defineProperty(candidate,'cause',{value:error})}const reason=control.fail(candidate);if(!options.signal?.aborted&&isFailure(reason)){io.attachFailure(reason);Object.defineProperty(reason,'nativeCompatibilityAttempts',{value:structuredClone(attempts)})}throw reason}finally{control.dispose()}
}
