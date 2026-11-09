import { setTimeout as delay } from 'node:timers/promises'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildPublishableJobPostedAtCutoff } from '../../src/utils/jobLifecycle.js'
import { ORIGIN,CAREER_PAGE_URL,DASHBOARD_URL,API_BASE_URL,NOAUTH_TOKEN_URL,ORGANIZATION_URL,FILTERED_JOBS_URL,SOURCES,UUID,LIVE_FILTER_BODY,reviewed,check,sha256,canonical,assetContract,surfaceAssets,corporateStylesheets,corporateContract,nativeSurfaceContract,organizationContract,listingContract,jobURL,publicJobURL,roleContract } from './nativeContract.js'

const bounded=(operation,signal)=>new Promise((resolve,reject)=>{
  const cleanup=()=>signal.removeEventListener('abort',abort),abort=()=>{cleanup();reject(signal.reason||Error('Ola source aborted'))}
  if(signal.aborted)return abort()
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(operation).then(v=>{cleanup();resolve(v)},e=>{cleanup();reject(e)})
})
const redact=value=>Array.isArray(value)?value.map(redact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!/createdby|updatedby|hiringmanager|recruiter|(?:^|_)users?(?:$|id|name)|email|phone|mobile|billing|^CompanyAddress$|gstin|^TaxType$|^DeductTDS$|^SSOProvider$|OrgVerifiedDomains|OrgVisibleResumeFields|OrganizationDefaults/i.test(k)).map(([k,v])=>[k,redact(v)])):value
export async function runNativeOla({source,...options}={}) {
  const config=SOURCES[source];check(config,'unreviewed source registration')
  check(!options.fetchJson,'legacy preview-only fetchJson transport cannot establish a current native inventory')
  const now=typeof options.now==='function'?options.now():options.now||new Date().toISOString(),maxJobs=options.maxJobs??Infinity,interval=options.requestIntervalMs??1000,timeout=options.timeoutMs??240000
  check(Number.isFinite(+new Date(now)),'invalid verification time')
  check(maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid caller cap')
  check(Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl),'invalid public per-origin pacing')
  check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'invalid bounded deadline')
  options.signal?.throwIfAborted()
  if(maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:config.corporateURL,firstParty:true,listingComplete:false,pagesFetched:0,verifiedAt:now,reason:'caller-cap-zero-no-public-reads'})
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Ola bounded source deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  let token=null
  const prior=new Map(),responses=[],jsCache=new Map(),allowedAssets=new Map(surfaceAssets(source).map(a=>[a.url,a]))
  const get=async(url,{method='GET',body,json=false,anonymous=false}={})=>{
    signal.throwIfAborted()
    const parsed=new URL(url),isRoleHTML=parsed.origin===ORIGIN&&/^\/job\/publicjobs\/[^/]+$/.test(parsed.pathname)&&UUID.test(parsed.pathname.split('/').at(-1))&&!parsed.search
    const isRoleDTO=parsed.origin===API_BASE_URL&&/^\/api\/publicjobs\/[^/]+$/.test(parsed.pathname)&&UUID.test(parsed.pathname.split('/').at(-1))&&parsed.search==='?fieldVisibility=CareerPage'
    check([config.corporateURL,CAREER_PAGE_URL,DASHBOARD_URL,NOAUTH_TOKEN_URL,ORGANIZATION_URL,FILTERED_JOBS_URL].includes(url)||allowedAssets.has(url)||isRoleHTML||isRoleDTO,'request outside reviewed public contract')
    check(method==='GET'||method==='POST'&&url===FILTERED_JOBS_URL&&body===JSON.stringify(LIVE_FILTER_BODY),'unreviewed public method/body')
    const wait=interval-(Date.now()-(prior.get(parsed.origin)||0));if(wait>0)await delay(wait,undefined,{signal});prior.set(parsed.origin,Date.now())
    const kind=allowedAssets.get(url)?.kind,headers=parsed.origin===API_BASE_URL?{Origin:ORIGIN,Referer:DASHBOARD_URL,Accept:'application/json, text/plain, */*',...(token&&!anonymous?{Authorization:'Bearer '+token}:{})}:{Accept:kind==='js'?'application/javascript':kind==='css'?'text/css':'text/html,application/xhtml+xml'}
    if(method==='POST')headers['Content-Type']='application/json;charset=UTF-8'
    const response=await bounded(()=>(options.fetchImpl||globalThis.fetch)(url,{method,body,headers,signal,redirect:'manual'}),signal)
    const status=response.status,finalUrl=response.url||response.finalUrl||url,contentType=response.headers?.get?.('content-type')||response.contentType||null
    if(status!==200)throw Object.assign(Error('Ola public HTTP '+status+'; stopped without retry'),{code:'OLA_PUBLIC_HTTP',status,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout'})
    check(finalUrl===url,'public response redirect changed')
    check(contentType&&(json?/(?:application|text)\/[^;]*json/i:kind==='js'?/(?:application|text)\/(?:x-)?(?:java|ecma)script/i:kind==='css'?/text\/css/i:/text\/html/i).test(contentType),'public response MIME changed')
    const text=await bounded(()=>typeof response.body==='string'?response.body:response.text(),signal)
    check(typeof text==='string'&&Buffer.byteLength(text)<=15000000,'invalid or oversized public response')
    const metadata={url,method,status,contentType,observedAt:new Date().toISOString(),originalBytes:Buffer.byteLength(text),originalSHA256:sha256(text),anonymousSession:anonymous}
    if(method==='POST')Object.assign(metadata,{requestBodySHA256:sha256(body),publicListingBody:JSON.parse(body)})
    responses.push(metadata)
    if(anonymous){const value=JSON.parse(text);check(typeof value.access_token==='string'&&value.access_token.length>0&&value.token_type?.toLowerCase()==='bearer'&&typeof value.expires_in==='number'&&value.expires_in>0&&value.ShouldRedirect===false,'unexpected anonymous token response');token=value.access_token;metadata.bodyRetained=false;metadata.shape=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v]));await options.onResponse?.({...metadata});return null}
    const value=json?JSON.parse(text):text,retained=json?JSON.stringify(redact(value)):text
    Object.assign(metadata,{retainedBytes:Buffer.byteLength(retained),retainedSHA256:sha256(retained),privacyRedacted:retained!==text})
    await options.onResponse?.({...metadata,body:retained})
    return value
  }
  const surface=async()=>{
    const corporateHTML=await get(config.corporateURL),nativeHTML=await get(DASHBOARD_URL),sourceHTML=source==='ola'?await get(CAREER_PAGE_URL):null,css=[]
    // Exact reviewed entry and lazy route clients establish the public read
    // endpoints. CSS is fetched again and applied to each closing element tree.
    for(const asset of surfaceAssets(source,nativeHTML,corporateHTML)){
      let content=asset.kind==='js'?jsCache.get(asset.url):null
      if(content==null){content=await get(asset.url);assetContract(asset.url,content);if(asset.kind==='js')jsCache.set(asset.url,content)}
      if(asset.kind==='css')css.push({url:asset.url,body:content})
    }
    const corporateStyles=corporateStylesheets(corporateHTML,source).filter(s=>s.media!=='print').map(s=>css.find(c=>c.url===s.url)?.body||'').join('\n'),nativeStyles=css.filter(c=>c.url.startsWith(ORIGIN+'/')).map(c=>c.body).join('\n')
    const corporate=corporateContract(corporateHTML,source,corporateStyles)
    const native=nativeSurfaceContract(nativeHTML,nativeStyles)
    if(sourceHTML)check(canonical(nativeSurfaceContract(sourceHTML,nativeStyles).nativeClientURLs)===canonical(native.nativeClientURLs),'native public shell client versions disagree')
    return {corporate,nativeStyles,nativeClientsValidated:true,nativeClientURLs:native.nativeClientURLs}
  }
  const nativeList=async()=>{
    const organization=organizationContract(await get(ORGANIZATION_URL,{json:true})),listing=listingContract(await get(FILTERED_JOBS_URL,{method:'POST',body:JSON.stringify(LIVE_FILTER_BODY),json:true}))
    return {organization,listing}
  }
  const details=async phase=>{
    const roles=new Map(),reasons=[]
    for(const row of phase.listing.records){
      const html=await get(jobURL(row.JobId)),dto=await get(publicJobURL(row.JobId),{json:true})
      try{const page=nativeSurfaceContract(html,phase.nativeStyles,{role:true});check(canonical(page.nativeClientURLs)===canonical(phase.nativeClientURLs),'public role client differs from current board');const role=roleContract(row,dto,page,source,now);roles.set(row.JobId,role)}
      catch(error){if(error.code!=='OLA_NATIVE_CONTRACT'&&!(error instanceof SyntaxError)&&error.name!=='ActiveNativeContentError')throw error;reasons.push('unresolved-public-role:'+row.JobId+':'+error.message)}
    }
    return {roles,reasons}
  }
  try{
    const opening=await surface()
    await get(NOAUTH_TOKEN_URL,{json:true,anonymous:true})
    Object.assign(opening,await nativeList());const first=await details(opening)
    const closing=await surface();Object.assign(closing,await nativeList());const last=await details(closing)
    const boardReasons=[...opening.listing.reasons,...closing.listing.reasons]
    const ids=p=>p.listing.records.map(r=>r.JobId).sort()
    if(canonical(ids(opening))!==canonical(ids(closing))||opening.listing.total!==closing.listing.total)boardReasons.push('native-global-total-or-identities-changed')
    if(canonical(opening.organization)!==canonical(closing.organization))boardReasons.push('native-organization-context-changed')
    if(canonical(opening.nativeClientURLs)!==canonical(closing.nativeClientURLs))boardReasons.push('native-client-changed-during-closing')
    const reasons=[...opening.corporate.reasons,...closing.corporate.reasons,...boardReasons,...first.reasons,...last.reasons],healthy=[],qualified=[]
    if(canonical(opening.corporate)!==canonical(closing.corporate))reasons.push('corporate-hiring-context-changed')
    let matchedIndia=0,matchedForeign=0,otherEmployer=0
    for(const row of opening.listing.records){const a=first.roles.get(row.JobId),b=last.roles.get(row.JobId);if(!a||!b)continue;if(canonical(a.semantic)!==canonical(b.semantic)){reasons.push('role-changed-during-closing:'+row.JobId);continue}healthy.push(a);if(a.employerSource!==source){otherEmployer++;continue}if(a.countries.includes('India')){matchedIndia++;qualified.push(a.job)}else matchedForeign++}
    if(maxJobs<qualified.length)reasons.push('caller-cap-after-full-native-reconciliation')
    const publicationPolicyCutoff=buildPublishableJobPostedAtCutoff(now).toISOString()
    const nativeBoardIdentityComplete=boardReasons.length===0,nativeBoardComplete=nativeBoardIdentityComplete&&first.reasons.length===0&&last.reasons.length===0&&healthy.length===opening.listing.records.length,complete=reasons.length===0,counts={observedGlobalRecords:opening.listing.records.length,reportedTotal:opening.listing.total,observedIndiaRecords:healthy.filter(r=>r.countries.includes('India')).length,confirmedIndiaRecords:matchedIndia,confirmedForeignRecords:matchedForeign,healthyGlobalRecords:healthy.length,healthySourceIndiaRecords:qualified.length,otherEmployerRecords:otherEmployer,unresolvedRecords:opening.listing.records.length-healthy.length,publicationPolicyCutoff,publicationPolicyEligibleIndiaRecords:qualified.filter(j=>+new Date(j.postingDate)>=+new Date(publicationPolicyCutoff)&&+new Date(j.postingDate)<=+new Date(now)).length}
    const evidence={source,surface:config.corporateURL,nativeSurface:DASHBOARD_URL,...counts,nativeBoardIdentityComplete,nativeBoardComplete,nativeBoardEmpty:nativeBoardComplete&&opening.listing.total===0,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,closingReconciled:nativeBoardComplete,snapshots:2,reasons:[...new Set(reasons)],retainedResponses:responses,verifiedAt:now,anonymousSessionCredentialsRetained:false,applicationSubmitted:false,candidateActionsTaken:false}
    await options.onEvidence?.(evidence)
    const jobs=qualified.slice(0,maxJobs).map(job=>({...job,sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceObservedGlobalJobCount:counts.observedGlobalRecords,sourceObservedIndiaJobCount:matchedIndia,nativeCollectionEvidence:evidence}))
    Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence,enumerable:false})
    Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...evidence,nativeRecords:evidence.observedGlobalRecords,unresolved:evidence.reasons}})
    signal.throwIfAborted()
    return attachInventoryEvidence(jobs,{status:complete?(jobs.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:config.corporateURL,firstParty:true,listingComplete:complete,pagesFetched:responses.length,reportedTotal:opening.listing.total,indiaFacetCount:matchedIndia,verifiedAt:now,reason:evidence.reasons.join(';')||'complete-native-global-and-employer-snapshots-reconciled'})
  }catch(error){if(/timed? out|timeout|fetch failed|connect|socket|econn|enotfound|eai_again|tls|deadline/i.test(String(error?.message)))Object.assign(error,{softFailure:true,upstreamOutage:true,abortRetries:true,failureKind:'network_or_timeout'});throw error}
  finally{token=null;clearTimeout(timer)}
}
