import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
const norm=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const employer='Sattva Consulting Pvt Ltd',legal='Sattva Media and Consulting Private Limited',cin='U74300KA2009PTC049429'
export function classifyPublishedSattvaRecord(record,schema){
 const text=extractActiveDescription(record?.ats_job?.job_description??'')??''
 if(/repository/i.test(text)&&/not.*(?:live|immediate)/i.test(text))return'hiring-signal'
 if(/\b(?:talent\s*(?:pool|community)|(?:internship|application)\s+form|expression\s+of\s+interest|general\s+application)\b/i.test(record?.title??''))return'unknown-hiring-record'
 return schema?.['@type']==='JobPosting'&&norm(schema.title)===norm(record?.title)&&schema.description===record?.ats_job?.job_description?'vacancy':'unknown-hiring-record'
}
const nativeCountry=value=>['India','IN'].includes(value)?'India':typeof value==='string'&&value.trim()?value.trim():null
const isoDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value
const incompleteCriteria=html=>/<(?:img|iframe|object|embed|audio|video|canvas|svg|script|style|link)\b/i.test(html)
 ||/<[^>]*\b(?:hidden|inert)(?:\s|=|\/?>)/i.test(html)||/<[^>]*aria-hidden\s*=\s*["']?true/i.test(html)
 ||/(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\D|$)|clip(?:-path)?\s*:|(?:height|width)\s*:\s*0(?:px|em|rem)?\b)/i.test(html)
export function qualifyCurrentSattvaDetail(detail,{verifiedAt=new Date().toISOString()}={}){
 const fail=reason=>({reason,nativeId:detail.nativeId,detail}),record=detail.fullNativeRecord,native=detail.fullNativeRoleProps,schema=detail.nativeJobPosting
 if(detail.recordKind!=='vacancy')return fail(detail.recordKind==='hiring-signal'?'ongoing-intake-not-a-discrete-vacancy':'native-record-kind-unqualified')
 if(!record||record.account_id!==1566||record.listed!==true||record.on_career_page!==true||record.is_confidential!==false||!['external','internal_and_external'].includes(record.kind)||native?.listed!==true||native?.isPreview!==false)return fail('native-publication-state-unqualified')
 if(native.site?.company_name!==employer||native.site.account_display_name!=='Sattva Media and Consulting'||native.site.company_website!=='https://www.sattva.co.in/'||detail.currentLegalPublisher!==legal||detail.currentLegalPublisherCIN!==cin||schema?.hiringOrganization?.name!==employer||!['https://www.sattva.co.in','https://www.sattva.co.in/'].includes(schema.hiringOrganization.sameAs))return fail('native-role-employer-or-own-legal-publisher-unqualified')
 if(schema.identifier?.value!==String(record.id)||schema.identifier?.name!==employer)return fail('native-JobPosting-identifier-unqualified')
 const locations=Array.isArray(schema.jobLocation)?schema.jobLocation:schema.jobLocation?[schema.jobLocation]:[],offices=detail.explicitNativeOffices??[],countries=[...offices.flatMap(o=>[nativeCountry(o.country),nativeCountry(o.country_code)]),...locations.map(o=>nativeCountry(o.address?.addressCountry))].filter(Boolean)
 if(!countries.includes('India')||countries.some(c=>c!=='India'))return fail(countries.length?'native-role-country-not-unambiguously-india':'native-role-country-unknown')
 const criteria=detail.fullPublishedNativeCriteria
 if(typeof criteria!=='string'||schema.description!==criteria||record.ats_job.job_description!==criteria||!extractActiveDescription(criteria))return fail('native-full-criteria-not-bound')
 if(incompleteCriteria(criteria))return fail('native-nontext-or-hidden-criteria-unqualified')
 const form=native.form
 if(detail.enabledNativeApplyControlCount!==1||!form||!Array.isArray(form.static_fields)||!form.static_fields.length||!form.field_groups||typeof form.field_groups!=='object'||Array.isArray(form.field_groups)||!Array.isArray(form.ats_custom_fields)||!Array.isArray(form.ats_auto_rejection_rules))return fail('native-active-application-or-complete-form-model-unqualified')
 let url;try{url=new URL(detail.detailURL)}catch{return fail('native-role-application-url-unqualified')}
 if(url.protocol!=='https:'||url.hostname!=='careers.kula.ai'||url.port||url.search||url.hash||url.username||url.password||!new RegExp('^/sattva/'+record.id+'(?:-[a-z0-9]+)*$').test(url.pathname)||detail.nativeOriginalResponse?.status!==200||detail.nativeOriginalResponse.finalURL!==detail.detailURL)return fail('native-role-application-url-unqualified')
 const apiDate=record.launch_at??null,schemaDate=schema.datePosted??null
 if(apiDate!==null&&!isoDate(apiDate)||schemaDate!==null&&!isoDate(schemaDate)||apiDate!==null&&schemaDate!==null&&apiDate!==schemaDate)return fail('native-publication-date-unqualified')
 const postingDate=apiDate??schemaDate,publicationDateProvenance=apiDate!==null&&schemaDate!==null?'current-native-JobPosting-datePosted-matches-API-launch_at':apiDate!==null?'current-native-API-launch_at':schemaDate!==null?'current-own-native-JobPosting-datePosted':null
 if(record.end_at!=null&&!isoDate(record.end_at))return fail('native-closing-date-unqualified')
 const labels=[...new Set(offices.map(o=>o.location??o.name).filter(v=>typeof v==='string'&&v.trim()))]
 return{job:{source:'sattvamedia',company:detail.publishedEmployerDisplay,title:record.title,originalTitle:record.title,jobId:String(record.id),requisitionId:null,nativeIdKind:'kula-public-job-post-id',sourceUrl:detail.detailURL,link:detail.detailURL,applyUrl:detail.detailURL,
  sourceDescription:criteria,jobDescription:criteria,country:'India',location:labels.join(' | ')||'India',city:offices.length===1?offices[0].city??null:null,state:offices.length===1?offices[0].state??null:null,employmentType:record.ats_job.work_type_name??record.ats_job.employment_type??null,department:record.ats_job.ats_department?.name??null,
  remoteStatus:({remote:'Remote',hybrid:'Hybrid',office:'On-site'})[record.ats_job.workplace]??null,postingDate,closingDate:record.end_at??null,nativePublicationDateProvenance:publicationDateProvenance,nativeJobPosting:schema,nativeListingRecord:record,nativeRoleModel:native,nativeApplicationModel:form,nativeOffices:offices,nativeLegalPublisher:legal,nativeHiringOrganizationName:schema.hiringOrganization.name,nativeLegalPublisherCIN:cin,nativeEmployerDisplay:detail.publishedEmployerDisplay,nativeAccountDisplay:detail.publishedAccountDisplay,
  sourceDetailComplete:true,sourceEmployerQualified:true,sourceApplicationQualified:true,sourcePublicationQualified:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,browserEquivalenceComplete:false,applicationSubmitted:false,publicEligibility:null,companyCareerPage:'https://careers.kula.ai/sattva',companyDomain:'sattva.co.in',atsPlatform:'kula',scrapedAt:verifiedAt}}
}
