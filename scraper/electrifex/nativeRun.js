import {setTimeout as pause} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readElectrifexHtml,norm} from './nativeHtml.js'
import {CAREERS_URL,HOMEPAGE_URL,extractNativeInventory,hasOfficialHomepageSignal,reviewed,sha} from './nativeInventory.js'

const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Electrifex native: '+message),{abortRetries:true,softFailure:true,failureKind:'native_contract_changed'})}
const semantic=role=>JSON.stringify({...role,observedAt:undefined})
export const runNativeElectrifex=async(options={})=>{
  const {fetchText,fetchImpl=globalThis.fetch,onEvidence,signal}=options
  // Fixture transports can disable pacing; public transports always wait >=1s/origin.
  const interval=fetchText?Math.max(0,options.minimumIntervalMs??1050):1050
  const last=new Map(),receipts=[]
  const cancellable=async operation=>{
    signal?.throwIfAborted()
    if(!signal)return operation()
    let onAbort
    const cancellation=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true})})
    try{
      const value=await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}),cancellation])
      signal.throwIfAborted()
      return value
    }catch(error){if(signal.aborted)throw signal.reason;throw error}
    finally{signal.removeEventListener('abort',onAbort)}
  }
  const get=async url=>{
    signal?.throwIfAborted()
    const origin=new URL(url).origin
    await cancellable(()=>pause(Math.max(0,interval-(Date.now()-(last.get(origin)||0))),undefined,{signal}))
    last.set(origin,Date.now())
    let body,status=200,finalUrl=url,contentType=null
    if(fetchText)body=await cancellable(()=>fetchText(url,{method:'GET',signal}))
    else{
      const response=await cancellable(()=>fetchImpl(url,{method:'GET',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)}))
      status=response.status;finalUrl=response.url||url;contentType=response.headers?.get?.('content-type')||null
      if(status!==200)throw Object.assign(Error(`Electrifex public HTTP ${status}; stopped without retry`),{status,abortRetries:true,softFailure:true,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout'})
      check(finalUrl===url,'unexpected public redirect')
      const bytes=Buffer.from(await cancellable(()=>response.arrayBuffer()))
      body=bytes.toString('utf8')
      check(Buffer.byteLength(body)===bytes.length,'unexpected non-UTF8 public response')
    }
    check(typeof body==='string'&&Buffer.byteLength(body)<6000000,'invalid public response')
    const receipt={url,finalUrl,status,method:'GET',contentType,bodyBytes:Buffer.byteLength(body),bodySHA256:sha(body),observedAt:new Date().toISOString()}
    receipts.push(receipt)
    if(options.onResponse)await cancellable(()=>options.onResponse({...receipt,body}))
    signal?.throwIfAborted()
    return body
  }
  const snapshot=async phase=>{
    const homepage=await get(HOMEPAGE_URL),homeDoc=readElectrifexHtml(homepage),reasons=[]
    check(hasOfficialHomepageSignal(homepage),'unverified corporate employer identity')
    const scripts=homeDoc.executionNodes(n=>n.tag==='script')
    const expectedHomeAssets=reviewed.assets.filter(row=>row.url.startsWith(HOMEPAGE_URL))
    if(scripts.length!==1||scripts[0].attrs.type!=='module'||scripts[0].duplicates.length||JSON.stringify(Object.keys(scripts[0].attrs).sort())!==JSON.stringify(['crossorigin','src','type'])||new URL(scripts[0].attrs.src||'',HOMEPAGE_URL).href!==expectedHomeAssets[0]?.url)reasons.push('unreviewed-corporate-client-contract')
    let corporateDelegated=false,assetsHealthy=true
    for(const asset of expectedHomeAssets){
      if(!scripts.some(node=>node.attrs.src&&new URL(node.attrs.src,HOMEPAGE_URL).href===asset.url)){assetsHealthy=false;continue}
      const body=await get(asset.url)
      if(sha(body)!==asset.sha256){reasons.push('changed-corporate-client');assetsHealthy=false}
      // This exact reviewed React client renders explicit Careers anchors. No
      // domain association, corporate address or unexecuted text supplies binding.
      corporateDelegated=sha(body)===asset.sha256&&/href:"https:\/\/talents\.electrifex\.com",target:"_blank"[^}]*children:"Careers"/.test(body)
    }
    const html=await get(CAREERS_URL),discovery=extractNativeInventory(html),stylesheets=[]
    let bootstrapVerified=false
    if(!corporateDelegated)reasons.push('unverified-current-corporate-careers-delegation')
    for(const asset of reviewed.assets.filter(row=>!row.url.startsWith(HOMEPAGE_URL))){
      const advertised=discovery.clients.includes(asset.url)||discovery.styles.includes(asset.url)
      if(!advertised){reasons.push('missing-reviewed-client-or-style:'+asset.url);assetsHealthy=false;continue}
      const body=await get(asset.url)
      if(sha(body)!==asset.sha256){reasons.push('changed-client-or-style:'+asset.url);assetsHealthy=false}
      if(asset.url===CAREERS_URL+'static/assets/vendor/bootstrap/js/bootstrap.bundle.min.js'&&sha(body)===asset.sha256)bootstrapVerified=true
      if(discovery.styles.includes(asset.url))stylesheets.push({url:asset.url,body})
    }
    const inventory=extractNativeInventory(html,{stylesheets,revealBootstrap:bootstrapVerified})
    reasons.push(...inventory.reasons)
    const reciprocal=readElectrifexHtml(html).nodes(n=>n.tag==='a'&&['https://www.electrifex.com','https://www.electrifex.com/'].includes(n.attrs.href)).length===1
    if(!reciprocal)reasons.push('unverified-native-reciprocal-employer-link')
    return {phase,inventory,reasons,assetsHealthy,corporateDelegated,reciprocal,
      binding:sha(homepage),nativeContractHealthy:assetsHealthy&&corporateDelegated&&reciprocal&&inventory.nativeIdentityVerified&&!reasons.some(r=>/client|style|base|frame/.test(r))}
  }
  const opening=await snapshot('opening'),closing=await snapshot('closing')
  const reasons=[...opening.reasons,...closing.reasons]
  const left=opening.inventory.roles,right=closing.inventory.roles
  const leftIds=left.map(r=>r.jobId).sort(),rightIds=right.map(r=>r.jobId).sort()
  if(JSON.stringify(leftIds)!==JSON.stringify(rightIds)||opening.inventory.candidateRecords!==closing.inventory.candidateRecords)reasons.push('native-identities-changed-at-closing')
  if(opening.binding!==closing.binding)reasons.push('corporate-binding-changed-at-closing')
  const stable=[]
  for(const role of left){
    const other=right.find(r=>r.jobId===role.jobId)
    if(!other||semantic(role)!==semantic(other)){reasons.push('role-changed-at-closing:'+role.jobId);continue}
    stable.push(role)
  }
  const contractHealthy=opening.nativeContractHealthy&&closing.nativeContractHealthy
  const healthy=contractHealthy?stable:[]
  const unknown=healthy.filter(role=>role.country===null)
  if(unknown.length)reasons.push('unresolved-role-work-country:'+unknown.map(role=>role.jobId).join(','))
  // An unknown country never means no India vacancies. Full native content stays
  // available in evidence while India output and lifecycle cleanup remain closed.
  const confirmedIndia=healthy.filter(role=>role.country==='India')
  const maxJobs=Number.isInteger(options.maxJobs)&&options.maxJobs>=0?options.maxJobs:Infinity
  if(maxJobs<confirmedIndia.length)reasons.push('caller-cap-after-native-reconciliation')
  const uniqueReasons=[...new Set(reasons)],complete=uniqueReasons.length===0
  const evidence={source:'electrifex',surface:CAREERS_URL,firstParty:opening.corporateDelegated&&closing.corporateDelegated,
    candidateRecords:opening.inventory.candidateRecords,observedGlobalRecords:left.length,fullHealthyGlobalRecords:healthy.length,
    confirmedIndiaRecords:confirmedIndia.length,fullHealthyIndiaRecords:confirmedIndia.length,eligibleRecords:Math.min(maxJobs,confirmedIndia.length),
    confirmedForeignRecords:healthy.filter(r=>r.country&&r.country!=='India').length,unknownCountryRecords:unknown.length,
    invalidRoles:[...opening.inventory.invalidRoles,...closing.inventory.invalidRoles],
    globalRoles:stable,opening:{candidateRecords:opening.inventory.candidateRecords,roles:left,pagination:opening.inventory.pagination,reasons:opening.reasons},
    closing:{candidateRecords:closing.inventory.candidateRecords,roles:right,pagination:closing.inventory.pagination,reasons:closing.reasons},
    closingReconciled:JSON.stringify(leftIds)===JSON.stringify(rightIds)&&stable.length===left.length,
    nativeClientContractVerified:contractHealthy,sourceScopeComplete:complete,sourceListingComplete:complete,lifecycleCleanupAllowed:complete,
    absenceInferenceAllowed:complete,reasons:uniqueReasons,retainedResponses:receipts,verifiedAt:new Date().toISOString(),
    candidateActionsTaken:false,applicationSubmitted:false}
  const jobs=confirmedIndia.slice(0,maxJobs).map(job=>({...job,sourceScopeComplete:complete,sourceListingComplete:complete,lifecycleCleanupAllowed:complete,nativeCollectionEvidence:evidence,scrapedAt:evidence.verifiedAt}))
  Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence})
  signal?.throwIfAborted()
  if(onEvidence)await cancellable(()=>onEvidence(evidence))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:CAREERS_URL,firstParty:evidence.firstParty,
    listingComplete:complete,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:unknown.length?null:confirmedIndia.length,
    verifiedAt:evidence.verifiedAt,reason:uniqueReasons.join(';')||'full-native-snapshots-reconciled'})
}
