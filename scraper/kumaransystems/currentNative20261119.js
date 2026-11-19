import {createHash} from 'node:crypto'
import {isDeepStrictEqual as equal} from 'node:util'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {createZohoNativeInventoryScraper} from '../../scraper-support/utils/zohoNativeInventory.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='kumaransystems',OFFICIAL='https://kumaran.com/careers/',ROOT='https://careers.kumaran.com'
const BOARD=ROOT+'/jobs/Careers',API=ROOT+'/recruit/v2/public/Job_Openings',LIST=API+'?source=CareerSite&pagename=Careers'
const COMPONENT='https://kumaran.com/_astro/Careers.j26F8CzW.js'
const EMBED='https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js'
const hashes={
 [OFFICIAL]:'72635f2d8d4e16ed628eb1ca9147979a3d004348bd9edb8b65468ec2702e10af',
 [COMPONENT]:'cb2af185ceb139efa158d3a07dca9c7ac52eb1b9c4ce7a45cddd62af33f8d789',
 [EMBED]:'854825e083f61b7d9e413473a57be237bc6d54b615b4317ac9f754e596696c5f',
}
const config={source:SOURCE,company:'Kumaran Systems',companyDomain:'kumaran.com',boardUrl:BOARD,
 orgId:'31840000000127009',pageId:'31840000000127273',nativeCompany:'Kumaran Systems'}
const sha=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const detailURL=id=>API+'/'+id+'?source=CareerSite&pagename=Careers'
const fail=message=>Object.assign(Error('Kumaran current native: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw fail(message)}
const fields=new Set(['Remote_Job','Posting_Title','Role_Type','Is_Locked','City','$appy_url','Required_Skills','Industry','Job_Description',
 'Work_Experience','Job_Type','Job_Opening_Name','Skills','State','Currency','Country','Zip_Code','id','Department_Name','Publish','Date_Opened','Keep_on_Career_Site'])
function completeCriteria(record){
 if(Object.keys(record).some(key=>!fields.has(key)))return false
 if(typeof record.Job_Description!=='string')return false
 const raw=readNativeDocument(record.Job_Description),visible=readVisibleNativeDocument(record.Job_Description,{strict:true})
 const root=raw.nodes(node=>node.tag==='root')[0],shown=visible.nodes(node=>node.tag==='root')[0]
 const allText=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(allText).join(' ')
 const content=shown&&norm(visible.text(shown))
 const preview=/\bpreview\s+only\b|\b(?:complete|full|detailed)\s+(?:job\s+)?(?:description|requirements?|qualifications?|criteria)\b[^.!?]{0,100}\b(?:on|upon)\s+request\b/i
 return content&&content.length>=100&&!preview.test(content)&&norm(allText(root))===content
}
export async function runCurrentKumaran(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'metadata-aware native fetchImpl required; body-only clients unqualified')
 need(options.maxJobs==null&&options.maxPages==null,'native inventory caps unsupported')
 const owner=new AbortController(),signal=options.signal?AbortSignal.any([owner.signal,options.signal]):owner.signal
 const io=createBoundedPublicCareerTransport({...options,signal,source:SOURCE,allowedURL:(url,method)=>method==='GET'&&(
  [OFFICIAL,COMPONENT,EMBED,BOARD,LIST].includes(url)||new RegExp('^'+API.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/[0-9]{8,30}\\?source=CareerSite&pagename=Careers$').test(url))})
 const originals=[],jsonReads=new Map(),heldRecords=[]
 const audit=()=>({source:SOURCE,originalResponses:originals,rawNativeOpeningInventory:jsonReads.get(LIST)?.[0]??null,
  rawNativeClosingInventory:jsonReads.get(LIST)?.[1]??null,heldRecords,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyGlobalTotal:null,companyIndiaTotal:null,browserEquivalenceComplete:false,applicationSubmitted:false})
 const read=async(url,kind='html')=>{
  io.signal.throwIfAborted()
  try{
   const value=await(kind==='json'?io.fetchJson(url):kind==='js'?io.fetchScript(url):io.fetchText(url))
   io.signal.throwIfAborted();originals.push({url,kind,original:structuredClone(value)})
   if(kind==='json'){const previous=jsonReads.get(url)??[];previous.push(structuredClone(value));jsonReads.set(url,previous)}
   return value
  }catch(error){owner.abort(error);throw error}
 }
 const publisher=async()=>{
  const html=await read(OFFICIAL),doc=readNativeDocument(html)
  need(sha(html)===hashes[OFFICIAL]&&!doc.nodes(node=>node.tag==='base').length,'whole current first-party publisher tuple changed')
  const islands=doc.nodes(node=>node.tag==='astro-island'&&node.attrs['component-url']==='/_astro/Careers.j26F8CzW.js')
  need(islands.length===1&&islands[0].attrs.client==='visible'&&Object.hasOwn(islands[0].attrs,'ssr')
   &&islands[0].attrs['component-export']==='default'&&doc.nodes(node=>node.attrs.id==='rec_job_listing_div').length===1,
  'active current Careers component/widget identity changed')
  for(const url of [COMPONENT,EMBED])need(sha(await read(url,'js'))===hashes[url],'whole declared public widget program changed')
 }
 try{
  await publisher()
  // The own-domain board is admitted only after the exact actual publisher's
  // mounted Careers component and its complete Zoho loader have been reviewed.
  const acquired=await createZohoNativeInventoryScraper(config).run({signal:io.signal,detailConcurrency:2,
   now:typeof options.now==='function'?options.now:()=>options.now??new Date().toISOString(),
   fetchPage:async url=>({url,status:200,html:await read(url)}),fetchJson:url=>read(url,'json')})
  const listing=jsonReads.get(LIST)
  need(listing?.length===2&&equal(listing[0],listing[1]),'whole closing native listing model changed')
  const jobs=[]
  for(const job of acquired){
   const url=detailURL(job.jobId),opening=jsonReads.get(url)?.[0],closing=await read(url,'json')
   if(!equal(opening,closing)){heldRecords.push({jobId:job.jobId,reason:'whole-native-detail-closing-changed',opening,closing});continue}
   const native=opening?.data?.[0]
   if(!native||!completeCriteria(native)){heldRecords.push({jobId:job.jobId,reason:'unreviewed-native-fields-or-full-visible-criteria',opening,closing});continue}
   const originalListing=listing[0].data.find(record=>record.id===job.jobId)
   jobs.push({...job,jobDescription:native.Job_Description,sourceDescription:native.Job_Description,
    sourceNativeListingRecord:structuredClone(originalListing),sourceNativeDetailRecord:structuredClone(native),
    sourceNativeClosingDetailRecord:structuredClone(closing.data[0]),sourceDetailComplete:true,sourceClosingQualified:true,
    sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    applicationSubmitted:false,browserEquivalenceComplete:false})
  }
  await publisher();io.signal.throwIfAborted()
  const evidence=audit(),raw=listing[0].data
  Object.assign(evidence,{observedVacancyCount:raw.length,fullCriteriaClosingReconciled:true,companyInventoryComplete:false})
  // Keep the complete raw audit as an own data property. Observation markers
  // must not replace it with their smaller count-only projection.
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:raw.length,
   observedVacancyCount:raw.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,
   lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:originals.length,
   verifiedAt:new Date().toISOString(),reason:'current whole publisher/widget bound; typed native employer portal/API and full own role criteria reconciled; complete-company recruitment scope unqualified'})
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object')Object.defineProperty(error,'nativeCollectionEvidence',{configurable:true,value:audit()})
  throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
