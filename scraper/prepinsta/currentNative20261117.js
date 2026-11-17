import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='prepinsta',CAREERS='https://prepinsta.com/career-opportunities/',ANGEL='https://angel.co/company/prepinsta/jobs',BOARD='https://wellfound.com/company/prepinsta/jobs'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function corporate(body){
 const doc=readNativeDocument(body),links=doc.nodes(n=>n.tag==='a'&&['Start Your Career With Us','Click Here to Check'].includes(doc.text(n))).map(n=>({text:doc.text(n),href:n.attrs.href})),canonicals=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(isDeepStrictEqual(activeHead(body).titles,['PrepInsta Career Opportunities'])&&!doc.nodes(n=>n.tag==='base').length&&canonicals.length===1&&canonicals[0].attrs.href===CAREERS,'Current own corporate identity/base changed')
 need(isDeepStrictEqual(links,[{text:'Start Your Career With Us',href:'https://angel.co/company/prepinsta'},{text:'Click Here to Check',href:ANGEL}]),'Current own corporate recruitment links changed')
 return {title:activeHead(body).titles[0],links}
}
function native(body){
 const doc=readNativeDocument(body),nodes=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')
 need(nodes.length===1&&nodes[0].attrs.type==='application/json'&&!doc.nodes(n=>n.tag==='base').length,'One original native Next model required')
 const input=JSON.parse(nodes[0].raw),page=input.props?.pageProps,data=page?.apolloState?.data,reference=data?.ROOT_QUERY?.['startup({"slug":"prepinsta"})']?.__ref,tenant=data?.[reference]
 need(page?.params?.slug==='prepinsta'&&page.parsedUrl?.pathname==='/company/prepinsta/jobs'&&reference==='Startup:4128337'&&tenant?.id==='4128337'&&tenant.__typename==='Startup'&&tenant.name==='PrepInsta'&&tenant.slug==='prepinsta'&&tenant.companyUrl==='http://www.prepinsta.com','Current native tenant/employer identity changed')
 need(isDeepStrictEqual(activeHead(body).titles,['Jobs at PrepInsta: Explore current Opportunities']),'Current native own jobs title changed')
 const connections=Object.entries(tenant).filter(([key])=>key.startsWith('jobListingsConnection('))
 need(connections.length===1,'Native tenant jobs connection is ambiguous')
 const [query,connection]=connections[0],descriptor=JSON.parse(query.slice('jobListingsConnection('.length,-1))
 need(descriptor.after==='MA=='&&descriptor.first===20&&isDeepStrictEqual(descriptor.filters,{acceptedRemoteLocationIds:[],jobSourceIds:[],jobTypes:[],locationIds:[],roleIds:[]})&&connection.__typename==='JobListingConnection'&&connection.pageSize===0&&connection.totalPageCount===1&&Array.isArray(connection.edges)&&connection.edges.length===0&&tenant.liveJobListingsCount===0,'Native tenant observation no longer matches its empty unfiltered connection; company inventory remains unknown')
 need(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Jobs at PrepInsta').length===1,'Current native own heading changed')
 // Related jobs and recommended employers are retained in the whole original
 // model, but cannot supply vacancies for this exact tenant.
 return {tenant:structuredClone(tenant),queryDescriptor:descriptor,wholeNativeNextInput:input,browserActivationQualified:false,companyInventoryQualified:false}
}
export async function runCurrentPrepinsta(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original fetch response metadata required')
 const timeout=options.sourceTimeoutMs??90000,readMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(readMs)&&readMs>0&&readMs<=15000,'Invalid current native deadlines')
 const owner=new AbortController(),started=performance.now(),timer=setTimeout(()=>owner.abort(new DOMException('PrepInsta native source deadline exceeded','TimeoutError')),timeout),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal
 const receipts=[];let next=0,total=0,opening,closing
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=timeout&&!owner.signal.aborted)owner.abort(new DOMException('PrepInsta native source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 const read=async(url,redirect)=>{
  check();need([CAREERS,ANGEL,BOARD].includes(url)&&receipts.length<6,'Unbound or excessive current native request')
  if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
  check();next=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString(),status:null,bodyComplete:false};receipts.push(receipt);let observedHTTPError
  try{
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:readMs,overflowError:firstPartyFailure(SOURCE,'Original native16MiB byte ceiling'),fetchImpl:async(requested,init)=>{
    const result=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    Object.assign(receipt,{status:result.status,finalUrl:result.url,headers:Object.fromEntries(result.headers)})
    try{
     if(!(redirect&&result.status===301&&result.url===requested&&!isHttpAccessChallenge(result)&&new URL(result.headers.get('location'),requested).href===redirect))await requireNativeHttpResponse({status:result.status,url:result.url,headers:result.headers,body:null},requested,{context:'PrepInsta current native read',signal:init.signal,callerSignal:options.signal??null})
     if(redirect)need(result.status===301&&new URL(result.headers.get('location'),requested).href===redirect,'Exact employer-declared native301 handoff changed')
    }catch(error){observedHTTPError=error;disposeResponseBody(result,{bestEffort:true}).catch(()=>{});throw error}
    return result
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');total+=bytes.length
   Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:sha(bytes)});need(total<=4*1024*1024,'Aggregate native byte ceiling exceeded')
   need(/^text\/html(?:;|$)/i.test(response.headers['content-type']??''),'Original native HTML MIME changed')
   return new TextDecoder('utf8',{fatal:true}).decode(bytes)
  }catch(error){options.signal?.throwIfAborted();throw observedHTTPError??error}finally{receipt.completedAt=new Date().toISOString()}
 }
 const round=async()=>{const authority=corporate(await read(CAREERS));await read(ANGEL,BOARD);return {careerAuthority:authority,...native(await read(BOARD))}}
 try{
  opening=await round();closing=await round();need(isDeepStrictEqual({authority:opening.careerAuthority,tenant:opening.tenant,query:opening.queryDescriptor},{authority:closing.careerAuthority,tenant:closing.tenant,query:closing.queryDescriptor}),'Closing whole own native tenant model changed');check()
  const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,nativeOpening:opening,nativeClosing:closing,originalResponses:receipts,wholeObservedNativeTenantClosingReconciled:true,relatedEmployerRecommendationsExcluded:true,companyIndiaZeroProven:false,browserActivationQualified:false,lifecycleCleanupAllowed:false},configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-exact-employer-declared-native-tenant-empty-observations-reconciled;company-inventory-and-browser-activation-unqualified'})
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null}})}catch{}throw error}
 finally{clearTimeout(timer);owner.abort()}
}
