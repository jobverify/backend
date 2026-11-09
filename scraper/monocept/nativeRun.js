import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readFileSync} from 'node:fs'
import {CAREER_PAGE_URL,BOARD_URL,DASHBOARD_URL,NATIVE_ORIGIN,API_ORIGIN,ORG_ID,LIST_URL,check,sha256,canonical,corporateContract,nativeShellContract,clientContract,nativePageContract,organizationContract,listingContract,jobURL,publicJobURL,filteredBody,roleContract} from './nativeContract.js'
const reviewed=JSON.parse(readFileSync(new URL('./reviewedSurfaces.json',import.meta.url)))
const bounded=(operation,signal)=>new Promise((resolve,reject)=>{
 const cleanup=()=>signal.removeEventListener('abort',abort)
 const abort=()=>{cleanup();reject(signal.reason||Error('Monocept aborted'))}
 if(signal.aborted)return abort()
 signal.addEventListener('abort',abort,{once:true})
 Promise.resolve().then(operation).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})
})
export async function runNativeMonocept(options={}){
 const now=typeof options.now==='function'?options.now():options.now||new Date().toISOString(),maxJobs=options.maxJobs??Infinity,interval=options.requestIntervalMs??1000,timeout=options.timeoutMs??240000
 check(Number.isFinite(+new Date(now)),'invalid verification time')
 check(maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid caller cap')
 check(Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl||options.fetchPage),'invalid per-host pacing')
 check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'invalid bounded deadline')
 options.signal?.throwIfAborted()
 if(maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:false,pagesFetched:0,verifiedAt:now,reason:'caller-cap-zero-no-public-reads'})
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Monocept bounded source deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const previous=new Map(),retainedResponses=[]
 let token=null
 const get=async(url,{method='GET',body,json=false,anonymous=false}={})=>{
  signal.throwIfAborted()
  const parsed=new URL(url),allowed=[CAREER_PAGE_URL,BOARD_URL,DASHBOARD_URL,LIST_URL,API_ORIGIN+'/api/token/noauth',API_ORIGIN+'/api/publicorganizations?accountName=monocept',API_ORIGIN+'/api/publicorganizations/'+ORG_ID,...Object.keys(reviewed.clientSHA256),...Object.keys(reviewed.cssSHA256)].includes(url)||/^https:\/\/monocept\.turbohire\.co\/job\/publicjobs\/[\da-f-]{36}\?utm_source=CareerPage$/.test(url)||/^https:\/\/thapi-stage0\.azurewebsites\.net\/api\/publicjobs\/[\da-f-]{36}\?fieldVisibility=CareerPage$/.test(url)
  check(allowed&&(method==='GET'||method==='POST'&&url===LIST_URL),'request outside reviewed public read-only contract')
  const wait=interval-(Date.now()-(previous.get(parsed.origin)||0));if(wait>0)await delay(wait,undefined,{signal});previous.set(parsed.origin,Date.now())
  const headers=parsed.origin===API_ORIGIN?{Origin:NATIVE_ORIGIN,Referer:NATIVE_ORIGIN+'/',Accept:'application/json, text/plain, */*',...(token&&!anonymous?{Authorization:'Bearer '+token}:{})}:{Accept:url.endsWith('.js')?'application/javascript':'text/html,application/xhtml+xml'}
  if(method==='POST')headers['Content-Type']='application/json;charset=UTF-8'
  const response=await bounded(()=>(options.fetchImpl||options.fetchPage||globalThis.fetch)(url,{method,body,headers,signal,redirect:'manual'}),signal)
  const status=response.status,contentType=response.headers?.get?.('content-type')||response.contentType
  if(status!==200)throw Object.assign(Error('Monocept public HTTP '+status+'; stopped without retry'),{code:'MONOCEPT_PUBLIC_HTTP',status,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:[401,403,429].includes(status)?'public_access_denied':'network_or_timeout'})
  check((response.url||response.finalUrl)===url,'public response redirect changed')
  check(!contentType||(json?/(?:application|text)\/[^;]*json/i:url.endsWith('.js')?/(?:application|text)\/(?:x-)?(?:java|ecma)script/i:url.endsWith('.css')?/text\/css/i:/text\/html/i).test(contentType),'public response MIME changed')
  const text=await bounded(()=>typeof response.body==='string'?response.body:typeof response.html==='string'?response.html:response.text(),signal)
  check(typeof text==='string'&&Buffer.byteLength(text)<=15000000,'oversized/invalid public response')
  retainedResponses.push({url,method,status,contentType,bodyBytes:Buffer.byteLength(text),bodySHA256:sha256(text),observedAt:new Date().toISOString(),anonymousSession:anonymous})
  if(anonymous){const v=JSON.parse(text);check(typeof v.access_token==='string'&&v.access_token.length>0&&v.token_type?.toLowerCase()==='bearer'&&typeof v.expires_in==='number'&&v.expires_in>0&&v.ShouldRedirect===false,'unexpected anonymous public session contract');token=v.access_token;return null}
  return json?JSON.parse(text):text
 }
 const surface=async()=>{
  const html=await get(CAREER_PAGE_URL),styles=[],advertised=corporateContract(html).styles.stylesheets
  for(const url of advertised){const hash=reviewed.cssSHA256[url];check(hash,'unreviewed current corporate CSS URL');const css=await get(url);check(sha256(css)===hash,'unreviewed current corporate CSS bytes');styles.push(css)}
  const corporate=corporateContract(html,styles.join('\n')),shells=[]
  for(const url of [BOARD_URL,DASHBOARD_URL]){const shell=nativeShellContract(await get(url));shells.push({url,hiringLinks:shell.hiringLinks,frames:shell.frames,publicClientURLs:shell.publicClientURLs});if(shell.companyScopeUnqualified)corporate.reasons.push('current-native-client-company-inventory-unqualified')}
  const clientURLs=shells[0].publicClientURLs
  check(shells.every(shell=>canonical(shell.publicClientURLs)===canonical(clientURLs)),'native public shells client version disagreement')
  const clients={};for(const url of clientURLs)clients[url]=clientContract(url,await get(url))
  return {corporate,clients,shells}
 }
 const unreconciledLinks=(links,phase)=>links.filter(value=>{
  const u=new URL(value)
  if(u.href===CAREER_PAGE_URL||u.href===CAREER_PAGE_URL+'#'||u.href===BOARD_URL)return false
  if(u.origin!==NATIVE_ORIGIN)return true
  if(u.pathname==='/dashboardv2')return Boolean(u.search||u.hash)
  const id=/^\/job\/publicjobs\/([\da-f-]{36})$/.exec(u.pathname)?.[1]
  return !id||!phase.listing.records.some(r=>r.JobId===id)||u.hash||!['','?utm_source=CareerPage'].includes(u.search)
 })
 const listing=async()=>{
  const lookup=organizationContract(await get(API_ORIGIN+'/api/publicorganizations?accountName=monocept',{json:true})),organization=organizationContract(await get(API_ORIGIN+'/api/publicorganizations/'+ORG_ID,{json:true}))
  check(canonical(lookup)===canonical(organization),'public organization lookup/detail disagreement')
  return {organization,listing:listingContract(await get(LIST_URL,{method:'POST',body:JSON.stringify(filteredBody()),json:true}),'native')}
 }
 const details=async phase=>{
  const results=new Map(),reasons=[]
  for(const row of phase.listing.records){
   const html=await get(jobURL(row.JobId)),dto=await get(publicJobURL(row.JobId),{json:true})
   // Validate every response transport before considering role-local facts.
   try{
    const role=roleContract(row,dto,nativePageContract(html,row),now)
    if(unreconciledLinks(role.roleLinks,phase).length)reasons.push('unreconciled-native-hiring-link:'+row.JobId)
    results.set(row.JobId,role)
   }catch(error){if(error.code!=='MONOCEPT_NATIVE_CONTRACT'&&!(error instanceof SyntaxError))throw error;reasons.push('unresolved-role:'+row.JobId+':'+error.message)}
  }
  return {results,reasons}
 }
 try{
  const opening=await surface();await get(API_ORIGIN+'/api/token/noauth',{json:true,anonymous:true});Object.assign(opening,await listing());const openingDetails=await details(opening)
  const closing=await surface();Object.assign(closing,await listing());const closingDetails=await details(closing)
  const ids=phase=>phase.listing.records.map(r=>r.JobId).sort(),reasons=[...opening.corporate.reasons,...closing.corporate.reasons,...opening.listing.reasons,...closing.listing.reasons,...openingDetails.reasons,...closingDetails.reasons]
  for(const phase of [opening,closing]){
   if(unreconciledLinks(phase.corporate.hiringLinks,phase).length)reasons.push('unreconciled-corporate-hiring-link')
   for(const shell of phase.shells){
    if(unreconciledLinks(shell.hiringLinks,phase).length)reasons.push('unreconciled-native-shell-hiring-link:'+shell.url)
    if(shell.frames.length)reasons.push('unresolved-native-shell-frame:'+shell.url)
   }
  }
  if(canonical(ids(opening))!==canonical(ids(closing)))reasons.push('native-global-identities-changed')
  if(canonical(opening.corporate)!==canonical(closing.corporate)||canonical(opening.clients)!==canonical(closing.clients)||canonical(opening.organization)!==canonical(closing.organization)||canonical(opening.shells)!==canonical(closing.shells))reasons.push('corporate-or-native-employer-scope-changed')
  const healthy=[]
  for(const row of opening.listing.records){const left=openingDetails.results.get(row.JobId),right=closingDetails.results.get(row.JobId);if(!left||!right)continue;if(canonical(left.semantic)!==canonical(right.semantic)){reasons.push('role-changed-during-closing:'+row.JobId);continue}if(left.country==='India')healthy.push({...left.job,nativeRoleClosingReconciled:true,nativeSourceRecord:{...left.job.nativeSourceRecord,nativeClosingListing:right.job.nativeSourceRecord.nativeListing,nativeClosingDetail:right.job.nativeSourceRecord.nativeDetail,nativeClosingJobPosting:right.job.nativeSourceRecord.nativeJobPosting,nativePublisher:{corporateURL:CAREER_PAGE_URL,boardURL:BOARD_URL,orgId:ORG_ID,organization:opening.organization,clients:opening.clients}}})}
  if(maxJobs<healthy.length)reasons.push('caller-cap-after-full-native-reconciliation')
  const contexts=phase=>({corporate:{hiringLinks:phase.corporate.hiringLinks,frames:phase.corporate.frames},native:phase.shells})
  const complete=reasons.length===0,evidence={source:'monocept',surface:CAREER_PAGE_URL,nativeSurface:DASHBOARD_URL,advertisedNativeSurface:BOARD_URL,observedGlobalRecords:opening.listing.records.length,reportedTotal:opening.listing.total,confirmedIndiaRecords:healthy.length,confirmedForeignRecords:[...openingDetails.results.values()].filter(r=>r.country!=='India').length,unresolvedRecords:opening.listing.records.length-openingDetails.results.size,closingReconciled:true,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,reasons:[...new Set(reasons)],surfaceContexts:{opening:contexts(opening),closing:contexts(closing)},retainedResponses,verifiedAt:now,anonymousSessionCredentialsRetained:false,publicRolePageFetched:true,applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false}
  const jobs=healthy.slice(0,maxJobs).map(job=>({...job,sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceObservedGlobalJobCount:opening.listing.records.length,sourceObservedIndiaJobCount:healthy.length,nativeCollectionEvidence:evidence}))
  Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence,enumerable:false});signal.throwIfAborted()
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...evidence,nativeRecords:evidence.observedGlobalRecords,unresolved:evidence.reasons}})
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:CAREER_PAGE_URL,firstParty:true,listingComplete:complete,pagesFetched:retainedResponses.length,reportedTotal:opening.listing.total,indiaFacetCount:healthy.length,verifiedAt:now,reason:complete?'complete-native-global-opening-and-closing-snapshots-reconciled':evidence.reasons.join(';')})
 }catch(error){if(/timed? out|timeout|fetch failed|connect|socket|econn|enotfound|eai_again|tls|deadline/i.test(String(error?.message)))Object.assign(error,{softFailure:true,upstreamOutage:true,abortRetries:true,failureKind:'network_or_timeout'});throw error}finally{token=null;clearTimeout(timer)}
}
