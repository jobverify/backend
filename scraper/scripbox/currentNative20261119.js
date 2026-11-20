import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,retained,nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {hydrateSourceDescriptions} from '../../scraper-support/utils/sourceDescriptionHydration.js'
import {createDarwinboxScraper} from '../darwinbox/script.js'

export const CAREERS='https://scripbox.com/pages/careers'
export const CLIENT='https://d112mhujhbz2ri.cloudfront.net/_next/static/chunks/pages/pages/careers-b7b4dce36f445daf.js'
const CLIENT_SHA='35efc413a3dafb10fdbd0d6b37ac0391527d14792787d459fb83f6b2c43374e5'
const SOURCE='scripbox',sha=value=>createHash('sha256').update(value).digest('hex')
const failure=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw failure(message)}
const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const label=node=>clean(decodeHTML(nativeText(node)))
const one=(rows,name)=>{need(rows.length===1,'Missing or ambiguous '+name);return rows[0]}
const detailURL=id=>'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/'+encodeURIComponent(id)+'?from=all'
const nativeKeys=['job_id','job_code','group_company','parent_department','department','division','business_unit','location','location_city','location_country','job_title','post_on_careers_page','post_on_refer_page','post_on_ijp_page','employee_type','job_created_timestamp','job_updated_timestamp','experience_to','experience_from','is_remote','designation_code']
export const hasCurrentScripboxClient=html=>String(html).includes(CLIENT)
export function readCurrentScripboxPage(html,client){
 need(typeof client==='string'&&Buffer.byteLength(client)===77667&&sha(client)===CLIENT_SHA,'Complete native paginated renderer requires review')
 const page=qualifiedFirstPartyHTML(html,CAREERS,failure)
 need(page.title==='Careers | Scripbox','Own careers publisher changed')
 one(page.raw.nodes(node=>node.tag==='script'&&node.attrs.src===CLIENT),'declared owned careers renderer')
 const node=one(page.raw.nodes(node=>node.tag==='script'&&node.attrs.id==='__NEXT_DATA__'&&node.attrs.type==='application/json'),'owned literal Next data')
 const data=readLiteralModel(node.raw).value,records=data?.props?.pageProps?.jobOpenings
 need(Array.isArray(records)&&records.length>0&&records.length<=1000,'Native positive careers records absent or unbounded; no company zero proof')
 const ids=new Set()
 for(const row of records){
  need(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===nativeKeys.length&&nativeKeys.every(name=>Object.hasOwn(row,name)),'Native complete record schema changed')
  need(/^a[a-f0-9]{13}$/.test(row.job_id)&&typeof row.job_title==='string'&&clean(row.job_title)&&!ids.has(row.job_id),'Native job identity missing or duplicate');ids.add(row.job_id)
  need(['job_code','group_company','parent_department','department','business_unit','location_country','employee_type','job_created_timestamp','job_updated_timestamp','experience_to','experience_from','designation_code'].every(name=>typeof row[name]==='string')
   &&(row.division===null||typeof row.division==='string')&&['post_on_careers_page','post_on_refer_page','post_on_ijp_page','is_remote'].every(name=>[0,1].includes(row[name]))
   &&[row.location,row.location_city].every(values=>Array.isArray(values)&&values.length>0&&values.every(value=>typeof value==='string'&&clean(value))),'Native typed careers record changed')
 }
 const section=one(page.visible.nodes(node=>node.tag==='section'&&node.attrs.id==='roles'&&node.attrs['aria-labelledby']==='careers-roles-title'),'active paginated roles section')
 need(label(one(retained(section,node=>node.attrs.id==='careers-roles-title'),'roles title'))==='Open roles that you would fit in','Native active roles heading changed')
 need(label(one(retained(section,node=>cls(node,'jobcount')),'native role total'))===records.length+' of '+records.length+' roles','Native total contradicts original data')
 const anchors=retained(section,node=>node.tag==='a'&&cls(node,'jobrow'))
 need(anchors.length===Math.min(records.length,10),'Native first page does not match reviewed ten-item pagination')
 for(const [index,anchor] of anchors.entries()){
  need(anchor.attrs.href===detailURL(records[index].job_id)&&label(one(retained(anchor,node=>node.tag==='h3'&&cls(node,'jt')),'rendered own job title'))===clean(records[index].job_title),'Native first-page title or own detail link disagrees with source data')
 }
 return {records,initialRenderedRoleCount:anchors.length,originalHTML:html,clientSHA256:CLIENT_SHA}
}

export async function runCurrentScripbox(options={}){
 options.signal?.throwIfAborted()
 const timeout=options.sourceTimeoutMs??180000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'Invalid current source deadline')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid native job cap')
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)
 const audit={source:SOURCE,companyScopeComplete:false,lifecycleCleanupAllowed:false,receipts:[],detailFailures:[],nativeDetails:[],backendSubmissionVerified:false,applicationSubmitted:false}
 let totalBytes=0,denied=null
 const read=async(url,type)=>{
  signal.throwIfAborted();need([CAREERS,CLIENT].includes(url)&&audit.receipts.length<4,'Unbound native URL or request budget')
  const page=await boundedDeclaredPublicGet(url,{signal,timeoutMs:15000,overflowError:failure('Current entity exceeds streaming limit'),fetchImpl:(requested,init)=>(options.fetchImpl||globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})})
  const bytes=Buffer.from(page.bodyBase64,'base64');totalBytes+=bytes.length
  audit.receipts.push({requestedUrl:url,url:page.url,status:page.status,bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64})
  need(page.status===200&&page.url===url&&totalBytes<=4*1024*1024,'Native original HTTP, final URL or source byte ceiling changed')
  need((type==='javascript'?/^(?:text|application)\/(?:java|ecma)script(?:;|$)/i:/^text\/html(?:;|$)/i).test(page.headers['content-type']||''),'Native current source MIME changed')
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 }
 const collect=async()=>{const html=await read(CAREERS,'html'),client=await read(CLIENT,'javascript');return readCurrentScripboxPage(html,client)}
 try{
  const opening=await collect();Object.assign(audit,{nativeInventoryCount:opening.records.length,initialRenderedRoleCount:opening.initialRenderedRoleCount,nativeOpeningRecords:structuredClone(opening.records),originalOpeningHTML:opening.originalHTML})
  const native=createDarwinboxScraper({source:SOURCE,companyName:'Scripbox',origin:'https://scripbox.darwinbox.in'})
  const jobs=opening.records.filter(row=>row.post_on_careers_page===1&&row.location_country==='India'&&row.location.every(value=>/,\s*India\s*\([A-Z0-9_]+\)$/.test(value))).map(row=>({source:SOURCE,company:'Scripbox',legalEmployer:null,
   title:clean(row.job_title),jobId:row.job_id,requisitionId:null,sourceNativeJobRecord:structuredClone(row),department:row.department,
   location:row.location.join(' / '),city:row.location_city.length===1?row.location_city[0]:null,country:'India',sourceUrl:detailURL(row.job_id),applyUrl:detailURL(row.job_id),link:detailURL(row.job_id),
   experienceRequired:/^\d+$/.test(row.experience_from)&&/^\d+$/.test(row.experience_to)?row.experience_from+'-'+row.experience_to+' years':null,
   employmentType:row.employee_type,postingDate:null,closingDate:null,sourceListingComplete:false,sourceScopeComplete:false,sourceDetailComplete:false,lifecycleCleanupAllowed:false,
   sourceApplicationHandoff:'Complete first-party renderer declares own Darwinbox detail link and ten-item pagination',applicationVisited:false,applicationSubmitted:false,
   companyDomain:'scripbox.com',companyCareerPage:CAREERS,atsPlatform:'official-company-careers-embedded-next-data-darwinbox-handoff',scrapedAt:new Date(typeof options.now==='function'?options.now():Date.now()).toISOString()}))
  const detailFacts=new Map(),hydrated=await hydrateSourceDescriptions(jobs,{signal,detailEnrichmentBudgetMs:options.detailEnrichmentBudgetMs,fetchDetail:async(job,{signal:detailSignal})=>{
   try{
    if(denied)throw denied
    const payload=await(options.fetchJobDetail||native.fetchJobDetailFromApi)({jobId:job.jobId,companyId:'main',signal:detailSignal})
    detailSignal.throwIfAborted();native.validateJobDetail(payload,job)
    const record=payload.message.job[0],criteria=readOriginalNativeCriteria(record.jd,failure)
    need(criteria.sourceDetailComplete,'Full own native criteria unavailable')
    need(!/\b(?:this (?:position|role|job) is (?:closed|filled)|no longer accepting applications|applications (?:are )?closed)\b/i.test(criteria.sourceDescription),'Native detail explicitly closed')
    for(const line of criteria.sourceDescriptionLines){
     for(const match of line.matchAll(/\b(?:work(?:place)?\s+country|job\s+country|country)\s*:\s*([^.;]+)/gi))need(/^(?:India|IN)$/i.test(match[1].trim()),'Native criteria country contradicts the listed workplace')
     for(const match of line.matchAll(/\b(?:employer|hiring\s+(?:company|organization))\s*:\s*([^;]+)/gi))need(['scripbox','swmpl'].includes(match[1].toLowerCase().replace(/[^a-z0-9]/g,'')),'Native criteria employer contradicts its first-party publisher')
    }
    audit.nativeDetails.push({jobId:job.jobId,originalPayload:structuredClone(payload)})
    detailFacts.set(job.jobId,{...native.extractJobDetailFacts(payload,job),sourceDescriptionHTML:record.jd,sourceNativeDetailRecord:structuredClone(record)})
    return {sourceDescription:criteria.sourceDescription}
   }catch(error){detailSignal.throwIfAborted();if([401,403,429,451].includes(error.status))denied=error;audit.detailFailures.push({jobId:job.jobId,status:error.status??null,message:error.message});throw error}
  }})
  const closing=await collect();audit.nativeClosingRecords=structuredClone(closing.records);audit.originalClosingHTML=closing.originalHTML
  need(JSON.stringify(opening.records)===JSON.stringify(closing.records),'Closing complete native careers records changed')
  audit.closingReconciled=true;audit.completeNativeCriteria=hydrated.filter(job=>job.sourceDetailComplete).length
  audit.heldNativeRecords=opening.records.filter(row=>!hydrated.some(job=>job.jobId===row.job_id&&job.sourceDetailComplete))
  // The current first-party source independently publishes these vacancies.
  // Preserve valid partial rows under the shared policy, with missing criteria
  // explicit and company cleanup held. Do not turn pipeline success into a
  // claim that the blocked detail service supplied complete role criteria.
  audit.nativeDetailObservations=hydrated.map(job=>({...job,...detailFacts.get(job.jobId)}))
  audit.fullCriteriaRecovered=audit.nativeDetailObservations.every(job=>job.sourceDetailComplete===true&&typeof job.sourceDescription==='string')
  const selected=options.maxJobs==null?audit.nativeDetailObservations:audit.nativeDetailObservations.slice(0,options.maxJobs)
  attachSourceObservationEvidence(selected,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(selected,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(selected,{status:audit.completeNativeCriteria?'discovery-only':'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.receipts.length,reportedTotal:opening.records.length,indiaFacetCount:jobs.length,verifiedAt:new Date().toISOString(),reason:'Current native pagination and full records reconciled; missing own detail criteria remain held; no company cleanup authority'})
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object')error.sourceAudit=audit;throw error}
}
