import {isDeepStrictEqual} from 'node:util'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='springworks',ABOUT='https://www.springworks.in/about-us/',HANDOFF='https://springworks.goodfit.so/careers/springworks'
const REDIRECT='https://jobs.goodfit.so/careers/springworks',BOARD='https://jobs.goodfit.so/jobs/springworks'
const permitted=new Set([ABOUT,HANDOFF,REDIRECT,BOARD]),clean=value=>value.replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const sha=value=>createHash('sha256').update(value).digest('hex')

function currentAbout(html){
 const doc=readNativeDocument(html)
 need(isDeepStrictEqual(activeHead(html).titles,['About Us - SpringVerify'])&&!doc.nodes(node=>node.tag==='base').length,'Current corporate identity/base changed')
 const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href===HANDOFF&&['Join our team','Work with Us'].includes(doc.text(node)))
 need(links.length===2&&new Set(links.map(node=>doc.text(node))).size===2,'Current exact corporate recruitment handoff changed')
 return {title:activeHead(html).titles[0],recruitmentLinks:structuredClone(links),
  employerLegalIdentityQualified:false,browserVisibilityQualified:false}
}

function nativeRows(html,extractCards){
 const doc=readNativeDocument(html)
 need(!doc.nodes(node=>node.tag==='base').length,'Current native board base changed')
 const groups=[],records=readLiteralFlightRecords(html)
 need(records instanceof Map,'Native literal Flight models unavailable')
 const visit=value=>{if(!value||typeof value!=='object')return
  if(!Array.isArray(value)&&Array.isArray(value.jobs))groups.push(value.jobs)
  for(const child of Object.values(value))visit(child)
 }
 for(const record of records.values())visit(record.value)
 need(groups.length===1&&groups[0].length>0&&groups[0].length<=200,'One bounded whole native jobs model required')
 const rows=groups[0],seen=new Set(),cards=extractCards(html)
 need(isDeepStrictEqual(activeHead(html).titles,[`Springworks Careers: ${rows.length} Open Jobs | Goodfit`]),'Current native effective title/count changed')
 need(cards.length===rows.length,'Native whole model/card accounting changed')
 for(const row of rows){
  need(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id)
   &&!seen.has(row.id)&&typeof row.title==='string'&&row.title.trim()&&Array.isArray(row.locations),'Native row identity/model changed')
  seen.add(row.id)
  need(row.organization?.name==='Springworks'&&row.organization.slug==='springworks','Native row tenant label changed')
  const card=cards.filter(value=>value.jobId===row.id)
  need(card.length===1&&clean(card[0].title)===clean(row.title),'Whole native card/model identity changed')
 }
 // These are retained data observations. Current client activation, full own
 // role criteria, legal employer and work-country semantics remain unproved.
 return {rows:structuredClone(rows),cards:structuredClone(cards)}
}

export async function runCurrentSpringworks(options={},extractCards){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata required')
 const timeoutMs=options.sourceTimeoutMs??90000,readMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(readMs)&&readMs>0&&readMs<=15000,'Invalid source/read deadline')
 const owner=new AbortController(),timer=setTimeout(()=>owner.abort(new DOMException('Springworks source deadline exceeded','TimeoutError')),timeoutMs)
 const signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal,receipts=[]
 let nextStart=0,totalBytes=0,opening,closing
 const read=async(url,target)=>{
  signal.throwIfAborted();need(permitted.has(url)&&receipts.length<8,'Undeclared or excessive native request')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
  signal.throwIfAborted();nextStart=performance.now()+500
  const receipt={requestedURL:url,method:'GET',status:null,bodyComplete:false,requestedAt:new Date().toISOString()}
  receipts.push(receipt)
  let observedHTTPError,page
  try{
   page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:readMs,fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    Object.assign(receipt,{status:response.status,url:response.url,headers:Object.fromEntries(response.headers)})
    try{
     if(target&&response.status===308&&response.url===requested&&!isHttpAccessChallenge(response)){
      let location;try{location=new URL(response.headers.get('location'),requested).href}catch{}
      if(location!==target)throw firstPartyFailure(SOURCE,'Current exact declared308 handoff changed',
       {status:308,httpStatus:308,requestUrl:requested,failureKind:'parser_or_contract_error'})
     }else{
      // Validate observed status/identity before reading an error entity. The
      // actual body is disposed independently, so a local body deadline cannot
      // replace an already observed denial. Explicit caller abort still wins.
      await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,
       {context:'Springworks current native read',signal:init.signal,callerSignal:options.signal??null})
      if(target)throw firstPartyFailure(SOURCE,'Current exact declared308 handoff changed',
       {status:response.status,httpStatus:response.status,requestUrl:requested,failureKind:'parser_or_contract_error'})
     }
    }catch(error){
     observedHTTPError=error
     disposeResponseBody(response,{bestEffort:true}).catch(()=>{})
     throw error
    }
    return response
   },overflowError:firstPartyFailure(SOURCE,'Original native response exceeds16MiB bound')})
  }catch(error){options.signal?.throwIfAborted();throw observedHTTPError??error}
  finally{receipt.completedAt=new Date().toISOString()}
  const bytes=Buffer.from(page.bodyBase64,'base64');totalBytes+=bytes.length
  Object.assign(receipt,{...page,bodyComplete:true,bodyBytes:bytes.length,sha256:sha(bytes)})
  signal.throwIfAborted();need(totalBytes<=16*1024*1024,'Aggregate native byte bound exceeded')
  need(page.url===url,'Original native final URL changed')
  if(target){
   let location;try{location=new URL(page.headers.location,url).href}catch{}
   need(page.status===308&&location===target&&bytes.length<=1024,'Current exact declared308 handoff changed')
   return {status:page.status,url,location,bodySHA256:sha(bytes)}
  }
  need(page.status===200&&/^text\/html(?:;|$)/i.test(page.headers['content-type']??''),'Original native HTML representation changed')
  return new TextDecoder('utf8',{fatal:true}).decode(bytes)
 }
 const round=async()=>({about:currentAbout(await read(ABOUT)),redirects:[await read(HANDOFF,REDIRECT),await read(REDIRECT,BOARD)],
  native:nativeRows(await read(BOARD),extractCards)})
 try{
  opening=await round();closing=await round()
  need(isDeepStrictEqual(opening,closing),'Closing complete observed native models changed')
  const jobs=[],observedAt=new Date().toISOString()
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.native.rows.length,
   observedVacancyCount:opening.native.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:SOURCE,
   observations:opening.native.rows.map(row=>({nativeRecord:row,country:null,fullRoleCriteriaQualified:false})),
   nativeOpening:opening,nativeClosing:closing,retainedResponses:receipts,wholeObservedNativeRowsClosingReconciled:true,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,publicApplicationEligibilityQualified:false,browserVisibilityQualified:false,
   companyIndiaTotal:null,companyGlobalTotal:null,fullOwnRoleCriteriaQualified:false}})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,
   lifecycleCleanupAllowed:false,pagesFetched:8,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-exact-employer-declared-native-models-observed;role-country-full-own-criteria-client-activation-application-and-company-scope-unqualified'})
 }catch(error){
  options.signal?.throwIfAborted()
  try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,
   nativeOpening:opening,nativeClosing:closing,retainedResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})}catch{}
  throw error
 }finally{clearTimeout(timer);owner.abort()}
}
