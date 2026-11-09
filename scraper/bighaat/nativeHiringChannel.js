import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const CAREERS='https://corporate.bighaat.com/careers/'
const CHANNEL='https://www.linkedin.com/company/bighaat-india/jobs/'
const CURRENT_TITLE="Careers at BigHaat | Join India's Leading Agritech Team"
const HEADERS={'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
const check=signal=>{if(signal?.aborted)throw signal.reason}
const refusal=message=>Object.assign(new Error(message),{abortRetries:true,sourceScopeComplete:false,inventoryCleanupAllowed:false})
const cancel=body=>{try{Promise.resolve(body?.cancel?.()).catch(()=>{})}catch{}}
const isChannelCandidate=(node,doc)=>node.tag==='a'&&(doc.text(node)==='Openings on LinkedIn'||/linkedin\.com\/company\/[^/?#]+\/jobs(?:[/?#]|$)/i.test(node.attrs.href??''))

const discover=(html,{hasHistoricalProfile,hasPublicListings})=>{
 if(typeof html!=='string')throw refusal('BigHaat official careers surface changed')
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],rows=[]
 const walk=(node,parents=[])=>{rows.push({node,parents});for(const child of node.children??[])if(typeof child!=='string')walk(child,[...parents,node])};walk(root)
 const canonicals=rows.filter(({node})=>node.tag==='link'&&String(node.attrs.rel??'').toLowerCase()==='canonical')
 if(canonicals.length!==1||canonicals[0].node.inert||canonicals[0].node.nativeTagUnqualified||canonicals[0].node.attrs.href!==CAREERS||rows.some(({node})=>node.tag==='base'&&node.attrs.href))throw refusal('BigHaat canonical authority changed')
 if(hasPublicListings(html)||rows.some(({node})=>String(node.attrs.itemtype??'').split(/\s+/).some(x=>/\/JobPosting$/.test(x)))||/['"]@type['"]\s*:\s*['"]JobPosting['"]/i.test(html))throw refusal('BigHaat careers page now exposes public job listings and needs a structured scraper')
 const active=doc.nodes(n=>n.tag==='a'),candidates=rows.filter(({node})=>isChannelCandidate(node,doc)),titles=activeHead(html).titles
 if(candidates.length||titles.includes(CURRENT_TITLE)){
  if(candidates.length!==1||!active.includes(candidates[0].node)||candidates[0].node.nativeTagUnqualified||candidates[0].node.attrs.href!==CHANNEL||doc.text(candidates[0].node)!=='Openings on LinkedIn'||titles.length!==1||!(titles[0]===CURRENT_TITLE||hasHistoricalProfile(html)))throw refusal('BigHaat active hiring channel profile changed')
  if([...candidates[0].parents,candidates[0].node].some(n=>Object.keys(n.attrs??{}).some(k=>/^on/i.test(k))))throw refusal('BigHaat hiring navigation program changed')
  return {kind:'declared-channel',url:CHANNEL}
 }
 if(!hasHistoricalProfile(html))throw refusal('BigHaat official careers surface changed; refusing to assume no public listings')
 // An unreviewed embedded or alternate advertised careers/jobs channel cannot
 // inherit the old corporate-only discovery result.
 if(rows.some(({node})=>node.tag==='iframe'&&node.attrs.src)||active.some(n=>/\/(?:jobs|careers)(?:[/?#]|$)/i.test(n.attrs.href??'')&&n.attrs.href!==CAREERS))throw refusal('BigHaat additional hiring channel changed')
 return {kind:'legacy-discovery'}
}

const defaultReader=({signal})=>async(url)=>{
 let observed=null,responseForCleanup=null
 try{
  const value=await fetchTextWithRetry(url,{
   headers:HEADERS,label:'bighaat',timeoutMs:15000,signal,includeResponseMetadata:true,
   ...(url===CHANNEL?{redirect:'manual',credentials:'omit'}:{}),
   fetchImpl:async(...args)=>{
    // Metadata belongs to this attempt only; an earlier5xx must not label a
    // later transport/caller/harness error as an observed HTTP response.
    observed=null;responseForCleanup=null;check(signal)
    const response=await fetch(...args);check(signal)
    if(response.url!==url){cancel(response.body);throw Object.assign(refusal('BigHaat response authority changed'),{failureKind:'parser_or_contract_error'})}
    observed={status:response.status,requestURL:url,finalURL:response.url,contentType:response.headers.get('content-type')};responseForCleanup=response
    return response
   },
  })
  check(signal);return value.html
 }catch(error){
  check(signal)
  if(observed&&Number.isInteger(observed.status)&&(observed.status<200||observed.status>=300)){
   cancel(responseForCleanup?.body)
   const failure=Object.assign(new Error(`HTTP ${observed.status} for ${url}`,{cause:error}),observed,{statusCode:observed.status,abortRetries:true,sourceScopeComplete:false,inventoryCleanupAllowed:false})
   Object.assign(failure,classifyScraperError(failure));throw failure
  }
  throw error
 }
}

export const runHiringChannel=async({fetchText,signal,hasHistoricalProfile,hasPublicListings})=>{
 check(signal)
 const read=typeof fetchText==='function'?async(url)=>{check(signal);try{const html=await fetchText(url);check(signal);return html}catch(error){check(signal);throw error}}:defaultReader({signal})
 const html=await read(CAREERS);check(signal)
 const profile=discover(html,{hasHistoricalProfile,hasPublicListings})
 if(profile.kind==='declared-channel'){
  await read(profile.url);check(signal)
  throw refusal('BigHaat declared recruitment channel needs a structured scraper; no native role contract reviewed')
 }
 const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'legacy-corporate-discovery-only-no-enumerated-vacancy-inventory'})
 Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:'bighaat',sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,inventoryCleanupAllowed:false,cleanupAllowed:false,vacancyInventoryObserved:false,profile:'legacy-corporate-discovery-only'}})
 check(signal);return jobs
}
