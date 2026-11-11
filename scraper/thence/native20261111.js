import {isDeepStrictEqual} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createThenceTransport} from './transport20261111.js'

export const SOURCE='thence'
export const COMPANY='Thence Private Limited'
export const HOMEPAGE_URL='https://thence.co'
export const CURRENT_HOMEPAGE_URL='https://www.thence.digital/'
export const CAREERS_URL='https://www.thence.digital/careers'
export const APPLY_URL=CAREERS_URL+'#section-contact-us-form'
const migratedHome='https://thence.digital/'
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[thence] '+message),{abortRetries:true,failureKind:'native_contract_unverified'})}
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const excluded=new Set(['blockquote','q','pre','code','template','noscript','style','textarea'])
function activeDocument(html){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0]
 const nodes=(predicate,subtree=root)=>{const found=[],visit=n=>{if(n.inert||excluded.has(n.tag))return;if(predicate(n))found.push(n);for(const child of n.children)if(typeof child!=='string')visit(child)};visit(subtree);return found}
 const text=node=>{const visit=n=>typeof n==='string'?decodeHTML(n):n.inert||excluded.has(n.tag)||['script','title'].includes(n.tag)?'':n.children.map(visit).join(' ');return norm(visit(node))}
 // A base URL affects navigation even when visually hidden or quoted. The
 // current documents supply none; template/noscript content is inert.
 const bases=[],visit=n=>{if(['template','noscript'].includes(n.tag))return;if(n.tag==='base')bases.push(n);for(const child of n.children)if(typeof child!=='string')visit(child)};visit(root)
 need(bases.length===0,'unreviewed document base authority')
 return{nodes,text,root}
}
const one=(values,label)=>{need(values.length===1,'unique active '+label+' required');return values[0]}
function publisher(html,url,title){
 const doc=activeDocument(html),headTitle=one(doc.nodes(n=>n.tag==='title'),'publisher title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel?.toLowerCase()==='canonical'),'publisher canonical'),og=one(doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:title'),'publisher title metadata')
 need(norm(decodeHTML(headTitle.raw))===title&&og.attrs.content===title&&canonical.attrs.href===url,'current publisher title/canonical binding changed')
 return doc
}
export function inspectHomepage(html){
 const doc=publisher(html,CURRENT_HOMEPAGE_URL,'Thence Digital')
 const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers')
 need(links.length>0,'current official careers handoff missing')
 const declarations=links.map(n=>{let url;try{url=new URL(n.attrs.href,CURRENT_HOMEPAGE_URL)}catch{need(false,'invalid corporate careers URL')}
  need(url.href===CAREERS_URL&&!url.username&&!url.password,'current official careers handoff authority changed')
  return{nativeHref:n.attrs.href,text:doc.text(n),resolvedURL:url.href}
 })
 return{url:CURRENT_HOMEPAGE_URL,title:'Thence Digital',canonicalURL:CURRENT_HOMEPAGE_URL,careersURL:CAREERS_URL,declarations}
}
export const hasOfficialHomepageSignal=html=>{try{inspectHomepage(html);return true}catch{return false}}
export const extractCareersUrlFromHomepage=html=>{try{return inspectHomepage(html).careersURL}catch{return null}}
const slugify=value=>norm(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
export function inspectApplicationForm(html){
 const doc=publisher(html,CAREERS_URL,'Careers'),headline=one(doc.nodes(n=>n.tag==='h1'),'careers heading')
 need(norm(doc.text(headline).replace(/\p{Cf}/gu,''))==='Solve for Change, Craft a better you.'&&doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)==='Working at Thence').length===1,'current careers publisher heading changed')
 const section=one(doc.nodes(n=>n.attrs.id==='section-contact-us-form'),'application section'),form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='job-application-form'),'native application form')
 need(doc.nodes(n=>n===form,section).length===1&&form.attrs.method?.toLowerCase()==='get'&&!form.attrs.action,'native shared application form boundary changed')
 const apply=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='#section-contact-us-form'&&['See Open Roles','Apply Now'].includes(doc.text(n)))
 need(apply.length===2,'active own application handoff changed')
 const select=one(doc.nodes(n=>n.tag==='select'&&n.attrs.id==='jaf-select_role'),'native application role selector')
 need(doc.nodes(n=>n===select,form).length===1&&select.attrs.name==='Select-role','native role selector not bound to own form')
 const salary=one(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='Current-CTC-LPA-INR',form),'current applicant salary input')
 const experience=one(doc.nodes(n=>n.tag==='input'&&n.attrs.id==='jaf-experience',form),'self-reported experience input')
 need(experience.attrs.name==='Relevant-years-of-experience'&&salary.attrs.id==='jaf-current_ctc','native applicant intake fields changed')
 const reference=one(doc.nodes(n=>n.tag==='select'&&n.attrs.id==='jad-reference',form),'applicant referral selector')
 const referrals=doc.nodes(n=>n.tag==='option',reference).map(n=>doc.text(n))
 need(referrals.includes('Linked In - Job Posting')&&referrals.includes('Thence Website'),'native application publisher reference changed')
 const options=doc.nodes(n=>n.tag==='option',select),choices=[]
 need(options.length>1&&options.length<=65,'bounded native role choices required')
 for(let ordinal=0;ordinal<options.length;ordinal++){
  const option=options[ordinal],value=option.attrs.value,title=doc.text(option)
  need(typeof value==='string'&&!!value,'native option value missing')
  if(value==='-'){need(ordinal===0&&title==='Select role','native placeholder option changed');continue}
  need(value===title&&!!slugify(title),'native option label/value identity mismatch')
  choices.push({ordinal,value,title,jobId:SOURCE+'-'+slugify(title),attributes:structuredClone(option.attrs),rawDisplayTextFragments:option.children.filter(c=>typeof c==='string')})
 }
 need(choices.length>0&&new Set(choices.map(c=>c.value)).size===choices.length&&new Set(choices.map(c=>c.jobId)).size===choices.length,'native application choice duplicate/internal-ID collision')
 return{url:CAREERS_URL,canonicalURL:CAREERS_URL,title:'Careers',headline:doc.text(headline),formID:form.attrs.id,selectorID:select.attrs.id,applicationURL:APPLY_URL,choices,
  recordKind:'application-role-choices',confirmedNativeVacancyTotal:null,confirmedIndiaVacancyTotal:null,sourceScopeComplete:false,legalEmployerVerified:false}
}
export const hasOfficialCareersSignal=html=>{try{inspectApplicationForm(html);return true}catch{return false}}
export function extractOpenRoles(html){
 const form=inspectApplicationForm(html)
 return form.choices.map(option=>({title:option.title,company:COMPANY,source:SOURCE,department:null,location:null,city:null,country:null,
  sourceCountryScopeUnresolved:true,sourceRecordKind:'application-role-choice',sourceNativeVacancyConfirmed:false,
  jobId:option.jobId,requisitionId:null,nativeRequisitionId:null,nativeLegalEmployer:null,legalEmployer:null,
  sourceUrl:CAREERS_URL,applyUrl:APPLY_URL,link:APPLY_URL,employmentType:null,sourceEmploymentTypeUnresolved:true,experienceRequired:null,sourceExperienceRequired:null,sourceExperienceScopeUnresolved:true,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,
  jobDescription:null,sourceDescription:null,sourceDescriptionHTML:null,publicExperienceChecked:false,skipPublicExperienceEnrichment:true,sourceExperienceEvidenceKind:'shared-applicant-intake-not-own-role-requirement',remoteStatus:null,
  sourceDetailComplete:false,sourceDetailFailureKind:'application-role-choice-without-own-criteria',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  sourceNativeApplicationOption:structuredClone(option),sourceNativePublisherName:'Thence Digital',sourceEmployerBinding:{kind:'configured-source-with-current-corporate-brand',legalEntityVerified:false}}))
}
// Kept for existing callers. A 404 no longer returns an empty inventory: the
// production reader holds every failed public read.
export const isRetiredCareersRouteError=error=>error?.status===404&&[CAREERS_URL,'https://thence.digital/careers'].includes(error.url)||/HTTP 404 for https:\/\/(?:www\.)?thence\.digital\/careers\b/i.test(String(error?.message??''))
export const createThenceScraper=()=>({run})
export async function run(options={}){
 options.signal?.throwIfAborted()
 need(['fetchText','fetchJson','fetchPage','fetchResponse','fetchBytes','fetchHtml'].every(key=>options[key]==null)&&[options.maxJobs,options.maxPages,options.maxRequests].every(value=>value==null),'native HTTP response metadata required; body-only callbacks or partial caps unsupported')
 need(options.fetchImpl==null||typeof options.fetchImpl==='function','native fetchImpl callback must return full HTTP response metadata')
 const receipts=[],session=createThenceTransport(options,receipts)
 const home=async()=>{
  const legacy=await session.read(HOMEPAGE_URL,'redirect',301)
  need(new URL(legacy.receipt.headers.location,legacy.receipt.finalUrl).href===migratedHome,'legacy corporate redirect authority changed')
  const migration=await session.read(migratedHome,'redirect',308)
  need(new URL(migration.receipt.headers.location,migration.receipt.finalUrl).href===CURRENT_HOMEPAGE_URL,'current corporate redirect authority changed')
  const result=await session.read(CURRENT_HOMEPAGE_URL,'html');const model=inspectHomepage(result.text);session.check();return model
 }
 try{
  const openingHome=await home(),openingResponse=await session.read(openingHome.careersURL,'html'),opening=inspectApplicationForm(openingResponse.text),jobs=extractOpenRoles(openingResponse.text)
  session.check();const closingHome=await home();need(isDeepStrictEqual(openingHome,closingHome),'closing current corporate publisher/handoff changed')
  const closingResponse=await session.read(closingHome.careersURL,'html'),closing=inspectApplicationForm(closingResponse.text)
  need(isDeepStrictEqual(opening,closing),'closing own application choices/intake metadata changed');session.check()
  const audit={source:SOURCE,productionWrites:false,recordKind:'application-role-choices',observedApplicationRoleChoices:jobs.length,confirmedNativeVacancyTotal:null,confirmedIndiaVacancyTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   originalPages:receipts,corporateDeclaration:openingHome,applicationForm:opening,applicationRoleCandidates:structuredClone(jobs),closingCorporateMatches:true,closingApplicationChoicesMatch:true,legalEmployerVerified:false}
  for(let i=0;i<jobs.length;i++){jobs[i].scrapedAt=new Date().toISOString();jobs[i].sourceApplicationChoiceEvidence=i===0?audit:{source:SOURCE,recordKind:'application-role-choices',observedApplicationRoleChoices:jobs.length,confirmedNativeVacancyTotal:null,sourceScopeComplete:false,firstCandidateID:jobs[0].jobId,retainedResponseCount:receipts.length}}
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  await session.race(()=>options.onAudit?.(structuredClone(audit)));session.check()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-application-role-choices-observed-without-confirmed-native-vacancy-country-or-own-criteria'})
 }catch(error){
  if(error instanceof Error&&!options.signal?.aborted&&Object.isExtensible(error)){
   const retry=Object.getOwnPropertyDescriptor(error,'abortRetries');if(!retry||retry.configurable)Object.defineProperty(error,'abortRetries',{value:true,writable:true,configurable:true,enumerable:true});else if(retry.writable)error.abortRetries=true
   const packets=receipts.map(p=>({url:p.url,status:p.status,headers:p.headers,rawBodyBase64:p.rawBodyBase64,bodyBytes:p.bytes,bodySHA256:p.sha256,requestedAt:p.requestedAt,completedAt:p.observedAt,...(p.error?{failure:{message:p.error}}:{})}))
   Object.defineProperty(error,'nativeEvidence',{value:{source:SOURCE,observedListingCount:null,jobs:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryComplete:false,transportPackets:packets,retainedResponses:packets,failures:[{stage:'current-publisher-or-application-intake',message:error.message}]}})
  }
  throw error
 }finally{session.close()}
}
