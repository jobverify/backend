import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

// Complete, separately retained public bytes observed 2026-11-28. These pins
// qualify a finite data transport; browser rendering and application remain held.
const FRAME_SHA256='524814ce94c2353093b9db6efe4bf65f0a48a453ff899d232b6555bf37c16b23'
const ASSETS=[
 ['runtime.8bf0f2b06e3056e2.js','adafdaa2759ae44acb0f81d3c11c3a3a2f8c8ae2822b22b8e38d95225f4c1e4a'],
 ['polyfills.927b0fcde0e25955.js','5788fd29f96398f8947856c1dc775a4727b9e84c6dfdca8f22ea10ec2f1551e9'],
 ['main.08545c354c03458b.js','7d130b2e3cc921386fc69f1727c7611ba6942d9a8cc70d592d21ab6ba9eee066'],
 ['styles.62219372d46a0e79.css','e13cab85a52a51b9eee9718824fa3c86936c4ac378a934847218572e879b1090'],
]
const sha=value=>createHash('sha256').update(value).digest('hex')
const clone=value=>structuredClone(value)
const detailKeys=new Set(['id','title','location','job_type','department','description','skills','experience','max_experience','similar_jobs','job_board_urls','job_publish_date','other_job_settings','consents','entity','is_vendor_job','job_state_ids','apply_url'])
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype
const knownKeys=(value,keys)=>plain(value)&&Object.keys(value).every(key=>keys.includes(key))
const optional=(value,key,qualifies)=>!Object.hasOwn(value,key)||qualifies(value[key])
const finite=value=>typeof value==='number'&&Number.isFinite(value)
const strings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string')
// Genuine current Elasticsearch metadata and the separately reviewed minimal
// legacy response are finite alternatives. New fields can carry eligibility,
// geography or employer constraints; retain them raw and withhold those rows.
const qualifiedListingEnvelope=value=>knownKeys(value,['status','errors','results'])
 &&optional(value,'errors',item=>typeof item==='string')
 &&knownKeys(value.results,['total','max_score','hits','departments'])
 &&optional(value.results,'max_score',item=>item===null||finite(item))
 &&knownKeys(value.results.total,['value','relation'])
 &&optional(value.results.total,'relation',item=>item==='eq')
const qualifiedListingRecord=value=>knownKeys(value,['_index','_id','_score','_ignored','_source','sort'])
 &&['_index','_id'].every(key=>optional(value,key,item=>typeof item==='string'))
 &&optional(value,'_score',item=>item===null||finite(item))
 &&optional(value,'_ignored',strings)
 &&optional(value,'sort',item=>Array.isArray(item)&&item.every(finite))
 &&knownKeys(value._source,['client','job','title','location','industry','department','entity','job_type'])
 &&['location','industry','department','job_type'].every(key=>optional(value._source,key,item=>typeof item==='string'))
const listingLocationsAgree=(item,detail)=>{
 if(!Object.hasOwn(item,'location'))return true
 const listed=item.location.split(',').map(value=>value.trim())
 const detailed=detail.location.map(value=>value.city.split('-')[0].trim())
 return listed.every(Boolean)&&new Set(listed).size===listed.length
  &&isDeepStrictEqual([...listed].sort(),[...new Set(detailed)].sort())
}
const calendarDate=value=>{
 if(value==null||value==='')return true
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return false
 const [hour,minute,second]=value.slice(11,19).split(':').map(Number)
 if(hour>23||minute>59||second>59)return false
 const [year,month,day]=value.slice(0,10).split('-').map(Number),date=new Date(Date.UTC(year,month-1,day))
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day
}

export function guardedReader(reader,signal){
 return (url)=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return}
  let settled=false
  const finish=(error,value)=>{
   if(settled)return
   settled=true;signal?.removeEventListener('abort',abort)
   if(signal?.aborted)reject(signal.reason)
   else if(error)reject(value)
   else resolve(value)
  }
  const abort=()=>finish(true,signal.reason)
  signal?.addEventListener('abort',abort,{once:true})
  try{
   signal?.throwIfAborted()
   // Observe late settlement even if an injected reader ignores cancellation.
   Promise.resolve(reader(url,{signal})).then(value=>finish(false,value),error=>finish(true,error))
  }catch(error){finish(true,error)}
 })
}

export async function verifyCurrentPublisher(boardHtml,readText){
 const declared=boardHtml.includes('main.08545c354c03458b.js')
 if(!declared)return false
 if(sha(boardHtml)!==FRAME_SHA256)throw Error('Credgenics native publisher shell no longer matches the finite profile')
 for(const [name,digest] of ASSETS){
  const body=await readText(`https://recruitcareers.zappyhire.com/en/${name}`)
  if(typeof body!=='string'||sha(body)!==digest)throw Error(`Credgenics native publisher asset changed: ${name}`)
 }
 return true
}

export function nativeQualificationReason(detail){
 if(!plain(detail)||Object.keys(detail).some(key=>!detailKeys.has(key)))return 'native-schema-unqualified'
 if(Object.hasOwn(detail,'is_vendor_job')&&detail.is_vendor_job!==false)return 'native-employer-unqualified'
 if(!Array.isArray(detail.location)||!detail.location.length||detail.location.some(location=>!plain(location)||Object.keys(location).some(key=>!['city','country_code'].includes(key))||typeof location.city!=='string'||!location.city.trim()||typeof location.country_code!=='string'||location.country_code!=='IN'))return 'native-country-unqualified'
 if(typeof detail.description!=='string'||!detail.description.trim()||!calendarDate(detail.job_publish_date)
  ||detail.other_job_settings!=null&&(!plain(detail.other_job_settings)||Object.keys(detail.other_job_settings).length)
  ||detail.apply_url!=null)return 'native-criteria-unqualified'
 return null
}

export function attachHeldNativeEvidence(jobs,{opening=null,closing=null,surface,verifiedAt,pagesFetched=0}={}){
 const observed=opening?.records.length??0
 const observation={source:'credgenics',recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:observed,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 const audit={...observation,companyInventoryComplete:false,configuredBoardComplete:false,nativeInventoryPaired:Boolean(opening&&closing),lifecycleCleanupAllowed:false,
  sourceListingComplete:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,sourceAvailabilityVerified:false,
  opening:opening?clone(opening):null,closing:closing?clone(closing):null}
 attachSourceObservationEvidence(jobs,observation)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 Object.defineProperty(jobs,'nativeInventoryEvidence',{value:audit,configurable:true})
 return attachInventoryEvidence(jobs,{status:jobs.length?'discovery-only':'coverage-gap',surface,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt,
  reason:'Native observations only; role country, rendering, application and company-wide scope are not inferred from organization configuration or a configured-board zero'})
}

export async function collectNativeSnapshots({readText,readJSON,homepageHtml,homepageURL,boardURL,apiBase,pageSize,scrapedAt,verifyHomepage,verifyBoard,extractJob,buildJobsURL,buildDetailURL}){
 let pagesFetched=0
 const snapshot=async(home)=>{
  if(!verifyHomepage(home))throw Error('Credgenics closing homepage identity changed')
  const board=await readText(boardURL)
  if(!verifyBoard(board))throw Error('Credgenics Zappyhire board no longer matches the official careers shell')
  const qualifiedPublisher=await verifyCurrentPublisher(board,readText)
  const configuration=await readJSON(`${apiBase}careers/configurations/`)
  const filters=await readJSON(`${apiBase}careers/filter-params/`)
  const heading=configuration?.results?.career_text_heading
  if(configuration?.status!==1||!/^credgenics$/i.test(String(configuration.results?.name??''))
   ||configuration.results.website!==homepageURL||configuration.results.other_organization_settings?.country!=='in'
   ||!(/^credgenics careers$/i.test(String(heading??''))||qualifiedPublisher&&heading==='Build your next chapter with us.')
   ||filters?.status!==1||!Array.isArray(filters.results?.locations)||filters.results.locations.some(city=>typeof city!=='string'||!city.trim()))throw Error('Credgenics Zappyhire configuration no longer matches the verified organization and heading')
  const cities=new Set(filters.results.locations.map(value=>value.trim())),listingPages=[],records=[],qualifiedRecords=new WeakSet()
  let total=null
  for(let page=1;total===null||records.length<total;page++){
   if(page>100)throw Error('Credgenics Zappyhire jobs exceeded the pagination limit')
   const payload=await readJSON(buildJobsURL(page,pageSize)),count=payload?.results?.total?.value,hits=payload?.results?.hits
   pagesFetched++
   if(payload?.status!==1||!Number.isSafeInteger(count)||count<0||count>10000||!Array.isArray(hits)||hits.length>pageSize||(total!==null&&total!==count)||(count>0&&!hits.length))throw Error('Credgenics Zappyhire jobs pagination no longer matches the public API')
   if(Object.hasOwn(payload.results,'departments')){
    const departments=payload.results.departments
    if(!Array.isArray(departments)||departments.some(value=>typeof value!=='string'||!value.trim())||new Set(departments).size!==departments.length)throw Error('Credgenics native department metadata is malformed or duplicated')
   }
   if(qualifiedListingEnvelope(payload))for(const record of hits)if(qualifiedListingRecord(record))qualifiedRecords.add(record)
   total=count;listingPages.push(clone(payload));records.push(...hits)
  }
  if(records.length!==total||new Set(records.map(record=>record?._source?.job)).size!==total)throw Error('Credgenics Zappyhire jobs pagination returned duplicate or missing roles')
  const rows=[]
  for(const record of records){
   const item=record?._source,id=item?.job
   if(!plain(item)||item.client!=='credgenics'||!/^credgenics$/i.test(String(item.entity??''))||!Number.isSafeInteger(id)||id<=0||typeof item.title!=='string'||!item.title.trim())throw Error('Credgenics native listing identity no longer matches the verified employer')
   const detailResponse=await readJSON(buildDetailURL(id)),detail=detailResponse?.results
   if(detailResponse?.status!==1||!plain(detail)||detail.id!==id||String(detail.title??'').replace(/\s+/g,' ').trim()!==item.title.replace(/\s+/g,' ').trim()||detail.entity!=null&&detail.entity!==1)throw Error('Credgenics native detail identity no longer matches the verified listing')
   const reason=nativeQualificationReason(detail)
    ||(!qualifiedRecords.has(record)?'native-schema-unqualified':null)
    ||(!listingLocationsAgree(item,detail)?'native-country-unqualified':null)
   // Identity/application guards apply to every row, including country-held rows.
   const job=extractJob(record,detail,cities,scrapedAt,{countryHeld:Boolean(reason)})
   rows.push({record:clone(record),detail:clone(detail),detailResponse:clone(detailResponse),reason,job:reason?null:job})
  }
  return {homepage:home,board,qualifiedPublisher,configuration:clone(configuration),filters:clone(filters),listingPages,records:rows}
 }
 const opening=await snapshot(homepageHtml),closing=await snapshot(await readText(homepageURL))
 const comparable=value=>{
  const result=clone(value)
  // The genuine unfiltered response reorders this department index only.
  // Preserve both raw arrays above; every member and every other field/order
  // still participates in the paired comparison, including all held records.
  for(const page of result.listingPages)if(Object.hasOwn(page.results,'departments'))page.results.departments.sort()
  return result
 }
 if(!isDeepStrictEqual(comparable(opening),comparable(closing)))throw Error('Credgenics closing native inventory or full criteria snapshot changed')
 const jobs=opening.records.filter(row=>!row.reason).map(row=>row.job)
 return attachHeldNativeEvidence(jobs,{opening,closing,surface:boardURL,verifiedAt:scrapedAt,pagesFetched})
}
