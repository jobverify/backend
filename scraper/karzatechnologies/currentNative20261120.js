import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader} from './currentRead20261120.js'
const SOURCE='karzatechnologies',ORIGIN='https://cutshort.io',WEBSITE='https://karza.in',CONFIGURED=ORIGIN+'/company/karza-technologies-96-N8gUopJW'
const registered={id:'63ef12eda107ba0027f99984',name:'Karza Technologies',alias:'karza-technologies-96-N8gUopJW'},alternate={id:'5fbb8dab1a3650724c7c3218',name:'Karza',alias:'karza-57-fklLKW3D'}
const need=(ok,m)=>{if(!ok)throw firstPartyFailure(SOURCE,m)},norm=s=>String(s??'').replace(/\s+/g,' ').trim(),id=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s)
const employer=s=>['Karza','Karza Technologies'].includes(norm(s)),sameSite=s=>typeof s==='string'&&s.replace(/\/$/,'')===WEBSITE
const cap=(v,label)=>{if(v===undefined)return Infinity;need(Number.isSafeInteger(v)&&v>=0,'invalid '+label);return v}
const nativePage=html=>{const d=readNativeDocument(html),scripts=d.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json');need(scripts.length===1&&!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'current native literal page or publisher changed');return{d,model:readLiteralModel(scripts[0].raw).value}}
const pageData=(model,key,slug)=>{const queries=model.props?.pageProps?.dehydratedState?.queries?.filter(q=>q.queryKey?.length===2&&q.queryKey[0]===key&&q.queryKey[1]===slug);need(queries?.length===1&&queries[0].state?.data?.success===true,'current native exact page model unavailable');return queries[0].state.data.data.pageData}
const companyPage=(html,expected)=>{const {d,model}=nativePage(html),data=pageData(model,'companyPageData',expected.alias),company=data.company,table=data.companyJobs
 need(model.page==='/company/[slug]'&&model.query?.slug===expected.alias&&company?._id===expected.id&&company.name===expected.name&&company.alias===expected.alias&&sameSite(company.links?.website),'native exact company identity/website changed')
 need(d.nodes(n=>n.tag==='h1'&&d.text(n)===expected.name).length===1&&d.nodes(n=>/^h[1-3]$/.test(n.tag)&&d.text(n)==='Jobs at '+expected.name).length===1,'native rendered company identity changed')
 need(table&&Array.isArray(table.jobs)&&table.jobs.length<=100&&table.page===1&&table.totalPages===(table.jobs.length?1:0),'current native company pagination needs qualification')
 for(const row of table.jobs)need(id(row._id)&&typeof row.headline==='string'&&d.nodes(n=>n.tag==='a'&&n.attrs.href===row.publicUrl&&d.text(n)===row.headline).length>=1,'native rendered vacancy and model identity changed')
 return{data,d}
}
function constraints(html,at,dates){
 const d=readNativeDocument(typeof html==='string'?html:''),text=extractActiveDescription(html??'')??''
 need(!findExplicitNativeClosure([text]),'native vacancy explicitly closed')
 for(const n of d.nodes(n=>['p','li','div','h1','h2','h3','h4','strong','b','dd','td'].includes(n.tag))){const line=norm(d.text(n)),m=/^([^:]{1,40}):\s*(.+)$/.exec(line);if(!m)continue;const label=norm(m[1]),value=norm(m[2])
  if(/^(?:company(?: name)?|employer|legal employer|hiring organization)$/i.test(label))need(employer(value),'native authored employer conflict')
  if(/^(?:(?:job|work|workplace)\s+)?country$/i.test(label))need(nativeCountryName(value)==='India','native authored country conflict')
  if(/^(?:(?:job|work)\s+)?(?:location|workplace)$/i.test(label)){const c=nativeLocationCountryName(value);need(!c||c==='India','native authored workplace conflict')}
  if(/^(?:status|job status|publication status)$/i.test(label))need(/^(?:open|active|published|available)$/i.test(value),'native authored publication status conflict')
  if(/^(?:closing date|application deadline|valid through|expiry date|expiration date)$/i.test(label))date(value,at,true,dates,label)
  if(/^(?:date posted|posted date|publication date|published date)$/i.test(label))date(value,at,false,dates,label)
 }
}
function date(value,at,expiry,dates,label){const parsed=nativeDate(value,{required:true});need(expiry?(parsed.exact?Date.parse(parsed.iso)>=Date.parse(at):parsed.iso.slice(0,10)>=at.slice(0,10)):Date.parse(parsed.iso)<=Date.parse(at),expiry?'native vacancy expired':'native publication date in future');dates[expiry?'expiries':'publications'].push({label,...parsed})}
const roleModel=(html,row)=>{const {d,model}=nativePage(html),slug=new URL(row.publicUrl).pathname.split('/').at(-1),data=pageData(model,'jobData',slug),schemas=d.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value).filter(v=>v['@type']==='JobPosting');need(schemas.length===1&&model.page==='/job/[slug]'&&model.query?.slug===slug&&d.nodes(n=>n.tag==='h1'&&d.text(n)===row.headline).length===1,'native exact role page/schema identity changed');return{data,schema:schemas[0],applicationButtons:d.nodes(n=>n.tag==='button'&&d.text(n)==='Apply to this job').map(n=>n.attrs)}}
const qualify=(row,detail,publisher,at)=>{
 const m=detail.data,s=detail.schema,dates={publications:[],expiries:[]}
 need(row.hiringForClient===false&&row.companyId?._id===publisher.id&&row.companyDetails?._id===publisher.id&&m.hiringForClient===false&&m.companyId?._id===publisher.id&&(!m.clientCompanyId||Object.keys(m.clientCompanyId).length===0),'native agency/client-employer role outside exact configured company')
 need(m._id===row._id&&m.headline===row.headline&&m.publicUrl===row.publicUrl&&m.jobValid===true&&s.identifier?.value===row._id&&s.identifier.name===publisher.name&&s.title===row.headline&&s.hiringOrganization?.name===publisher.name&&s.hiringOrganization.sameAs?.includes(ORIGIN+'/company/'+publisher.alias),'native role identity/publication/employer conflict')
 need(detail.applicationButtons.length>=1&&detail.applicationButtons.every(a=>!Object.hasOwn(a,'disabled')&&a['aria-disabled']!=='true'),'native own role application control unavailable')
 const locations=Array.isArray(s.jobLocation)?s.jobLocation:[s.jobLocation],addresses=locations.map(l=>l?.address)
 need(addresses.length>0&&addresses.every(a=>a&&nativeCountryName(a.addressCountry)==='India')&&Array.isArray(row.locations)&&isDeepStrictEqual(addresses.map(a=>norm(a.addressLocality)).sort(),row.locations.map(norm).sort())&&norm(m.locations)===row.locations.map(norm).join(', '),'native exact workplace/country unqualified; company headquarters not used')
 date(s.datePosted,at,false,dates,'JobPosting.datePosted');date(s.validThrough,at,true,dates,'JobPosting.validThrough')
 for(const [label,value]of [['hiringIntentShownOn',m.hiringIntentShownOn],['nativePostedLabel',m.jobFactSummary?.postedDate]])if(value)date(value,at,false,dates,label)
 constraints(m.sanitizedComment,at,dates);constraints(s.description,at,dates)
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso))
 return{dates,addresses}
}
export async function runCurrentKarza(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap'),allowed=new Set([CONFIGURED]),io=createCurrentReader(options,(url,kind)=>kind==='html'&&allowed.has(url))
 let audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,nativeObservedRecords:0,qualifiedIndiaRecords:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,fullPublicModelsClosingReconciled:false,heldRecords:[],parentRolesRelabelled:0,agencyClientRolesPromoted:0,applicationInteractions:0,publisherProgramsExecuted:false}
 const finish=jobs=>{attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CONFIGURED,firstParty:io.stats().requests>0,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:typeof options.now==='function'?options.now():new Date().toISOString(),reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'current-exact-company-native-alias-binding-direct-employer-country-role-application-handoff-qualified;parent-and-agency-records-not-relabelled-company-inventory-and-cleanup-unqualified'});attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...audit,transport:io.stats()},configurable:true});return jobs}
 try{
  if(maxJobs===0||maxPages===0)return finish([])
  const at=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid observation clock')
  const phase=async phase=>{
   const own=companyPage((await io.read(CONFIGURED,{phase})).text,registered),bindings=own.data.similarCompanies?.filter(r=>r._id===alternate.id&&r.alias===alternate.alias&&r.name===alternate.name&&sameSite(r.websiteLink)&&/^Karza Technologies\b/.test(norm(r.description)))
   need(bindings?.length===1&&own.d.nodes(n=>n.tag==='a'&&n.attrs.href==='/company/'+alternate.alias).length>=1,'native same-company website/long-name alias binding unavailable')
   const url=ORIGIN+'/company/'+alternate.alias;allowed.add(url)
   const other=companyPage((await io.read(url,{phase})).text,alternate);need(/^Karza Technologies\b/.test(norm(other.data.company.description))&&other.data.company.links?.linkedin==='https://linkedin.com/company/karza-technologies','native exact long-company identity changed')
   const companies=[{publisher:registered,model:{company:own.data.company,companyJobs:own.data.companyJobs}},{publisher:alternate,model:{company:other.data.company,companyJobs:other.data.companyJobs}}],roles=[]
   for(const company of companies)for(const row of company.model.companyJobs.jobs){
    let roleURL;try{roleURL=new URL(row.publicUrl);need(roleURL.origin===ORIGIN&&!roleURL.search&&!roleURL.hash&&!roleURL.username&&!roleURL.password&&/^\/job\/[a-zA-Z0-9_-]{1,250}$/.test(roleURL.pathname),'native role URL outside configured publisher')}catch{need(false,'native exact role URL unavailable')}
    allowed.add(roleURL.href);const detail=roleModel((await io.read(roleURL.href,{phase})).text,row);let application=null
    if(row.hiringForClient===false&&row.companyId?._id===company.publisher.id){const target=ORIGIN+'/profile/view/j/'+row._id;need(row.authApplyUrl===target,'native authored same-role application handoff changed');allowed.add(target);const {model}=nativePage((await io.read(target,{phase})).text);need(model.page==='/profile/[...slug]'&&model.isFallback===false&&isDeepStrictEqual([...model.query?.slug??[]],['view','j',row._id]),'native application profile role context changed');application={url:target,page:model.page,query:model.query,isFallback:model.isFallback}}
    roles.push({publisher:company.publisher,row,detail,application})
   }
   need(new Set(roles.map(r=>r.row._id)).size===roles.length,'duplicate native job identity across configured company aliases')
   return{configuredCompanyURL:CONFIGURED,nativeCompanyBinding:bindings[0],companies,roles}
  }
  const opening=await phase('opening'),closing=await phase('closing'),closed=new Map(closing.roles.map(r=>[r.row._id,r])),jobs=[],held=[]
  need(isDeepStrictEqual(opening.nativeCompanyBinding,closing.nativeCompanyBinding)&&isDeepStrictEqual(opening.companies,closing.companies),'full native company publication models changed at closing')
  for(const role of opening.roles){try{
   need(isDeepStrictEqual(role,closed.get(role.row._id)),'full native role/criteria/application models changed at closing')
   const proof=qualify(role.row,role.detail,role.publisher,at),m=role.detail.data,s=role.detail.schema
   need(role.application,'native same-role authored application handoff unavailable')
   jobs.push({source:SOURCE,company:'Karza Technologies',jobId:role.row._id,requisitionId:null,title:m.headline,country:'India',city:proof.addresses[0].addressLocality,state:null,location:role.row.locations.join(' / '),sourceUrl:role.row.publicUrl,link:role.row.publicUrl,applyUrl:role.application.url,postingDate:proof.dates.publications[0]?.raw??null,closingDate:proof.dates.expiries[0]?.raw??null,sourceNativeDates:proof.dates,sourceNativeDateAlternativesDiffer:new Set(proof.dates.publications.map(d=>d.raw)).size>1,jobDescription:m.sanitizedComment||s.description||null,sourceDescription:m.sanitizedComment||s.description||null,sourceNativeRecord:m,sourceNativeListing:role.row,sourceNativeJobPosting:s,sourceNativeEmployer:{id:role.publisher.id,name:role.publisher.name,companyURL:ORIGIN+'/company/'+role.publisher.alias,ownWebsite:WEBSITE,identityBasis:'configured-native-company-declared-same-own-website-and-explicit-exact-long-company-alias'},sourceNativeCountryEvidence:proof.addresses,sourceNativeApplication:{...role.application,kind:'publisher-authored-same-native-role-profile-handoff',nativeRoleContextInURL:true,fullControlsQualified:false,backendActivationVerified:false,submitted:false},sourceDetailComplete:false,sourceDetailStatus:'partial',fullCriteriaRecovered:false,sourceDetailFailureKind:'all-known-public-listing-detail-and-schema-criteria-alternatives-retained-full-application-profile-controls-unqualified',sourceNativeClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,scrapedAt:at})
  }catch(error){held.push({nativeID:role.row._id,reason:error.message,nativeRole:role,closingRole:closed.get(role.row._id)??null})}}
  audit={...audit,observedRecordCount:opening.roles.length,observedVacancyCount:opening.roles.length,nativeObservedRecords:opening.roles.length,qualifiedIndiaRecords:jobs.length,heldRecords:held,fullPublicModelsClosingReconciled:true,opening,closing,companyPublicationModelsClosingQualified:true,applicationProfileContextClosingQualified:true,wholeProfileHTMLAndControlsClosingClaimed:false,backendApplicationActivationVerified:false}
  return finish(jobs.slice(0,maxJobs))
 }catch(error){io.check();if(error&&typeof error==='object'&&Object.isExtensible(error))error.sourceAudit={...audit,transport:io.stats()};throw error}finally{io.close()}
}
