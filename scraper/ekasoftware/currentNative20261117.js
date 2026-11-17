import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createEkaReader,need} from './currentRead20261117.js'
const profile=JSON.parse(readFileSync(new URL('./reviewedNative20261117.json',import.meta.url)))
const SOURCE='ekasoftware',HOME='https://quoreka.com/',CAREERS=HOME+'careers',HOST='https://careers.quoreka.com',WIDGET=profile.programs[0].url,CLIENT=profile.programs[1].url,CSS=profile.programs[2].url
const routes=['/hire/widgets/jobs.json','/hire/widgets/jobs/gdpr_privacy_policy_link.json','/hire/widgets/jobs/lead_sources.json','/hire/widgets/jobs/lead_mediums.json','/hire/widgets/jobs/job_form.json','/hire/widgets/jobs/has_resume_parse_auto_complete.json','/hire/widgets/jobs/disable_captcha.json','/hire/widgets/jobs/has_remote_jobs.json']
const holds=['per-role-Eka-legal-employer-unqualified;Quoreka-brand-and-policy-reference-not-employment-proof','full-native-Handlebars-rendered-criteria-and-application-contract-unqualified','native-created-at-not-qualified-posting-date','employer-wide-India-and-global-inventory-scope-unproved']
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),positive=v=>Number.isSafeInteger(v)&&v>0,nonempty=v=>typeof v==='string'&&v.trim().length>0
function authority(html,url){
 const doc=readNativeDocument(html),head=activeHead(html),canonicals=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical'))
 need(isDeepStrictEqual(head.titles,[url===HOME?'Quoreka | The operating system for commodity-driven business':'Careers at Quoreka'])&&!doc.nodes(n=>n.tag==='base').length,'current Quoreka publisher identity/base changed')
 need(canonicals.length===1&&new URL(canonicals[0].attrs.href).href===url,'current own canonical publisher changed')
 if(url===HOME){const careers=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers').map(n=>new URL(n.attrs.href,HOME).href);need(careers.includes(CAREERS)&&careers.includes(CAREERS+'-old'),'current exact corporate careers declarations changed')}
 else need(doc.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.src===WIDGET).length===1&&doc.nodes(n=>n.attrs.id===profile.widgetContainerId).length===1,'current unique declared widget/container changed')
 return html
}
function nativeRows(value){
 need(object(value)&&Array.isArray(value.jobs)&&value.jobs.length<=100&&Array.isArray(value.branches)&&value.branches.length<=500&&Array.isArray(value.job_roles)&&value.job_roles.length<=500,'complete typed native widget model unavailable')
 const unique=(rows,label)=>{const ids=new Set();for(const row of rows){need(object(row)&&positive(row.id)&&!ids.has(row.id),'duplicate or malformed native '+label+' identity');ids.add(row.id)}return ids}
 unique(value.jobs,'job');const branches=unique(value.branches,'branch'),roles=unique(value.job_roles,'role-group')
 for(const branch of value.branches)need(branch.account_id===profile.nativeAccountId&&typeof branch.deleted==='boolean'&&(branch.country_code==null||/^[A-Z]{2}$/.test(branch.country_code)),'native branch account/country model changed')
 for(const job of value.jobs){
  need(nonempty(job.title)&&job.title.length<=500&&nonempty(job.description)&&job.description.length<=1024*1024&&/^[A-Za-z0-9_-]{1,128}$/.test(job.unique_id??'')&&branches.has(job.branch_id)&&roles.has(job.job_role_id)&&typeof job.remote==='boolean'&&typeof job.deleted==='boolean'&&Number.isSafeInteger(job.status)&&Number.isSafeInteger(job.job_type),'native full job/branch/group identity changed')
  let url;try{url=new URL(job.url)}catch{need(false,'native role URL unavailable')}
  need(url.origin===new URL(CAREERS).origin&&url.pathname==='/careers'&&!url.username&&!url.password&&!url.hash&&url.searchParams.size===1&&url.searchParams.getAll('jobId').length===1&&url.searchParams.get('jobId')===job.unique_id,'native role URL/unique ID binding changed')
 }
 return value
}
function ownRole(job,data){
 need(object(data)&&object(data.job)&&data.job.id===job.id&&['title','description','url','unique_id','branch_id','job_type','status','deleted'].every(k=>Object.hasOwn(data.job,k)),'native own-role identity unavailable')
 // The native list and applicant DTOs are different models. Compare every
 // shared field and retain both complete originals, including their distinct
 // custom fields, role-group/remote metadata and applicant-form relation.
 for(const key of Object.keys(job))if(Object.hasOwn(data.job,key))need(isDeepStrictEqual(job[key],data.job[key]),'native own-role/listing '+key+' conflict')
 need(positive(data.job.applicant_form_id)&&Array.isArray(data.applicant_forms)&&data.applicant_forms.length>0&&data.applicant_forms.length<=30&&Array.isArray(data.applicant_form_fields)&&data.applicant_form_fields.length<=2000,'own-role public applicant form model unavailable')
 const forms=data.applicant_forms.filter(f=>object(f)&&f.id===data.job.applicant_form_id),ids=new Set()
 for(const f of data.applicant_form_fields){need(object(f)&&positive(f.id)&&!ids.has(f.id),'own-role applicant field identity changed');ids.add(f.id)}
 need(forms.length===1&&Array.isArray(forms[0].public_field_ids)&&forms[0].public_field_ids.every(id=>ids.has(id)),'own-role public form/field relation changed')
 need(data.applicant_form_field_choices===undefined||Array.isArray(data.applicant_form_field_choices)&&data.applicant_form_field_choices.length<=5000,'own-role applicant choice model unavailable')
 return data
}
export async function runCurrentEka(options={}){
 options.signal?.throwIfAborted();need(!options.fetchPage&&!options.fetchText&&!options.fetchJson,'original HTTP metadata required; body-only callbacks cannot certify current native jobs')
 const maxJobs=options.maxJobs??100;need(Number.isSafeInteger(maxJobs)&&maxJobs>=0&&maxJobs<=100,'invalid caller output cap')
 const observedAt=typeof options.now==='function'?options.now():new Date().toISOString(),epoch=Date.parse(observedAt);need(Number.isFinite(epoch)&&/^\d{13}$/.test(String(epoch)),'invalid native clock/cache-buster')
 const jobs=[],inventory=(reason,pagesFetched)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason})
 if(maxJobs===0)return inventory('caller-zero-cap;current-native-inventory-unobserved',0)
 // The exact reviewed loader creates this timestamp-only URL. Reuse the
 // same actual URL at closing; no native query parameter is normalized away.
 const clientURL=CLIENT+'?t='+epoch,io=createEkaReader(options,[[HOME,'html'],[CAREERS,'html'],[WIDGET,'loader'],[clientURL,'javascript'],[CSS,'css'],...routes.map(path=>[HOST+path,'json'])])
 const readJSON=async url=>JSON.parse((await io.read(url)).text)
 const readAuthority=async()=>{
  const home=authority((await io.read(HOME)).text,HOME),careers=authority((await io.read(CAREERS)).text,CAREERS),loader=await io.read(WIDGET)
  need(loader.sha256===profile.programs[0].sha256,'whole declared public loader program changed')
  return {home,careers,loader:loader.text,loaderURL:WIDGET}
 }
 const readPrograms=async()=>{const javascript=await io.read(clientURL),css=await io.read(CSS);need(javascript.sha256===profile.programs[1].sha256&&css.sha256===profile.programs[2].sha256,'whole declared native client/stylesheet program changed');return {clientURL,javascript:javascript.text,css:css.text}}
 const readModels=async()=>{
  const models={};for(const path of routes)models[path]=await readJSON(HOST+path)
  nativeRows(models[routes[0]])
  need(object(models[routes[1]])&&Object.hasOwn(models[routes[1]],'gdpr_privacy_policy_link')&&object(models[routes[2]])&&Array.isArray(models[routes[2]].lead_sources)&&object(models[routes[3]])&&Array.isArray(models[routes[3]].lead_media)&&object(models[routes[4]])&&object(models[routes[4]].job_form)&&routes.slice(5).every(path=>typeof models[path]==='boolean'),'native public configuration model unavailable')
  return models
 }
 const readDetails=async rows=>{const result=[];for(const row of rows){io.allowOwnRole(row.id);result.push({id:row.id,data:ownRole(row,await readJSON(HOST+'/hire/widgets/jobs/'+row.id+'.json'))})}return result}
 try{
  const openingAuthority=await readAuthority(),openingPrograms=await readPrograms(),openingNative=await readModels(),rows=openingNative[routes[0]].jobs,openingDetails=await readDetails(rows)
  const opening={authority:openingAuthority,programs:openingPrograms,native:openingNative,details:openingDetails}
  const closingDetails=await readDetails(rows),closingNative=await readModels(),closingPrograms=await readPrograms(),closingAuthority=await readAuthority(),closing={authority:closingAuthority,programs:closingPrograms,native:closingNative,details:closingDetails}
  need(isDeepStrictEqual(opening,closing),'whole raw publisher/program/native job/branch/group/form/configuration models changed at closing')
  const branches=openingNative[routes[0]].branches,observations=rows.map((row,index)=>{const branch=branches.find(b=>b.id===row.branch_id);return {
   source:SOURCE,company:'Quoreka',sourceTargetCompany:'Eka Software',sourceEmployerQualified:false,jobId:String(row.id),requisitionId:row.unique_id,title:row.title,sourceUrl:row.url,applyUrl:row.url,
   country:null,location:null,city:null,nativeBranchCountryCode:row.remote||row.deleted||branch.deleted?null:branch.country_code,nativeBranchModel:structuredClone(branch),nativeRemote:row.remote,nativeDeleted:row.deleted,
   nativeListModel:structuredClone(row),nativeOwnRoleModel:structuredClone(openingDetails[index].data),nativeClosingOwnRoleModel:structuredClone(closingDetails[index].data),nativePublishedDescriptionHTML:row.description,
   jobDescription:null,sourceDetailComplete:false,sourceDetailStatus:'native-employer-rendering-application-unqualified',postingDate:null,sourcePostingDateUnknown:true,nativeCreatedAt:row.created_at,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,qualificationHolds:[...holds,...(row.deleted?['native-explicitly-deleted-role;not-current-vacancy']:[])],
  }})
  const observedVacancyCount=rows.filter(row=>!row.deleted).length
  const audit={source:SOURCE,recordKind:observedVacancyCount===rows.length?'vacancy-rows':'mixed',observedRecordCount:rows.length,observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,observedAt,
   observationScope:'current-configured-Quoreka-native-widget-jobs;not-qualified-Eka-employer/India/global-inventory',observations,opening,closing,wholeRawNativeModelsClosingReconciled:true,excludedClosingPaths:[],explicitNativeIndiaBranchRows:observations.filter(o=>o.nativeBranchCountryCode==='IN').length,
   companyScopeComplete:false,sourceEmployerQualified:false,renderedFullCriteriaQualified:false,applicationQualified:false,qualificationHolds:holds,reader:io.stats()}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  inventory('configured-current-Quoreka-native-observations;Eka-employer/rendered-criteria/application/posting/company-scope-unqualified',io.stats().requests)
  io.check();return jobs
 }finally{io.close()}
}
