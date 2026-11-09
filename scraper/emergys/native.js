import {createFirstPartyHTMLScraper,createHTMLTransport} from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import {BOARD,ensure,validateURL,parseListing,parseDetail,pageFingerprint} from './parser.js'
function projectJobs(result,clock){
 const facts=[...result.jobs,...result.exclusions]
 result.nativeDetailCountryCounts={observedIndiaRows:result.jobs.length,excludedNonIndiaRows:result.exclusions.filter(r=>r.country).length,unresolvedCountryRows:result.exclusions.filter(r=>!r.country).length,reconciled:facts.length===result.observedListingCount&&result.failures.length===0}
 const {jobs,exclusions,retainedResponses,listingRecords,unknownRawFailures,...summary}=result
 const compact={...summary,extractedDetailJobs:jobs.length,excludedDetailJobs:exclusions.length,retainedResponseCount:retainedResponses.length,retainedResponsesOnFirstExtractedJob:true,fullBatchEvidenceOnFirstExtractedJob:true}
 return jobs.map((fact,index)=>({source:'emergys',company:'Emergys',jobId:fact.id,id:fact.id,title:fact.title,location:fact.location,country:fact.country,
  postingDate:fact.nativePublication.raw,scrapedAt:clock,jobDescription:fact.descriptionHTML,sourceDescription:fact.descriptionHTML,
  sourceUrl:fact.sourceURL,jobUrl:fact.sourceURL,link:fact.sourceURL,applyUrl:fact.sourceURL,nativeApplicationURL:null,applicationVisited:false,applicationLinkSource:'public-role-page-fallback',closingDate:null,
  nativePublication:fact.nativePublication,nativeFacts:fact,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  nativeCollectionEvidence:index===0?result:compact}))
}
export async function runNative(options={}){
 ensure(options.maxJobs==null,'Partial maxJobs unsupported')
 const clock=new Date((options.now??(()=>new Date().toISOString()))()).toISOString(),stop=new AbortController(),signal=AbortSignal.any([...(options.signal?[options.signal]:[]),stop.signal,AbortSignal.timeout(180000)])
 const allowed=new Set([BOARD]),config={source:'emergys',companyName:'Emergys',boardURL:BOARD,handoffs:[],maxRequests:192,maxAggregateBytes:32*1024*1024,detailConcurrency:1,
  validateURL(url){validateURL(url);ensure(allowed.has(url),'Role not advertised by current public listing')},sameReadIdentity:(a,b)=>a===b,
  parseListing(html,url){const page=parseListing(html,url);for(const row of page.records)allowed.add(row.url);if(page.nextURL)allowed.add(page.nextURL);return page},pageFingerprint,candidateForIndia:()=>true,
  parseDetail:(html,row)=>parseDetail(html,row,clock),projectJobs:result=>projectJobs(result,clock)}
 const transport=options.transport??createHTMLTransport(config,{signal,fetchImpl:options.fetchImpl??globalThis.fetch})
 const bounded=async(url,request)=>{signal.throwIfAborted();const packet=await transport(url,request);if([401,403,429].includes(packet.status))stop.abort(Error('Native public access/rate limit;no more HTTP reads'));return packet}
 const jobs=await createFirstPartyHTMLScraper(config).run({...options,signal,transport:bounded});options.signal?.throwIfAborted();return jobs
}
