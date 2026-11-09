import { setTimeout as delay } from 'node:timers/promises'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CAREERS_URL, canonical, inspectNativeInventory, sha256 } from './nativeContract.js'

const check = (ok,message) => { if (!ok) throw Error('Brainvire current native inventory: '+message) }
const bounded = (operation,signal) => new Promise((resolve,reject) => {
  const cleanup=()=>signal.removeEventListener('abort',abort)
  const abort=()=>{cleanup();reject(signal.reason || Error('Brainvire request aborted'))}
  if(signal.aborted){abort();return}
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(operation).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})
})
export async function runNativeBrainvire(options={}) {
  const maxJobs=options.maxJobs ?? Infinity, timeoutMs=options.timeoutMs ?? 45000
  check(maxJobs === Infinity || Number.isSafeInteger(maxJobs) && maxJobs >= 0,'invalid caller cap')
  check(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 180000,'invalid bounded deadline')
  const interval=options.requestIntervalMs ?? 1000
  check(Number.isSafeInteger(interval) && interval >= 0 && (interval >= 1000 || options.fetchPage || options.fetchImpl || options.fetchText),'invalid public request pacing')
  const now=typeof options.now === 'function' ? options.now() : options.now || new Date().toISOString()
  check(Number.isFinite(Date.parse(now)),'invalid check time')
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(Error('Brainvire source deadline exceeded')),timeoutMs)
  const signal=options.signal ? AbortSignal.any([options.signal,controller.signal]) : controller.signal
  let previousRequest=0
  const get=async()=>{
    signal.throwIfAborted()
    const remaining=interval-(Date.now()-previousRequest)
    if(remaining>0) await delay(remaining,undefined,{signal})
    signal.throwIfAborted();previousRequest=Date.now()
    let html
    if(options.fetchText && !options.fetchPage && !options.fetchImpl) html=await bounded(()=>options.fetchText(CAREERS_URL,{signal}),signal)
    else {
      const fetchPage=options.fetchPage || options.fetchImpl || globalThis.fetch
      const response=await bounded(()=>fetchPage(CAREERS_URL,{method:'GET',signal,redirect:'follow',headers:{Accept:'text/html'}}),signal)
      check(response.status===200,'public HTTP '+response.status+'; stopped without retry')
      check(response.url===CAREERS_URL,'official response URL changed')
      const mime=response.headers?.get?.('content-type')
      check(!mime || /text\/html/i.test(mime),'native response content type changed')
      html=await bounded(()=>response.text(),signal)
    }
    check(typeof html === 'string' && Buffer.byteLength(html) <= 3000000,'invalid or oversized native response')
    return {html,sha256:sha256(html),observedAt:new Date().toISOString()}
  }
  try {
    const first=await get(), opening=inspectNativeInventory(first.html,{now})
    const last=await get(), closing=inspectNativeInventory(last.html,{now})
    const stable=inventory=>({...inventory,records:[...inventory.records].sort((a,b)=>a.jobId.localeCompare(b.jobId))})
    check(canonical(stable(opening))===canonical(stable(closing)),'native identities, content, dates, application or hiring scope changed during closing reconciliation')
    const currentIndia=opening.records.filter(job=>job.countryCode==='IN' && !job.closed && !job.expired)
    const reasons=[...opening.reasons,...(maxJobs<currentIndia.length?['caller-cap-after-full-reconciliation']:[])]
    const evidence={...opening,reasons,closingReconciled:true,openingResponse:{sha256:first.sha256,observedAt:first.observedAt},closingResponse:{sha256:last.sha256,observedAt:last.observedAt},
      observedGlobalRecords:opening.records.length,confirmedIndiaRecords:currentIndia.length,
      confirmedForeignRecords:opening.records.filter(job=>job.countryCode && job.countryCode!=='IN').length,
      unresolvedCountryRecords:opening.records.filter(job=>!job.countryCode).length,fullEligibleIndiaRecords:0,
      currentNativePageReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    const jobs=currentIndia.slice(0,maxJobs).map(job=>({...job,source:'brainvire',link:job.applyUrl || job.sourceUrl,scrapedAt:now,sourceObservedIndiaJobCount:currentIndia.length,sourceObservedGlobalJobCount:opening.records.length}))
    Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence,enumerable:false})
    signal.throwIfAborted()
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:reasons.join(';')})
  } finally {clearTimeout(timer)}
}
