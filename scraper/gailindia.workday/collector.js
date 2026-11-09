import crypto from 'node:crypto'
import {createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {requireNative} from '../../scraper-support/shared/nativeJobPosting.js'
import {readBoard,readMedicalNotice,SOURCE,COMPANY,BOARD} from './parser.js'
import {readNativePDF} from './pdf.js'
const ensure=(value,message)=>requireNative(value,'GAIL: '+message)
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')

export async function collectNativeNotices(options={}){
 ensure(options.maxJobs==null,'Partial maxJobs is unsupported')
 const clock=new Date((options.now??(()=>new Date().toISOString()))()).toISOString(),stop=new AbortController()
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),stop.signal,AbortSignal.timeout(180000)])
 const allowedPDFs=new Set(),validateURL=value=>{
  const url=new URL(value)
  ensure(!url.username&&!url.password&&!url.search&&!url.hash&&url.origin==='https://www.gailonline.com','Unknown public origin/query/credentials')
  ensure(value===BOARD||allowedPDFs.has(value)&&/^\/careers\/currentOpnning\/.+\.pdf$/i.test(url.pathname)
   &&!/application[-_ ]?form|instruction|login|consent|register/i.test(url.pathname),'Unqualified public notice or application URL')
 }
 const fetchImpl=options.fetchImpl??globalThis.fetch
 const transport=options.transport??createHTMLTransport({validateURL},{signal,fetchImpl:(url,request)=>fetchImpl(url,{...request,headers:{...request.headers,Accept:url===BOARD?'text/html':'application/pdf'}})})
 const result={source:SOURCE,status:'unknown',qualifiedScope:'recent native advertisement notices with fully verified role details;not whole employer inventory',
  jobs:[],exclusions:[],failures:[],retainedResponses:[],observedListingCount:null,candidateDetails:0,nativeReportedTotal:null,pagesFetched:0,
  listingPaginationComplete:false,closingInventoryMatches:false,sourceScopeComplete:false,wholeCompanyScope:false,cleanupAllowed:false,verifiedZeroInventory:false,handoffVerified:false,nativeNoticeInventory:null}
 let reads=0,totalBytes=0
 const failure=(stage,error,row)=>result.failures.push({stage,code:error?.code??null,message:String(error?.message??error).slice(0,400),...(row?{candidate:{id:row.id,title:row.title,url:row.detailURL}}:{})})
 const read=async url=>{
  signal.throwIfAborted();validateURL(url);ensure(++reads<=12,'Public request budget exceeded')
  const packet=await transport(url,{method:'GET',signal,redirect:'manual',credentials:'omit'})
  ensure(packet?.url===url&&packet.bodyComplete===true&&packet.body instanceof Uint8Array&&Number.isInteger(packet.status),'Incomplete native transport response')
  const body=Buffer.from(packet.body),headers=Object.fromEntries(Object.entries(packet.headers??{}).map(([k,v])=>[k.toLowerCase(),v]))
  totalBytes+=body.length;ensure(body.length<=2097152&&totalBytes<=24*1024*1024,'Native response/aggregate byte bound')
  result.retainedResponses.push({url,status:packet.status,headers,bodyBytes:body.length,bodySHA256:hash(body),rawBodyBase64:body.toString('base64'),bodyRepresentation:'complete decoded HTTP response bytes;not compressed wire bytes',requestedAt:packet.requestedAt??null,completedAt:packet.completedAt??null})
  if([401,403,429].includes(packet.status))stop.abort(Error('Public access/rate limit;stop further reads'))
  ensure(packet.status===200,'HTTP '+packet.status+' on public native resource')
  ensure(typeof headers['content-type']==='string'&&headers['content-type'].split(';')[0].trim().toLowerCase()===(url===BOARD?'text/html':'application/pdf'),'Native MIME type changed')
  return body
 }
 let listing
 try{
  listing=readBoard(new TextDecoder('utf-8',{fatal:true}).decode(await read(BOARD)),clock)
  result.handoffVerified=true;result.pagesFetched=1;result.listingPaginationComplete=true
  result.nativeNoticeInventory=listing.nativeNoticeInventory;result.observedListingCount=listing.recent.length;result.candidateDetails=listing.recent.length
  if(listing.nativeNoticeInventory.unknownPostingDateNoticeCards||listing.nativeNoticeInventory.futurePostingDateNoticeCards)failure('native-listing-row',Error('Unknown/future native notice posting dates retained;not a zero inventory'))
  for(const row of listing.recent){
   try{
    ensure(row.id&&row.title&&row.detailURL,'Missing native notice identity or detailed advertisement link')
    allowedPDFs.add(row.detailURL);validateURL(row.detailURL)
    const body=await read(row.detailURL),parsed=await(options.parsePdf??readNativePDF)(body,{signal}),fact=readMedicalNotice(parsed,row,clock)
    if(fact.excluded)result.exclusions.push(fact);else result.jobs.push(fact)
   }catch(error){failure('native-detail',error,row);if(signal.aborted)break}
  }
  if(!signal.aborted)try{
   const closing=readBoard(new TextDecoder('utf-8',{fatal:true}).decode(await read(BOARD)),clock)
   ensure(closing.fingerprint===listing.fingerprint,'Notice inventory changed during detail check')
   result.closingInventoryMatches=true
  }catch(error){failure('closing-inventory',error)}
 }catch(error){failure(listing?'native-detail':'native-handoff',error)}
 result.extractedDetailJobs=result.jobs.length;result.excludedDetailJobs=result.exclusions.length
 result.httpReads=reads;result.decodedResponseBytes=totalBytes
 result.status=result.failures.length?'partial':'native-recent-notice-scope-read'
 if(!result.jobs.length)throw Object.assign(Error(COMPANY+' native notice scope has no fully verified current role;cleanup forbidden'),{name:'NativeGAILIncompleteError',code:'NATIVE_GAIL_INCOMPLETE',nativeEvidence:result})
 options.signal?.throwIfAborted()
 const jobs=result.jobs.map(job=>({...job,nativeCollectionEvidence:result}))
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:result.handoffVerified,listingComplete:false,pagesFetched:result.pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,
  reason:`Native recent-notice slice;${result.nativeNoticeInventory.observedNoticeCards}notice cards are not job totals;${result.nativeNoticeInventory.ageExcludedNoticeCards}older vacancy notices;${result.nativeNoticeInventory.nonVacancyNoticeCards}administrative notices;${result.nativeNoticeInventory.unknownPostingDateNoticeCards}unknown posting days;${result.jobs.length}verified current role details;whole-employer scope unknown;cleanup forbidden;state=${result.status}`})
}
