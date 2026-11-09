import {extractWorkdayStructuredDetail} from '../../scraper-support/myworkday/engine.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {BOARD,API,CLIENT,CAREERS,check,verifyShell,canonicalFacets,discoverOffices,listing,detail,detailSnapshot,description,nativeDate} from './nativeContract.js'

export async function runNative({signal,now,fetchImpl=globalThis.fetch,requestIntervalMs=1000}){
 check(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&(requestIntervalMs>=1000||fetchImpl!==globalThis.fetch),'Invalid native request interval')
 let cookies='',csrf='',requestCount=0
 const lastRequest=new Map(),sha=value=>createHash('sha256').update(value).digest('hex')
 const clientURL=url=>{try{const u=new URL(url);return u.origin==='https://prod-wd103.myworkdaycdn.com'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/wday\/asset\/candidate-experience-jobs\/(?:\d{4}\.\d{1,2}\.\d{1,3}\/)?cx-jobs\.min\.js$/.test(u.pathname)}catch{return false}}
 async function request(url,body,isClient=false){
  signal.throwIfAborted()
  const json=Boolean(body)||url.startsWith(API+'/job/')
  check(url===CAREERS||url===BOARD||url===CLIENT||url.startsWith(API+'/job/')||url===API+'/jobs','Unreviewed native URL')
  const headers={Accept:json?'application/json':isClient?'application/javascript,*/*;q=0.8':'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0',...(body?{'Content-Type':'application/json'}:{}),...(new URL(url).origin===new URL(BOARD).origin&&cookies?{Cookie:cookies}:{}),...(body&&csrf?{'x-calypso-csrf-token':csrf}:{})}
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(15000)])
  const fetchOne=async target=>{
   check(++requestCount<=280,'Native request bound exceeded')
   const origin=new URL(target).origin,wait=requestIntervalMs-(Date.now()-(lastRequest.get(origin)||0))
   if(wait>0)await delay(wait,undefined,{signal:requestSignal})
   lastRequest.set(origin,Date.now());requestSignal.throwIfAborted()
   return fetchImpl(target,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',redirect:'manual',signal:requestSignal})
  }
  let response=await fetchOne(url)
  if(isClient&&[301,302,303,307,308].includes(response.status)){
   const target=new URL(response.headers.get('location'),url).href
   check(clientURL(target),'Advertised client redirect URL invalid');response=await fetchOne(target)
  }
  const binding=url===CAREERS,redirectTarget=binding?response.headers.get('location'):null
  if(response.status!==200&&!(binding&&response.status===301)){
   await response.body?.cancel?.().catch(()=>{})
   throw Object.assign(Error('Dover native: Native public HTTP '+response.status),{
    status:response.status,requestUrl:url,finalUrl:response.url,abortRetries:[401,403,429,451].includes(response.status),incompleteScope:true,
   })
  }
  if(!(isClient?clientURL(response.url):response.url===url)){
   await response.body?.cancel?.().catch(()=>{})
   check(false,'Native final URL identity failure')
  }
  if(binding&&!(response.status===301&&redirectTarget===BOARD)){
   await response.body?.cancel?.().catch(()=>{})
   check(false,'Official careers redirect handoff changed')
  }
  if(url===BOARD){const set=response.headers.getSetCookie?.()??[];cookies=set.map(v=>v.split(';')[0]).join('; ');csrf=set.find(v=>v.startsWith('CALYPSO_CSRF_TOKEN='))?.split(';')[0].slice(19)??''}
  const mime=response.headers.get('content-type')||''
  check(binding||(json?/application\/json\b/i:isClient?/(?:java|ecma)script/i:/text\/html\b/i).test(mime),'Native response MIME changed')
  const chunks=[];let size=0
  if(response.body){for await(const chunk of response.body){requestSignal.throwIfAborted();size+=chunk.byteLength;check(size<=10000000,'Native response body bound exceeded');chunks.push(Buffer.from(chunk))}}
  else if(fetchImpl!==globalThis.fetch){const value=await response.text();size=Buffer.byteLength(value);check(size<=10000000,'Native response body bound exceeded');chunks.push(Buffer.from(value))}
  else check(binding,'Native response body unavailable')
  const bytes=Buffer.concat(chunks);requestSignal.throwIfAborted();signal.throwIfAborted()
  return{body:new TextDecoder('utf-8',{fatal:true}).decode(bytes),requestedURL:url,finalURL:response.url,bodySHA256:sha(bytes),...(binding?{redirectStatus:response.status,redirectTarget}: {})}
 }
 const corporate=await request(CAREERS)
 const shell=(await request(BOARD)).body
 verifyShell(shell)
 const client=await request(CLIENT,undefined,true);check(client.body.includes('appliedFacets'),'Native advertised public client contract missing')
 const search=async body=>JSON.parse((await request(API+'/jobs',body)).body)
 const globalBody={appliedFacets:{},limit:20,offset:0,searchText:''}
 const initialGlobal=await search(globalBody),offices=discoverOffices(initialGlobal),snapshots=[],rows=[],reqs=new Set(),paths=new Set()
 for(const office of offices){
  for(let offset=0;offset<Math.max(1,office.count);offset+=20){
   check(offset<2000,'Native page bound exhausted')
   const body={appliedFacets:{locations:[office.id]},limit:20,offset,searchText:''},raw=await search(body),state=listing(raw,office,offset)
   snapshots.push({body,office,offset,state,raw})
   for(const row of state.rows){check(!reqs.has(row.req)&&!paths.has(row.externalPath),'Duplicate native selected listing identity');reqs.add(row.req);paths.add(row.externalPath);rows.push(row)}
  }
 }
 // Preserve transport order for the captured native detail sequence, regardless
 // of harmless listing order changes. IDs, not title similarity, identify roles.
 rows.sort((a,b)=>a.officeId.localeCompare(b.officeId)||a.req.localeCompare(b.req))
 const details=new Map(),uids=new Set()
 for(const row of rows){const payload=JSON.parse((await request(API+row.externalPath)).body),v=detail(payload,row,now());check(!uids.has(v.id),'Duplicate native posting UID');uids.add(v.id);details.set(row.req,payload)}
 const finalGlobal=await search(globalBody);discoverOffices(finalGlobal)
 check(JSON.stringify(canonicalFacets(initialGlobal.facets))===JSON.stringify(canonicalFacets(finalGlobal.facets)),'Native global typed facet drift')
 for(const snapshot of snapshots){const final=listing(await search(snapshot.body),snapshot.office,snapshot.offset);check(JSON.stringify(snapshot.state)===JSON.stringify(final),'Native selected listing/facet/identity drift')}
 const jobs=[]
 for(const row of rows){
  const payload=JSON.parse((await request(API+row.externalPath)).body),v=detail(payload,row,now()),prior=details.get(row.req)
  check(detailSnapshot(prior)===detailSnapshot(payload),'Native authoritative detail drift')
  const active=description(v.jobDescription),mapped=active?extractWorkdayStructuredDetail(payload):null
  check(!active||mapped,'Native description mapping unavailable')
  jobs.push({jobId:v.jobReqId,requisitionId:v.jobReqId,title:v.title,company:'Dover Corporation',source:'dovercorporation',
   location:v.location,city:v.location.split(',')[0],locations:[v.location],country:'India',
   sourceUrl:v.externalUrl,link:v.externalUrl,applyUrl:v.externalUrl,sourceApplicationEvidence:{posted:true,canApply:true,exactAdvertisedRoleURL:v.externalUrl,explicitApplyURL:null,applicationLandingPageFetched:false},
   postedAt:nativeDate(v.startDate,now(),true),postingDate:v.startDate,postingDatePrecision:'calendar-date',sourcePostedDateRaw:v.startDate,firstEverPostedAt:null,closingDate:v.endDate==null?null:nativeDate(v.endDate,now()),sourceClosingDateIsExact:false,scrapedAt:now(),
   jobDescription:active,sourceDescription:active?v.jobDescription:null,sourceDetailComplete:Boolean(active),
   ...(!active?{sourceRejectedNativeDescription:v.jobDescription??null,sourceDetailFailureKind:'unqualified-role-content'}:{}),
   department:mapped?.department,minimumQualification:mapped?.minimumQualification,preferredQualification:mapped?.preferredQualification,requiredSkills:mapped?.requiredSkills,experienceRequired:mapped?.experienceRequired,publicExperienceChecked:Boolean(active),
   nativeEmployer:payload.hiringOrganization.name,nativeHiringOrganization:structuredClone(payload.hiringOrganization),nativeSourceRecord:structuredClone(payload),nativeListingRecord:structuredClone(snapshots.flatMap(s=>s.raw.jobPostings).find(r=>r.externalPath===row.externalPath)),nativeBoardProvenance:[{tenant:'dover',site:'Dover',nativePostingUid:v.id,requisitionId:v.jobReqId,canonicalUrl:v.externalUrl,nativeEmployer:payload.hiringOrganization.name}],
   sourceOfficialBinding:{careersURL:CAREERS,boardURL:BOARD,bindingKind:'first-party-careers-host-redirect',redirectStatus:corporate.redirectStatus,redirectTarget:corporate.redirectTarget,observedAt:now(),bodySHA256:corporate.bodySHA256,companyScopeComplete:false},sourceClientIdentity:{requestedURL:client.requestedURL,finalURL:client.finalURL,bodySHA256:client.bodySHA256},
   sourceNativeLocationFacets:{parameter:'locations',ids:offices.map(v=>v.id),values:structuredClone(offices),selectedOfficeId:row.officeId,scope:'current-explicit-native-India-office-facets'},
   sourceListingComplete:false,sourceScopeComplete:false,sourceCompanyCoverageComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,
   sourceObservedIndiaJobCount:rows.length,sourceBoardInventories:offices.map(office=>({tenant:'dover',site:'Dover',scope:'configured-native-location-subset',appliedFacets:{locations:[office.id]},reportedTotal:office.count,observedIndia:office.count,pagesFetched:Math.max(1,Math.ceil(office.count/20)),stableReportedTotal:true,explicitGlobalEmpty:false})),
   sourceFinalListingEvidence:{allSelectedPagesRechecked:true,allSelectedDetailsRechecked:true,typedFacetSetsRechecked:true,pagesFetched:snapshots.length,companyGlobalTotal:null,companyIndiaTotal:null},lifecycleCleanupAllowed:false,applicationVisited:false,
  })
 }
 const finalCorporate=await request(CAREERS)
 for(const job of jobs)Object.assign(job.sourceOfficialBinding,{closingBodySHA256:finalCorporate.bodySHA256,closingObservedAt:now(),currentHandoffRechecked:true})
 signal.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:snapshots.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'current-explicit-native-India-office-facets-company-recruitment-scope-unproven'})
}
