import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {runNative,HOME} from './nativeCareers.js'
import {nativeUTCDate} from './nativeData.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='schaeffler',ORIGIN='https://jobs.schaeffler.com'
const LOCATIONS=new Map([
 ['Pune, IN, 412106',{city:'Pune',postalCode:'412106'}],
 ['Hosur, IN, 635109',{city:'Hosur',postalCode:'635109'}],
 ['Savli, IN, 391775',{city:'Savli',postalCode:'391775'}],
 ['Vadodara, IN, 390013',{city:'Vadodara',postalCode:'390013'}],
])
const FIELDS=new Set(['title','location','customfield3','description'])
const APPLY_CLASS='btn btn-primary btn-large btn-lg apply dialogApplyBtn'
const need=(condition,message)=>{if(!condition)throw firstPartyFailure(SOURCE,'Current qualification: '+message)}
const sha=value=>createHash('sha256').update(value).digest('hex')

export function qualifyCurrentSchaefflerRole(job,observedAt){
 need(job?.source==='schaeffler'&&job.company==='Schaeffler'&&job.sourceNativeRoleDetail?.bound
  &&job.sourceCurrentNativeRoleQualified,'native own role identity or closing membership is unqualified')
 const model=job.sourceNativeRole
 need(model?.roleLayout?.qualified&&Array.isArray(model.properties)
  &&model.properties.every(field=>FIELDS.has(field.id)),'native role layout or criteria carriers changed')
 const field=id=>{
  const rows=model.properties.filter(row=>row.id===id)
  need(rows.length===1&&rows[0].roleOwned&&rows[0].closed&&!rows[0].duplicateAttributes.length,'own '+id+' field is ambiguous')
  return rows[0]
 }
 need(field('title').value===job.title&&field('customfield3').value===job.requisitionId,'own title or native requisition disagrees')
 const locationField=field('location'),location=LOCATIONS.get(locationField.value)
 need(location&&/^Location:\s*$/.test(locationField.label),'whole native workplace tuple is unqualified')
 need(job.country==null||job.country==='India','native explicit country contradicts workplace tuple')
 const criteria=field('description')
 need(criteria.value===job.jobDescription&&criteria.originalInnerHTML===model.originalDescriptionHTML
  &&criteria.value.length>=1000&&/Responsibilities/i.test(criteria.value)&&/Qualifications/i.test(criteria.value),
 'full own responsibilities and qualifications are unavailable')
 for(const [name,value] of [['datePosted',job.postingDate],['validThrough',job.closingDate]]){
  const metas=model.microdataMetas.filter(meta=>meta.itemprop===name&&meta.roleOwned)
  need(metas.length===1&&!metas[0].duplicateAttributes.length&&value&&nativeUTCDate(metas[0].content)===value,
   'native '+name+' date is missing, duplicated or malformed')
 }
 const rendered=[job.title,criteria.value].join('\n').replace(/[*_`]/g,'')
 need(!/\b(?:(?:this\s+)?(?:position|role|job)\s+(?:(?:is|was|has\s+been)\s+)?(?:now\s+)?(?:closed|filled|no\s+longer\s+available)|no\s+longer\s+accepting\s+applications|applications\s+(?:(?:are|have\s+been)\s+)?closed)\b/i.test(rendered),
 'native role is explicitly closed')
 for(const match of rendered.matchAll(/\b(?:work(?:place)?\s+country|job\s+country|country)\s*:\s*([^.;\n]+)/gi))
  need(/^(?:India|IN)$/i.test(match[1].trim()),'criteria country contradicts workplace tuple')
 for(const match of rendered.matchAll(/\b(?:employer|hiring\s+(?:company|organization))\s*:\s*([^;\n]+)/gi))
  need(['schaeffler','schaefflerindialtd','schaefflerindialimited'].includes(match[1].toLowerCase().replace(/[^a-z0-9]/g,'')),
   'criteria employer contradicts native publisher')
 need(!job.closingDate||Date.parse(job.closingDate)>=Date.parse(observedAt),'native role deadline has passed')
 const applications=model.applications,calls=applications?.calls
 need(!applications?.errors.length&&calls?.length===1&&!calls[0].issues.length
  &&String(calls[0].fields.jobID)===job.jobId&&calls[0].fields.sourceId==='JATS-schaeffler',
 'native own application identity is unqualified')
 const path='/talentcommunity/apply/'+job.jobId+'/?locale=en_US',ctas=job.sourceNativeApplication?.originalApplyCTAs
 need(ctas?.length>0&&ctas.every(cta=>!cta.duplicateAttributes.length&&cta.attrs.href===path
  &&cta.attrs.class.trim().replace(/\s+/g,' ')===APPLY_CLASS
  &&Object.keys(cta.attrs).every(key=>['xml:lang','lang','class','href'].includes(key))),
 'native own application link is missing, disabled or contradictory')
 return {...job,country:'India',city:location.city,state:null,location:location.city+', India',locations:[location.city+', India'],
  sourceNativeCountryCodes:['IN'],sourceCountryScopeUnresolved:false,
  sourceGeographyEvidence:{kind:'exact-whole-own-role-location',nativeField:structuredClone(locationField),countryCode:'IN',
   country:'India',city:location.city,postalCode:location.postalCode},
  applyUrl:ORIGIN+path,applicationUrlIsGeneric:false,applicationVisited:false,applicationSubmitted:false,
  sourceNativeApplication:{...job.sourceNativeApplication,declaredOwnApplyURL:ORIGIN+path,activationVerified:false,backendSubmissionVerified:false},
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}

const comparable=job=>({id:job.jobId,requisition:job.requisitionId,title:job.title,company:job.company,url:job.sourceUrl,
 model:job.sourceNativeRole,criteria:job.jobDescription,application:job.sourceNativeApplication,
 postingDate:job.postingDate,closingDate:job.closingDate})

export async function runCurrentSchaeffler(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText||options.fetchPage||options.fetchImpl,'body-only callbacks cannot qualify original HTTP')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid job cap')
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const sourceTimeoutMs=options.sourceTimeoutMs??180000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=360000,'invalid source deadline')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(sourceTimeoutMs)])
 const receipts=[],phases=[],held=[]
 let decodedBytes=0
 const fetchPage=async(url)=>{
  signal.throwIfAborted()
  need(receipts.length<220,'native read-count budget exceeded')
  const acquire=async(requested,init)=>{
   if(options.fetchPage){
    const page=await options.fetchPage(requested,{...init,signal})
    need(page&&page.bodyUnavailable!==true&&Number.isInteger(page.status)&&page.headers&&typeof(page.url??page.finalUrl)==='string',
     'original HTTP metadata is unavailable')
    const bytes=typeof page.bodyBase64==='string'?Buffer.from(page.bodyBase64,'base64')
     :typeof page.html==='string'?Buffer.from(page.html):typeof page.body==='string'?Buffer.from(page.body):null
    need(bytes&&(!page.html||page.html===bytes.toString('utf8')),'original HTTP body is unavailable or contradictory')
    const response=new Response(bytes,{status:page.status,headers:page.headers})
    Object.defineProperty(response,'url',{value:page.url??page.finalUrl})
    return response
   }
   return (options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
  }
  const page=await boundedDeclaredPublicGet(url,{fetchImpl:acquire,signal,timeoutMs:15000,
   overflowError:firstPartyFailure(SOURCE,'Current native entity exceeds streaming ceiling')})
  signal.throwIfAborted()
  const bytes=Buffer.from(page.bodyBase64,'base64');decodedBytes+=bytes.length
  receipts.push({requestedUrl:url,url:page.url,status:page.status,headers:page.headers,bytes:bytes.length,
   sha256:sha(bytes),bodyBase64:page.bodyBase64})
  need(bytes.length<=1024*1024&&decodedBytes<=32*1024*1024,'native entity or source byte budget exceeded')
  need(page.url===url&&page.status===200&&/^(?:text\/html|(?:application|text)\/javascript)(?:;|$)/i.test(page.headers['content-type']||''),
   'original HTTP identity, status or MIME is unqualified')
  need(Buffer.from(bytes.toString('utf8')).equals(bytes),'original HTML is not valid UTF8')
  return {url:page.url,status:page.status,headers:page.headers,bodyBase64:page.bodyBase64,html:bytes.toString('utf8')}
 }
 try{
  for(const phase of ['opening','closing']){
   let audit
   const jobs=await runNative({...options,signal,now:observedAt,maxJobs:null,fetchText:undefined,fetchPage,onAudit:value=>{audit=value}})
   phases.push({phase,jobs,audit});signal.throwIfAborted()
  }
  const [opening,closing]=phases,closingJobs=new Map(closing.jobs.map(job=>[job.jobId,job])),qualified=[]
  for(const original of opening.jobs){
   try{
    const job=qualifyCurrentSchaefflerRole(original,observedAt),current=closingJobs.get(original.jobId)
    need(current,'own role was absent at closing')
    qualifyCurrentSchaefflerRole(current,observedAt)
    need(isDeepStrictEqual(comparable(original),comparable(current)),'whole own criteria/application/native model changed at closing')
    qualified.push({...job,sourceNativeClosingRole:structuredClone(current.sourceNativeRole),
     sourceNativeTemporalQualification:'whole-own-role-and-observed-listing-membership-reconciled'})
   }catch(error){signal.throwIfAborted();held.push({jobId:original.jobId,reason:error.message,
    openingRecord:structuredClone(original),closingRecord:structuredClone(closingJobs.get(original.jobId)??null)})}
  }
  for(const job of closing.jobs)if(!opening.jobs.some(original=>original.jobId===job.jobId))
   held.push({jobId:job.jobId,reason:'new-at-closing-role-not-qualified',openingRecord:null,closingRecord:structuredClone(job)})
  const jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:new Set(phases.flatMap(phase=>phase.jobs.map(job=>job.jobId))).size,
   observations:phases.map(phase=>({phase:phase.phase,records:phase.jobs})),heldNativeRows:held,
   openingNativeAudit:opening.audit,closingNativeAudit:closing.audit,originalResponses:receipts,
   qualifiedObservedRoles:qualified.length,decodedBytes,companyScopeComplete:false,sourceScopeComplete:false,
   companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,applicationSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.observedRecordCount,
   observedVacancyCount:audit.observedRecordCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'discovery-only',surface:HOME,firstParty:receipts.some(row=>row.status===200),listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-own-full-native-criteria-exact-workplace-tuple-and-own-apply-link-closing-qualified;company-scope-unverified'})
  await options.onAudit?.(structuredClone(audit));signal.throwIfAborted()
  return jobs
 }catch(error){
  signal.throwIfAborted()
  try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,phases,heldNativeRows:held,
   originalResponses:receipts,companyScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }
}
