import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence,readInventoryEvidence,isFreshCompleteInventoryEvidence} from './inventoryEvidence.js'

const gap=(source,message)=>Object.assign(new Error(`[${source}] Current programme: ${message}`),{
  softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',
})
const nativeAudit=jobs=>Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence')?.value
const payload=audit=>Object.getOwnPropertyDescriptor(audit||{},'nativePayload')
const boundedWait=(operation,signal)=>new Promise((resolve,reject)=>{
  let settled=false
  const finish=(callback,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);callback(value)}
  const abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true})
  if(signal.aborted){abort();return}
  Promise.resolve().then(()=>settled?undefined:operation()).then(value=>finish(resolve,value),error=>finish(reject,error))
})

// A narrow second proof after an existing reader has actually returned no
// India jobs. Existing positives and primary errors keep their original path.
// The independently acquired finite programme must reconcile the earlier full
// native response; a changed criterion or country cannot disappear between them.
export async function runWithCurrentProgrammeZero(options={},configuration){
  const {source,runPrimary,runProgramme,maxSourceTimeoutMs=120000}=configuration
  const timeout=options.sourceTimeoutMs??90000
  if(!Number.isSafeInteger(timeout)||timeout<1||timeout>maxSourceTimeoutMs)throw RangeError('Invalid current programme source deadline')
  options.signal?.throwIfAborted()
  const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  const started=performance.now(),timer=setTimeout(()=>controller.abort(new DOMException('Current programme source deadline exceeded','TimeoutError')),timeout)
  const checkDeadline=()=>{
    signal.throwIfAborted()
    if(performance.now()-started>=timeout){controller.abort(new DOMException('Current programme source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
  }
  try{
    checkDeadline()
    const primary=await boundedWait(()=>runPrimary({...options,signal}),signal)
    checkDeadline()
    if(primary.length)return primary
    const prior=nativeAudit(primary),priorPayload=payload(prior)
    if(!priorPayload||!Object.hasOwn(priorPayload,'value'))throw gap(source,'Earlier original native response unavailable')
    const remaining=Math.floor(timeout-(performance.now()-started))
    if(remaining<1)throw gap(source,'No closing transaction deadline remains')
    const jobs=await boundedWait(()=>runProgramme({...options,signal,sourceTimeoutMs:remaining,onAudit:undefined}),signal)
    checkDeadline()
    const audit=nativeAudit(jobs),currentPayload=payload(audit),inventory=readInventoryEvidence(jobs)
    if(jobs.length||!audit||audit.source!==source||!currentPayload||!Object.hasOwn(currentPayload,'value')
      ||!isFreshCompleteInventoryEvidence(inventory)||inventory.firstParty!==true||inventory.lifecycleCleanupAllowed!==false
      ||audit.sourceScopeComplete!==false||audit.companyGlobalScopeQualified!==false)throw gap(source,'Finite programme qualification unavailable')
    const bridge={source,nativePayload:structuredClone(priorPayload.value),inventoryEvidence:readInventoryEvidence(primary),
      officialDiscovery:primary[Symbol.for('jobverify.official-ats-discovery')]??null,
      publicRequestCount:null,requestCountLimit:'The legacy transport may retry or probe optional assets; its total is unmeasured.'}
    const reconciled=isDeepStrictEqual(priorPayload.value,currentPayload.value)
    const combined={...audit,priorNativeObservation:bridge,priorNativePayloadReconciled:reconciled,
      programmeRequestCount:audit.requests??audit.nativeProgrammeRequests??audit.receipts?.length??audit.rawPages?.length??null,totalPublicRequests:null,
      requestCountScope:'Complete native programme transaction only; prior legacy transport is separately unmeasured.'}
    if(!reconciled){
      const error=gap(source,'Earlier native criteria, identities or countries changed before the programme proof')
      Object.defineProperty(error,'nativeCollectionEvidence',{value:combined,configurable:true});throw error
    }
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:combined,configurable:true})
    if(options.onAudit)await boundedWait(()=>options.onAudit(structuredClone(combined)),signal)
    checkDeadline()
    return attachInventoryEvidence(jobs,{...inventory,reason:inventory.reason+';prior-native-payload-reconciled;request-count-native-programme-only'})
  }finally{clearTimeout(timer)}
}
