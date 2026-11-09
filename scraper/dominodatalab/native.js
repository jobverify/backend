import crypto from 'node:crypto'
import {createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {expandApiPortalProviderTemplate} from '../../scraper-support/providers/apiPortalTemplates.js'
import {runApiPortalScraper} from '../../scraper-support/apiPortal/engine.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {SOURCE,COMPANY,HOME,PORTAL,LIST,DETAIL,ensure,readOfficialHome,readPortal,readListing,readDetail} from './parser.js'
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
export async function runNative(options={}){
 ensure(options.maxJobs==null,'Partial maxJobs is unsupported')
 const clock=new Date((options.now??(()=>new Date().toISOString()))()).toISOString(),stop=new AbortController(),signal=AbortSignal.any([...(options.signal?[options.signal]:[]),stop.signal,AbortSignal.timeout(180000)])
 const allowed=new Set([HOME,PORTAL,LIST]),validateURL=url=>ensure(allowed.has(url),'Unlisted public resource or application action')
 const fetchImpl=options.fetchImpl??globalThis.fetch
 const transport=options.transport??createHTMLTransport({validateURL},{signal,fetchImpl:(url,request)=>fetchImpl(url,{...request,headers:{...request.headers,Accept:url===HOME?'text/html':'application/json'}})})
 const result={source:SOURCE,status:'unknown',jobs:[],exclusions:[],failures:[],retainedResponses:[],observedListingCount:null,nativeReportedTotal:null,candidateDetails:null,observedIndiaListingCount:null,nonIndiaListingCount:null,
  pagesFetched:0,listingPaginationComplete:false,closingInventoryMatches:false,sourceScopeComplete:false,wholeCompanyScope:false,cleanupAllowed:false,verifiedZeroInventory:false,handoffVerified:false}
 let physicalReads=0,totalBytes=0,stage='native-handoff',listing,binding,innerEvidence,jobs=[]
 const details=new Map()
 const read=async url=>{
  signal.throwIfAborted();validateURL(url);ensure(++physicalReads<=64,'Native request budget exceeded')
  const p=await transport(url,{method:'GET',redirect:'manual',credentials:'omit',signal})
  ensure(p?.url===url&&p.bodyComplete===true&&p.body instanceof Uint8Array&&Number.isInteger(p.status),'Incomplete native transport')
  const bytes=Buffer.from(p.body),headers=Object.fromEntries(Object.entries(p.headers??{}).map(([k,v])=>[k.toLowerCase(),v]));totalBytes+=bytes.length
  ensure(bytes.length<=2097152&&totalBytes<=32*1024*1024,'Native body/aggregate byte bound')
  result.retainedResponses.push({url,status:p.status,headers,bodyBytes:bytes.length,bodySHA256:sha(bytes),rawBodyBase64:bytes.toString('base64'),bodyRepresentation:'complete decoded HTTP response bytes;not compressed wire bytes',requestedAt:p.requestedAt??null,completedAt:p.completedAt??null})
  if([401,403,429].includes(p.status))stop.abort(Error('Public access/rate limit;no further reads'))
  ensure(p.status===200,'HTTP '+p.status+' from public native resource')
  ensure(headers['content-type']?.split(';')[0].trim().toLowerCase()===(url===HOME?'text/html':'application/json'),'Unexpected native MIME')
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 }
 try{
  readOfficialHome(await read(HOME));binding=readPortal(JSON.parse(await read(PORTAL)));result.handoffVerified=true;result.nativeBinding=binding
  stage='native-pagination';listing=readListing(JSON.parse(await read(LIST)))
  result.observedListingCount=listing.records.length;result.nativeReportedTotal=listing.data.meta.total;result.candidateDetails=listing.selected.length
  result.observedIndiaListingCount=listing.selected.length;result.nonIndiaListingCount=listing.records.length-listing.selected.length
  result.pagesFetched=1;result.listingPaginationComplete=true
  result.nativePublicIDCorrespondence={nativePortalIDs:binding.nativePublicRoleIDs.length,nativeGreenhouseIDs:listing.records.length,matched:listing.records.filter(r=>binding.nativePublicRoleIDs.includes(String(r.id))).length}
  for(const row of listing.selected)allowed.add(DETAIL+row.id)
  const provider=expandApiPortalProviderTemplate({source:SOURCE,companyName:COMPANY,companyCareerPage:HOME,atsPlatform:'greenhouse',countryFilter:'India',template:'greenhouse',templateOptions:{boardToken:'dominodatalab',locationPattern:'\\bIndia\\b'},
   config:{recordFilter:{include:[{field:'id',pattern:listing.selected.length?'^(?:'+listing.selected.map(j=>j.id).join('|')+')$':'(?!)'}]},
    detail:{enabled:true,required:true,concurrency:1,method:'GET',urlTemplate:DETAIL+'{{jobId}}',mapping:{jobDescription:'content'}}}})
  let cachedRead=false
  stage='native-detail'
  const mapped=await runApiPortalScraper({provider,signal,fetchJson:async(url,request)=>{
   ensure((request?.method??'GET')==='GET','Non-GET native action prohibited')
   if(url===LIST){ensure(!cachedRead,'Unexpected engine pagination');cachedRead=true;return listing.data}
   const row=listing.selected.find(j=>url===DETAIL+j.id);ensure(row,'Unselected native detail URL')
   const detail=readDetail(JSON.parse(await read(url)),row);details.set(String(row.id),detail);return detail.raw
  }})
  innerEvidence=readInventoryEvidence(mapped)
  jobs=mapped.map(job=>{
   const detail=details.get(String(job.jobId)),raw=listing.selected.find(j=>String(j.id)===String(job.jobId))
   ensure(detail&&raw&&job.nativePublication?.status==='known'&&Number.isFinite(Date.parse(job.postingDate))&&Date.parse(job.postingDate)<=Date.parse(clock),'Missing/invalid/future native publication;observation is not publication')
   return{...job,jobDescription:detail.html,scrapedAt:clock,closingDate:detail.raw.application_deadline??null,nativeApplicationURL:null,applicationVisited:false,applicationLinkSource:'public-role-page-fallback',
    sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    nativeFacts:{nativeGreenhouseListing:raw,nativeGreenhouseDetail:detail.raw,nativeDescriptionEncoded:detail.raw.content,nativeDescriptionTransformation:detail.encoding,nativeIndiaLocation:detail.raw.location.name,
     nativePublisherCompanyName:detail.raw.company_name,nativePublication:job.nativePublication,firstEverPublication:null,legalEmployer:null,nativeApplicationURL:null,applicationVisited:false,nativeATSBinding:binding}}
  })
  result.jobs=jobs.map(job=>({id:String(job.jobId),nativeGreenhouseListing:job.nativeFacts.nativeGreenhouseListing,nativeGreenhouseDetail:job.nativeFacts.nativeGreenhouseDetail}))
  stage='closing-inventory'
  try{const closing=readListing(JSON.parse(await read(LIST)));ensure(closing.fingerprint===listing.fingerprint,'Native inventory changed during detail read');result.closingInventoryMatches=true}
  catch(error){result.failures.push({stage,message:String(error.message).slice(0,400)})}
 }catch(error){result.failures.push({stage,code:error?.code??null,message:String(error?.message??error).slice(0,400)});result.status='partial';throw Object.assign(Error(COMPANY+' native extraction incomplete;cleanup forbidden'),{name:'NativeDominoIncompleteError',code:'NATIVE_DOMINO_INCOMPLETE',nativeEvidence:result})}
 options.signal?.throwIfAborted()
 result.extractedDetailJobs=result.jobs.length;result.excludedDetailJobs=0;result.nativeHTTPReads=physicalReads;result.decodedResponseBytes=totalBytes;result.status=result.failures.length?'partial':'native-public-board-and-selected-details-read'
 result.sharedAdapter={template:'greenhouse',engine:'existing apiPortal engine',innerListingComplete:innerEvidence?.listingComplete??null,innerReportedTotal:innerEvidence?.reportedTotal??null}
 const output=jobs.map(job=>({...job,nativeCollectionEvidence:result}))
 Object.defineProperty(output,Symbol.for('jobverify.native-html-evidence'),{value:result})
 return attachInventoryEvidence(output,{status:'coverage-gap',surface:LIST,firstParty:result.handoffVerified,listingComplete:false,pagesFetched:result.pagesFetched,reportedTotal:result.nativeReportedTotal,indiaFacetCount:result.observedIndiaListingCount,verifiedAt:null,
  reason:`Official careers/native portal configuration bind Greenhouse;${result.observedListingCount}native public rows;${result.observedIndiaListingCount}explicitIndia details;${result.nonIndiaListingCount}outside writtenIndia listing scope;original first_published preserved;whole-employer scope unknown;cleanup forbidden;state=${result.status}`})
}
