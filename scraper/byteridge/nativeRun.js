import { setTimeout as delay } from 'node:timers/promises'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CAREER_PAGE_URL,FRAME_URL,CLIENT_URL,PROXY_URL,NATIVE_ORIGIN,API_ORIGIN,ORG_ID,LIST_URL,check,sha256,canonical,corporateContract,frameContract,nativePageContract,organizationContract,listingContract,jobURL,publicJobURL,filteredBody,roleContract,reviewedNativeClients } from './nativeContract.js'

const bounded = (operation, signal) => new Promise((resolve,reject) => {
  const cleanup = () => signal.removeEventListener('abort',abort)
  const abort = () => { cleanup(); reject(signal.reason) }
  if (signal.aborted) return abort()
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value => {cleanup();resolve(value)},error => {cleanup();reject(error)})
})
export async function runNativeByteridge(options = {}) {
  const now = typeof options.now === 'function' ? options.now() : options.now || new Date().toISOString()
  const maxJobs = options.maxJobs ?? Infinity, interval = options.requestIntervalMs ?? 1000, timeout = options.timeoutMs ?? 150000
  check(Number.isFinite(+new Date(now)), 'invalid verification time')
  check(maxJobs === Infinity || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid caller cap')
  check(Number.isSafeInteger(interval) && interval >= 0 && (interval >= 1000 || options.fetchImpl || options.fetchPage || options.fetchText), 'invalid per-host pacing')
  check(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 300000, 'invalid bounded deadline')
  options.signal?.throwIfAborted()
  if(maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:false,pagesFetched:0,verifiedAt:now,reason:'caller-cap-zero-no-public-reads'})
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(Error('Byteridge bounded source deadline exceeded')), timeout)
  const signal = options.signal ? AbortSignal.any([options.signal,controller.signal]) : controller.signal
  const previous = new Map(), retainedResponses = [], sessionHeaders = {Origin:NATIVE_ORIGIN,Referer:NATIVE_ORIGIN+'/',Accept:'application/json, text/plain, */*'}
  let token = null
  const get = async (url, {method='GET',body,json=false,anonymous=false} = {}) => {
    signal.throwIfAborted()
    const parsed = new URL(url)
    const allowed = [CAREER_PAGE_URL,FRAME_URL,CLIENT_URL,PROXY_URL,LIST_URL,API_ORIGIN+'/api/token/noauth',API_ORIGIN+'/api/publicorganizations?accountName=byteridge',API_ORIGIN+'/api/publicorganizations/'+ORG_ID].includes(url) || /^https:\/\/byteridge\.turbohire\.co\/job\/publicjobs\/[\da-f-]{36}\?utm_source=CareerPage$/.test(url) || /^https:\/\/thapi-stage0\.azurewebsites\.net\/api\/publicjobs\/[\da-f-]{36}$/.test(url)
    check((allowed || Object.hasOwn(reviewedNativeClients,url)) && (method === 'GET' || method === 'POST' && [PROXY_URL,LIST_URL].includes(url)), 'request outside reviewed public read-only contract')
    const wait = interval - (Date.now() - (previous.get(parsed.origin) || 0))
    if (wait > 0) await delay(wait,undefined,{signal})
    previous.set(parsed.origin,Date.now())
    const isClient = url === CLIENT_URL || Object.hasOwn(reviewedNativeClients,url)
    const headers = parsed.origin === API_ORIGIN ? {...sessionHeaders,...(token && !anonymous ? {Authorization:'Bearer '+token} : {})} : {Accept:json ? 'application/json, text/plain, */*' : isClient ? 'application/javascript, text/javascript, */*' : 'text/html,application/xhtml+xml'}
    if (method === 'POST') Object.assign(headers,{'Content-Type':'application/json;charset=UTF-8',...(url === PROXY_URL ? {Origin:'https://byteridge.com',Referer:FRAME_URL} : {})})
    let text,status=200,contentType=null,finalUrl
    // The legacy seam remains read-only and deterministic for timeout tests.
    // Full public contract tests inject a response-shaped transport instead.
    if (options.fetchText && !options.fetchImpl && !options.fetchPage) text = await bounded(() => options.fetchText(url,{method,body,headers,signal}),signal)
    else {
      const response = await bounded(() => (options.fetchImpl || options.fetchPage || globalThis.fetch)(url,{method,body,headers,signal,redirect:'manual'}),signal)
      status=response.status;finalUrl=response.url || response.finalUrl;contentType=response.headers?.get?.('content-type') || response.contentType
      if (status !== 200) throw Object.assign(Error('Byteridge public HTTP '+status+'; stopped without retry'),{code:'BYTERIDGE_PUBLIC_HTTP',status,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout'})
      check(finalUrl === url, 'public response redirect changed')
      check(!contentType || (json ? /(?:application|text)\/[^;]*json/i : isClient ? /(?:application|text)\/(?:x-)?(?:java|ecma)script/i : /text\/html/i).test(contentType), 'public response MIME changed')
      text = await bounded(() => { if (typeof response.body === 'string') return response.body; const method = response.text; signal.throwIfAborted(); return Reflect.apply(method,response,[]) },signal)
    }
    check(typeof text === 'string' && Buffer.byteLength(text) <= (Object.hasOwn(reviewedNativeClients,url) ? 16000000 : 5000000), 'oversized/invalid public response')
    // Only response hashes and sizes are retained. Issued anonymous credentials,
    // cookies, staff contacts and irrelevant DTO account fields never leave RAM.
    const metadata = {url,method,status,contentType,bodyBytes:Buffer.byteLength(text),bodySHA256:sha256(text),observedAt:new Date().toISOString(),anonymousSession:anonymous}
    retainedResponses.push(metadata)
    if (anonymous) {
      const value=JSON.parse(text)
      check(typeof value.access_token === 'string' && value.access_token.length > 0 && value.token_type?.toLowerCase() === 'bearer' && typeof value.expires_in === 'number' && value.expires_in > 0 && value.ShouldRedirect === false, 'unexpected anonymous public session contract')
      token=value.access_token
      return null
    }
    return json ? JSON.parse(text) : text
  }
  const surface = async () => {
    const corporate = corporateContract(await get(CAREER_PAGE_URL)), frame = await get(FRAME_URL), client = await get(CLIENT_URL)
    const binding=frameContract(frame,client), proxy=listingContract(await get(PROXY_URL,{method:'POST',body:'{}',json:true}),'corporate')
    return {corporate,binding,proxy}
  }
  const nativeList = async () => {
    const lookup=organizationContract(await get(API_ORIGIN+'/api/publicorganizations?accountName=byteridge',{json:true}))
    const organization=organizationContract(await get(API_ORIGIN+'/api/publicorganizations/'+ORG_ID,{json:true}))
    check(canonical(lookup)===canonical(organization),'public organization lookup/detail disagreement')
    const listing=listingContract(await get(LIST_URL,{method:'POST',body:JSON.stringify(filteredBody()),json:true}),'native')
    return {organization,listing}
  }
  const details = async (phase, warm = new Map()) => {
    const results = new Map(), reasons=[], proxy=new Map(phase.proxy.records.map(row=>[row.JobId,row]))
    for (const row of phase.listing.records) {
      // Transport errors abort immediately; malformed individual role facts
      // retain partial coverage while unrelated healthy roles remain usable.
      const html=warm.get(row.JobId) || await get(jobURL(row.JobId))
      const page=nativePageContract(html,row)
      if(page.companyScopeUnqualified)reasons.push('current-native-client-company-inventory-unqualified')
      const dto=await get(publicJobURL(row.JobId),{json:true})
      try {
        const role=roleContract(row,dto,page,proxy.get(row.JobId),now)
        if(!role.proxyCoherent) reasons.push('corporate-native-role-disagreement:'+row.JobId)
        if(role.roleLinks.some(value=>{
          const url=new URL(value)
          if(url.origin!==NATIVE_ORIGIN) return true
          if(url.pathname==='/dashboardv2') return Boolean(url.search||url.hash)
          const id=/^\/job\/publicjobs\/([\da-f-]{36})$/.exec(url.pathname)?.[1]
          return !id||!phase.listing.records.some(r=>r.JobId===id)
        })) reasons.push('unreconciled-native-hiring-link:'+row.JobId)
        results.set(row.JobId,role)
      } catch (error) {
        if(error.code!=='BYTERIDGE_NATIVE_CONTRACT' && !(error instanceof SyntaxError)) throw error
        reasons.push('unresolved-role:'+row.JobId+':'+error.message)
      }
    }
    return {results,reasons}
  }
  try {
    const opening=await surface()
    check(opening.proxy.records.length > 0,'corporate proxy exposes no native public client binding; empty inventory unverified')
    // The current explicit ApplyUrl is the employer-owned delegation to the
    // public native page. Validate executable asset versions before noauth.
    const first=opening.proxy.records[0]
    check(first.ApplyUrl===jobURL(first.JobId),'unreviewed native application context')
    const firstHTML=await get(first.ApplyUrl)
    const firstPage=nativePageContract(firstHTML,first)
    for(const url of firstPage.publicClientURLs)check(sha256(await get(url))===reviewedNativeClients[url],'current native client bytes changed')
    await get(API_ORIGIN+'/api/token/noauth',{json:true,anonymous:true})
    Object.assign(opening,await nativeList())
    const openingDetails=await details(opening,new Map([[first.JobId,firstHTML]]))
    const closing=await surface()
    Object.assign(closing,await nativeList())
    const closingDetails=await details(closing)
    const ids=phase=>phase.listing.records.map(row=>row.JobId).sort()
    const proxyIds=phase=>phase.proxy.records.map(row=>row.JobId).sort()
    const reasons=[...opening.corporate.reasons,...closing.corporate.reasons,...opening.proxy.reasons,...closing.proxy.reasons,...opening.listing.reasons,...closing.listing.reasons,...openingDetails.reasons,...closingDetails.reasons]
    if(canonical(ids(opening))!==canonical(ids(closing))) reasons.push('native-global-identities-changed')
    if(canonical(proxyIds(opening))!==canonical(proxyIds(closing))) reasons.push('corporate-global-identities-changed')
    if(canonical(ids(opening))!==canonical(proxyIds(opening)) || canonical(ids(closing))!==canonical(proxyIds(closing))) reasons.push('corporate-native-global-identities-disagree')
    if(canonical(opening.corporate)!==canonical(closing.corporate) || canonical(opening.binding)!==canonical(closing.binding) || canonical(opening.organization)!==canonical(closing.organization)) reasons.push('corporate-or-native-employer-scope-changed')
    const healthy=[]
    for(const row of opening.listing.records) {
      const left=openingDetails.results.get(row.JobId), right=closingDetails.results.get(row.JobId)
      if(!left || !right) continue
      if(canonical(left.semantic)!==canonical(right.semantic)) {reasons.push('role-changed-during-closing:'+row.JobId);continue}
      if(left.country==='India') healthy.push({...left.job,nativeRoleClosingReconciled:true,
        nativeSourceRecord:{...left.job.nativeSourceRecord,nativeClosingListing:right.job.nativeSourceRecord.nativeListing,
          nativeClosingDetail:right.job.nativeSourceRecord.nativeDetail,nativeClosingJobPosting:right.job.nativeSourceRecord.nativeJobPosting,
          nativePublisher:{corporateURL:CAREER_PAGE_URL,frameURL:FRAME_URL,clientURL:CLIENT_URL,orgId:ORG_ID,
            organization:opening.organization,clients:Object.fromEntries(firstPage.publicClientURLs.map(url=>[url,reviewedNativeClients[url]]))}}})
    }
    if(maxJobs<healthy.length) reasons.push('caller-cap-after-full-native-reconciliation')
    const complete=reasons.length===0
    const evidence={source:'byteridge',surface:CAREER_PAGE_URL,nativeSurface:NATIVE_ORIGIN,observedGlobalRecords:opening.listing.records.length,reportedTotal:opening.listing.total,confirmedIndiaRecords:healthy.length,confirmedForeignRecords:[...openingDetails.results.values()].filter(r=>r.country!=='India').length,unresolvedRecords:opening.listing.records.length-openingDetails.results.size,
      closingReconciled:true,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,reasons:[...new Set(reasons)],sourceFrameContexts:{opening:opening.corporate.frameContexts,closing:closing.corporate.frameContexts},retainedResponses,verifiedAt:now,anonymousSessionCredentialsRetained:false,publicRolePageFetched:true,applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false}
    const jobs=healthy.slice(0,maxJobs).map(job=>({...job,sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceObservedGlobalJobCount:opening.listing.records.length,sourceObservedIndiaJobCount:healthy.length,nativeCollectionEvidence:evidence}))
    Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence,enumerable:false})
    Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...evidence,nativeRecords:evidence.observedGlobalRecords,unresolved:evidence.reasons}})
    signal.throwIfAborted()
    return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:complete,pagesFetched:retainedResponses.length,reportedTotal:opening.listing.total,indiaFacetCount:healthy.length,verifiedAt:now,reason:complete?'complete-native-global-and-corporate-snapshots-reconciled':evidence.reasons.join(';')})
  } catch(error) {
    options.signal?.throwIfAborted()
    if(/timed? out|timeout|fetch failed|connect|socket|econn|enotfound|eai_again|tls|deadline/i.test(String(error?.message))) Object.assign(error,{softFailure:true,upstreamOutage:true,abortRetries:true,failureKind:'network_or_timeout'})
    throw error
  } finally {token=null;clearTimeout(timer)}
}
