import {isDeepStrictEqual} from 'node:util'
import {PROFILE,PROGRAMS,need,corporateDeclaration,publicRedirect,boardDeclaration,requireConfiguration,requireDependency,program,nativeEndpoints,companyIdentity,listingPage,roleModel} from './profile20261110.js'
import {createHdfcTransport,abortable} from './transport20261110.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createRecruitmentObservationAccounting,isRecruitmentIntakeTitle} from '../../scraper-support/utils/recruitmentObservationAccounting.js'

export const createHdfcBankScraper=()=>({async run(options={}){
 options.signal?.throwIfAborted()
 for(const[name,max,fallback]of [['maxDetails',20,20],['maxPages',2,2],['detailConcurrency',2,2],['auditTimeoutMs',15000,15000]]){
  const value=options[name]??fallback;need(Number.isSafeInteger(value)&&value>0&&value<=max,'invalid '+name)
 }
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid maxJobs')
 need(options.now===undefined||typeof options.now==='function','invalid observation clock')
 need(options.onAudit===undefined||typeof options.onAudit==='function','invalid audit observer')
 const observedAt=(options.now||(()=>new Date().toISOString()))()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const grants=new Set(),control=createHdfcTransport(options,(url,method,body)=>grants.has(JSON.stringify([url,method,body])))
 const maxDetails=options.maxDetails??20,maxPages=options.maxPages??2,concurrency=options.detailConcurrency??2
 const observations=new Map(),accounting=createRecruitmentObservationAccounting(PROFILE.source)
 let phase='opening',openingChain=null,closingChain=null,company=null,reportedTotal=null,selectedPages=0,listingStable=false
 const read=async(url,kind='html',method='GET',body=null,expectedStatus=200)=>{
  control.check();grants.add(JSON.stringify([url,method,body]));return control.read(url,{kind,method,body,expectedStatus,phase})
 }
 const json=async(url,method='GET',body=null)=>{
  const packet=await read(url,'json',method,body);let value
  try{value=JSON.parse(packet.body)}catch{need(false,'malformed public native JSON')}
  need(value&&typeof value==='object'&&!Array.isArray(value),'native JSON envelope missing');return value
 }
 const chain=async()=>{
  const corporate=await read(PROFILE.corporate),declaration=corporateDeclaration(corporate)
  const entry=await read(PROFILE.entry,'html','GET',null,302),binding=publicRedirect(entry)
  const board=await read(binding.boardURL),mainURL=boardDeclaration(board,binding),main=await read(mainURL,'js')
  const configuration=requireConfiguration(main.body)
  return{binding,configuration,mainBody:main.body,declaration,mainURL,
   evidence:{corporateURL:corporate.finalURL,corporateSHA256:corporate.bodySHA256,entryURL:entry.finalURL,entrySHA256:entry.bodySHA256,
    declaredRedirectURL:binding.declaredURL,actualBoardURL:board.finalURL,boardSHA256:board.bodySHA256,mainURL:main.finalURL,mainSHA256:main.bodySHA256}}
 }
 const get=async(endpoint,params)=>{const url=new URL(endpoint,openingChain.binding.boardURL);url.search=new URLSearchParams(params).toString();return json(url.href)}
 const params=()=>({token:openingChain.binding.token,source:'CAREERSITE',lang:'en'})
 const collect=async(expectedPages=null)=>{
  const pages=[]
  for(let page=0;page<(expectedPages??maxPages);page++){
   const body=new URLSearchParams({careerSiteUrlParams:JSON.stringify({page,search:'*:*',token:openingChain.binding.token,source:'CAREERSITE',pagesize:10}),lang:'en'}).toString()
   const value=listingPage(await json(new URL('candidatejobsearch',openingChain.binding.boardURL).href,'POST',body),page,reportedTotal)
   if(reportedTotal===null)reportedTotal=value.totalJobCount
   pages.push(value)
   if(phase==='opening')for(const row of value.jobVoList){
    need(!observations.has(row.jobSeq),'duplicate selected native role')
    observations.set(row.jobSeq,{nativeId:row.jobSeq,listing:structuredClone(row),openingNative:null,closingNative:null,country:null,paired:false,issues:['native-details-not-read']})
    accounting.observe({scope:'ripplehire:'+PROFILE.origin+':'+PROFILE.companyId,id:row.jobSeq,title:row.jobTitle,
     url:openingChain.binding.boardURL+'#detail/job/'+row.jobSeq})
   }
   if(expectedPages===null&&(pages.flatMap(p=>p.jobVoList).length>=maxDetails||(page+1)*10>=value.totalJobCount))break
  }
  return pages
 }
 const details=async()=>{
  const rows=[...observations.values()].slice(0,maxDetails);let cursor=0
  await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},async()=>{
   while(cursor<rows.length){
    control.check();const record=rows[cursor++],native=await get('candidatejobdetail',{token:openingChain.binding.token,jobSeq:record.nativeId,source:'CAREERSITE',lang:'en'})
    const proof=roleModel(native,record.listing,observedAt);control.check()
    if(phase==='opening'){record.openingNative=native;record.country=proof.country;record.typedCountries=proof.typedCountries;record.issues=proof.issues;record.proof=proof.workplaceProof;record.posted=proof.posted;record.closing=proof.closing;record.fullCriteriaComplete=proof.fullCriteriaComplete}
    else{record.closingNative=native;need(isDeepStrictEqual(record.openingNative,native),'own complete native model changed at closing');record.paired=true}
   }
  }))
 }
 const snapshot=()=>({source:PROFILE.source,observedAt,observedRecordCount:observations.size,reportedNativeQueryTotal:reportedTotal,
  selectedPages,selectedDetailCap:maxDetails,selectedSliceReconciled:listingStable&&[...observations.values()].filter(r=>r.openingNative).every(r=>r.paired),
  unknownCountryCount:[...observations.values()].filter(r=>r.country===null).length,
  observations:structuredClone([...observations.values()]),opening:openingChain?structuredClone(openingChain.evidence):null,
  closing:closingChain?structuredClone(closingChain.evidence):null,company:company?{companyId:company.companyMstrSeq,companyName:company.companyName,companyCode:company.companyCd,domainName:company.domainName}:null,
  originalPages:structuredClone(control.receipts),requestMetrics:control.metrics(),companyGlobalTotal:null,companyIndiaTotal:null,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,queryEnumerationComplete:false,
  qualification:'Bounded current published native slice only; numeric country IDs, full company inventory, live vacancies, applications and cleanup unverified.'})
 const finish=async jobs=>{
  const audit=snapshot()
  if(options.onAudit)await abortable(()=>options.onAudit(structuredClone(audit),{signal:control.signal}),AbortSignal.any([control.signal,AbortSignal.timeout(options.auditTimeoutMs??15000)]))
  control.check();accounting.attach(jobs)
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PROFILE.corporate,firstParty:control.receipts.some(p=>p.status===200),listingComplete:false,
   pagesFetched:control.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-HDFC-native-selected-slice;full-company-and-remaining-native-country-scope-unverified;cleanup-forbidden'})
  control.stop();return jobs
 }
 try{
  if(options.maxJobs===0)return await finish([])
  openingChain=await chain();const bodies=new Map([['main',openingChain.mainBody]])
  const dependencies=[['main','app'],['app','candidates_app'],['candidates_app','apps/candidates/controller/candidatejoblist_controller'],
   ['candidates_app','apps/candidates/controller/candidatejobdesc_controller'],['apps/candidates/controller/candidatejoblist_controller','entities/job'],
   ['apps/candidates/controller/candidatejobdesc_controller','entities/company']]
  for(const[parent,name]of dependencies){
   requireDependency(bodies.get(parent),parent,name)
   const url=new URL(openingChain.configuration.baseUrl+'/'+name+'.js',openingChain.binding.boardURL);url.search=openingChain.configuration.urlArgs
   const packet=await read(url.href,'js');program(packet.body,name);bodies.set(name,packet.body)
  }
  need(bodies.size===PROGRAMS.length,'incomplete current native program chain')
  const endpoints=nativeEndpoints(bodies.get('entities/job'),bodies.get('entities/company'))
  need(endpoints.listing==='candidatejobsearch'&&endpoints.detail==='candidatejobdetail','native public query changed')
  const language=await get('getcompanylang',{token:openingChain.binding.token,source:'CAREERSITE'})
  need(language.companyDefaultLang==='en','native default language changed')
  company=await get(endpoints.company,params());companyIdentity(company)
  const opening=await collect();selectedPages=opening.length
  await details();phase='closing'
  const closing=await collect(selectedPages)
  need(isDeepStrictEqual(opening,closing),'selected native listing snapshot changed');listingStable=true
  await details();closingChain=await chain()
  need(isDeepStrictEqual(openingChain.binding,closingChain.binding)&&isDeepStrictEqual(openingChain.configuration,closingChain.configuration),'current corporate/native account handoff changed')
  companyIdentity(await get(endpoints.company,params()));control.check()
  const jobs=[...observations.values()].filter(record=>record.paired&&record.country==='India'&&record.issues.length===0&&!isRecruitmentIntakeTitle(record.listing.jobTitle)).map(record=>{
   const native=record.openingNative,row=native.jobVO
   return{source:PROFILE.source,company:PROFILE.company,jobId:record.nativeId,title:row.jobTitle,requisitionId:row.jobCode,
    sourceUrl:openingChain.binding.boardURL+'#detail/job/'+record.nativeId,link:openingChain.binding.boardURL+'#detail/job/'+record.nativeId,
    applyUrl:openingChain.binding.boardURL+'#apply/job/'+record.nativeId,activeApplyVerified:false,applicationVisited:false,
    country:'India',location:row.locations||row.jobLocation||'India',city:null,sourceDescription:row.jobDesc,jobDescription:row.jobDesc,sourceDescriptionHtml:row.jobDesc,
    postingDate:record.posted,postedAt:record.posted,closingDate:record.closing,employmentType:row.jobTypeCustom3||null,
    nativeHiringOrganization:{name:PROFILE.company},nativeLegalEmployer:null,nativeEmployerBinding:{method:'current-corporate-delegation-and-own-native-company',
     companyId:PROFILE.companyId,companyCode:PROFILE.companyCode,nativeCompanyName:PROFILE.company,legalEmployer:null},
    nativeCountryRelation:record.proof,rawNativeCountryId:row.countryMstNewSeq??null,nativeCountryIdMapping:null,rawListingCountry:record.listing.jobLocation,
    rawDetailWorkplace:row.jobLocation,nativeSourceRecord:structuredClone(native),nativeSourceListingRecord:structuredClone(record.listing),
    nativeClosingSourceRecord:structuredClone(record.closingNative),sourceOfficialBinding:{...openingChain.evidence,closing:closingChain.evidence,currentHandoffRechecked:true},
    sourceNativeModelPairQualified:true,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:observedAt}
  })
  return await finish(options.maxJobs==null?jobs:jobs.slice(0,options.maxJobs))
 }catch(error){
  control.stop(error)
  const audit=snapshot()
  if(error&&typeof error==='object')try{Object.defineProperty(error,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}
  throw error
 }
}})
