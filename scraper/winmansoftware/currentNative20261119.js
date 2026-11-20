import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readJobPosting} from '../../scraper-support/native-sources/jobPostingData.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {extractCurrentListings,extractCurrentFresherDetail} from './script.js'
import {WINMAN_SOFTWARE_CATALOG as catalog} from './catalog.js'
import {createCurrentReader} from './currentRead20261119.js'

const SOURCE='winmansoftware',EMPLOYER='Winman Software India LLP',CAREERS=catalog.companyCareerPage,APPLY=catalog.applyUrl
const fail=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw fail(message)}
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const cls=(node,value)=>(node.attrs.class??'').split(/\s+/).includes(value)
const walk=node=>typeof node==='string'?[]:[node,...node.children.flatMap(walk)]
const model=node=>typeof node==='string'?node:{tag:node.tag,attrs:{...node.attrs},...(node.raw!==undefined?{raw:node.raw}:{}),children:node.children.map(model)}
const one=(nodes,label)=>{need(nodes.length===1,'missing or ambiguous '+label);return nodes[0]}
const programs=[
 {declared:'Scripts/detect-browser.js',url:'https://winman.in/jobs/Scripts/detect-browser.js',sha256:'585cba837fbf342a014e46e2637e9ce1e08cfbb613a003aaa8f163e8c546a046'},
 {declared:'Scripts/ResumeVariables.js',url:'https://winman.in/jobs/Scripts/ResumeVariables.js',sha256:'00eb018183ef4e03ba4292a9c2a87edf7db82513f9a5bfdaa8914e21b4a430e7'},
 {declared:'Scripts/Script.js',url:'https://winman.in/jobs/Scripts/Script.js',sha256:'a65618b48049414fcb7a4dbd6f263a94bbc3c2bc5f0ed514a2346e254e05c3a8'},
]
const references=['https://dk.nic.in/en/collectorate/','https://www.kscst.org.in/nrdms_files/dnrdms_files/NRDMS_Annual_Report_2025_26/02_NRDMS_Dakshina_Kannada_Annual_Report_2025-2026.pdf']
const allowed=(value,kind)=>{
 try{const url=new URL(value);if(url.href!==value||url.username||url.password||url.hash||url.search)return false
  if(kind==='javascript')return programs.some(program=>program.url===value)
  return kind==='html'&&(value===APPLY||url.origin==='https://www.winmansoftware.com'&&(value===CAREERS||/^\/more\/careers\/[a-z0-9-]+\/?$/.test(url.pathname)))
 }catch{return false}
}

function inspectRole(html,listing,finalURL,observedAt){
 const d=readVisibleNativeDocument(html,{strict:true}),container=one(d.nodes(n=>cls(n,'job-container')&&!n.inert),'own role container'),nodes=walk(container)
 const header=one(nodes.filter(n=>cls(n,'job-header')&&!n.inert),'own role header'),head=walk(header)
 const title=one(head.filter(n=>n.tag==='h1'&&cls(n,'job-title')&&!n.inert),'own role title')
 need(d.text(title)===listing.title,'own role title contradicts current native listing')
 need(head.filter(n=>cls(n,'job-info')&&!n.inert&&d.text(n)===EMPLOYER).length===1,'own employer header contradicts source binding')
 const locations=head.filter(n=>cls(n,'job-info')&&!n.inert&&walk(n).filter(child=>child.tag==='img'&&child.attrs.src==='../../../images/JobDescription-location.png'&&child.attrs.alt==='location-icon').length===1)
 const workplace=d.text(one(locations,'whole own role workplace'))
 need(workplace==='Mangalore','whole native workplace has unqualified alternatives')
 const applications=nodes.filter(n=>n.tag==='a'&&!n.inert&&/^apply\s+now$/i.test(d.text(n)))
 need(applications.length>0&&applications.every(n=>n.attrs.href===APPLY&&!Object.hasOwn(n.attrs,'download')),'authored role application handoff is missing or changed')
 const parent=new Map();for(const node of walk(d.nodes(n=>n.tag==='root')[0]))for(const child of node.children)if(typeof child!=='string')parent.set(child,node)
 for(const anchor of applications){
  for(let owner=anchor;owner;owner=parent.get(owner))need(!Object.keys(owner.attrs).some(key=>/^on/i.test(key)),'authored role application can be intercepted')
  need(walk(anchor).every(n=>!Object.keys(n.attrs).some(key=>/^on/i.test(key))),'authored role application descendants can intercept the link')
 }
 const text=d.text(container)
 need(!/\b(?:this\s+(?:job|role|position)\s+(?:(?:is|was|has been)\s+)?(?:now\s+)?(?:closed|filled|expired)|no longer accepting applications|applications are closed|(?:our|the) client is (?:hiring|seeking|looking))\b/i.test(text),'native role is closed or belongs to a separate client employer')
 for(const node of nodes.filter(n=>['p','li','h2','h3','h4'].includes(n.tag))){
  const line=d.text(node),country=/^(?:(?:work|job|workplace)\s+)?country\s*:\s*(.+)$/i.exec(line),employer=/^(?:employer|hiring company)\s*:\s*(.+)$/i.exec(line)
  if(country)need(/^(?:India|IN|IND)$/.test(country[1]),'explicit native work country conflicts')
  if(employer)need(employer[1]===EMPLOYER,'explicit native hiring employer conflicts')
 }
 const structured=readJobPosting(html,{rawControls:true})
 need(!structured.errors.length&&structured.candidates.length<=1,'native structured role identity cannot be read uniquely')
 const structuredModels=[]
 for(const entry of structured.candidates){
  const value=entry.model,places=Array.isArray(value.jobLocation)?value.jobLocation:[value.jobLocation]
  need(value.title===listing.title&&value.hiringOrganization?.name===EMPLOYER,'native structured title or employer conflicts')
  need(places.length>0&&places.every(place=>place?.address?.addressCountry==='India'&&place.address.addressLocality==='Mangalore'&&place.address.addressRegion==='Karnataka'),'native structured work country or whole workplace conflicts')
  need(!Object.hasOwn(value,'applicantLocationRequirements')&&!Object.hasOwn(value,'jobLocationType'),'new structured remote or applicant geography needs review')
  for(const key of ['url','mainEntityOfPage'])if(Object.hasOwn(value,key))need([listing.detailUrl,finalURL].includes(value[key]),'native structured role URL conflicts')
  if(Object.hasOwn(value,'validThrough'))need(typeof value.validThrough==='string'&&Number.isFinite(Date.parse(value.validThrough))&&Date.parse(value.validThrough)>Date.parse(observedAt),'native structured expiry is invalid or elapsed')
  need(entry.syntax.rawControlCharacters.every(item=>[9,10,13].includes(item.codePoint)),'unsupported raw structured control syntax')
  structuredModels.push({original:entry.raw,model:structuredClone(value),syntax:structuredClone(entry.syntax)})
 }
 let criteria=null,criteriaIssue=null
 try{criteria=extractCurrentFresherDetail(html,listing)}catch(error){criteriaIssue=error.message}
 const visibleBodies=nodes.filter(n=>cls(n,'job-body')&&!n.inert)
 const partialVisibleCriteria=visibleBodies.length===1?{text:d.text(visibleBodies[0])||null,model:model(visibleBodies[0]),fullCriteriaRecovered:false}:null
 const fullCriteriaRecovered=criteria?.nativeCriteriaComplete===true&&structuredModels.length===0
 return {title:listing.title,workplace,employerLiteral:EMPLOYER,criteria,partialVisibleCriteria,criteriaIssue,structuredModels,fullCriteriaRecovered,
  criteriaAlternativesUnreconciled:structuredModels.length>0,wholeRoleContainer:model(container),application:{authoredRoleHandoffQualified:true,rolePreselected:false,authoredLinks:applications.map(n=>({attrs:{...n.attrs},text:d.text(n)})),url:APPLY,backendActivationVerified:false}}
}

function applicationModel(html){
 const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'public application document'),form=one(d.nodes(n=>n.tag==='form'),'public application form')
 need(d.nodes(n=>n.tag==='title').length===1&&/Winman Software Job Application/.test(d.nodes(n=>n.tag==='title')[0].raw??''),'public application publisher changed')
 need(form.attrs.name==='form1'&&form.attrs.id==='form1'&&form.attrs.method==='post'&&new URL(form.attrs.action,APPLY).href===APPLY,'public application method or action changed')
 const local=d.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>({declared:n.attrs.src,url:new URL(n.attrs.src,APPLY).href})).filter(p=>new URL(p.url).origin==='https://winman.in')
 need(same(local,programs.map(({declared,url})=>({declared,url}))),'whole declared own application programs changed')
 const state={formDataGUID:form.attrs['data-guid'],fields:[]}
 need(typeof state.formDataGUID==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(state.formDataGUID),'opaque own application request-state shape changed')
 for(const name of ['__VIEWSTATE','__EVENTVALIDATION']){
  const node=one(d.nodes(n=>n.tag==='input'&&n.attrs.name===name),'opaque '+name)
  need(node.attrs.type==='hidden'&&typeof node.attrs.value==='string'&&/^[A-Za-z\d+/]+={0,2}$/.test(node.attrs.value),'opaque application request-state carrier changed')
  state.fields.push({name,value:node.attrs.value})
 }
 const stableModel=node=>{
  if(typeof node==='string')return node
  const attrs={...node.attrs}
  if(node===form)attrs['data-guid']={opaquePerRequestState:true}
  if(node.tag==='input'&&['__VIEWSTATE','__EVENTVALIDATION'].includes(attrs.name))attrs.value={opaquePerRequestState:true}
  return{tag:node.tag,attrs,...(node.raw!==undefined?{raw:node.raw}:{}),children:node.children.map(stableModel)}
 }
 return{publicModel:stableModel(root),opaquePerRequestState:state,originalHTML:html,fullOriginalBytesClosingQualified:false,backendActivationVerified:false,submissionPerformed:false}
}

export async function runCurrentWinman(options={}){
 options.signal?.throwIfAborted()
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid output cap')
 const io=createCurrentReader(options,allowed),held=[],openingModels=[],closingModels=[]
 const readRole=async(listing,phase)=>{
  const first=await io.read(listing.detailUrl,{phase,allowRedirect:true}),chain=[{url:first.url,status:first.status,sha256:first.sha256,location:first.headers.location??null}]
  let final=first
  if(first.status===301){need(first.headers.location===listing.detailUrl+'/','native role redirect Location is not the declared same-role slash route');final=await io.read(first.headers.location,{phase:phase+'-declared-location'});chain.push({url:final.url,status:final.status,sha256:final.sha256,location:final.headers.location??null})}
  return{listing:structuredClone(listing),chain,html:final.text,sha256:final.sha256,finalURL:final.url,model:inspectRole(final.text,listing,final.url,observedAt)}
 }
 const readPrograms=async phase=>{const result=[];for(const program of programs){const page=await io.read(program.url,{kind:'javascript',phase});need(page.sha256===program.sha256,'whole reviewed own application program changed');result.push({url:program.url,sha256:page.sha256,original:page.text})}return result}
 try{
  const page=await io.read(CAREERS,{phase:'opening-careers'}),listing=extractCurrentListings(page.text)
  for(const row of listing.experienced)held.push({title:row.title,originalNativeRow:row,reason:'no native role-owned workplace;corporate-address-and-applicant-city-controls-are-not-workplace-proof'})
  for(const row of listing.freshers){try{openingModels.push(await readRole(row,'opening-role'))}catch(error){io.check();held.push({title:row.title,sourceUrl:row.detailUrl,reason:error.message})}}
  const applicationOpening=applicationModel((await io.read(APPLY,{phase:'opening-application'})).text),programsOpening=await readPrograms('opening-application-program')
  const qualified=[]
  for(const opening of openingModels){
   try{
    const closing=await readRole(opening.listing,'closing-role');closingModels.push(closing)
    need(same(opening,closing),'whole native role/criteria/workplace/application changed at closing')
    const role=opening.model,criteria=role.criteria
    qualified.push({source:SOURCE,company:catalog.companyName,title:role.title,jobId:opening.finalURL,requisitionId:null,sourceUrl:opening.finalURL,applyUrl:APPLY,link:APPLY,
     nativeEmployerLiteral:role.employerLiteral,nativeLegalEmployer:null,country:'India',countryCode:'IN',city:role.workplace,state:'Karnataka',location:role.workplace+', Karnataka, India',locations:[role.workplace+', Karnataka, India'],
     sourceCountryEvidence:{kind:'reviewed-exact-whole-native-role-workplace',nativeWholeLabel:role.workplace,references},nativeGeographyQualified:true,sourceCountryScopeUnresolved:false,
     postingDate:null,closingDate:null,remoteStatus:null,employmentType:null,department:null,experienceRequired:null,minimumQualification:criteria?.qualification??null,preferredQualification:null,requiredSkills:[],
     jobDescription:criteria?.description??role.partialVisibleCriteria?.text??null,sourceDescription:criteria?.description??role.partialVisibleCriteria?.text??null,sourceNativeCriteriaModel:criteria?.nativeCriteriaModel??role.partialVisibleCriteria?.model??null,sourceNativeMinimumMarksThroughout:criteria?.nativeMinimumMarksThroughout??null,
     fullCriteriaRecovered:role.fullCriteriaRecovered,sourceDetailComplete:role.fullCriteriaRecovered,sourceCriteriaAlternativesUnreconciled:role.criteriaAlternativesUnreconciled,sourceCriteriaIssue:role.criteriaIssue,
     sourceNativeStructuredModels:role.structuredModels,sourceNativeApplication:role.application,backendApplicationActivationVerified:false,applicationSubmitted:false,
     sourceNativeOpeningRoleHTML:opening.html,sourceNativeClosingRoleHTML:closing.html,sourceNativeOpeningRoleModel:opening.model,sourceNativeClosingRoleModel:closing.model,sourceNativeRedirectChain:opening.chain,
     sourceClosingReconciled:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,companyCareerPage:CAREERS,companyDomain:catalog.companyDomain,atsPlatform:catalog.atsPlatform,scrapedAt:observedAt})
   }catch(error){io.check();held.push({title:opening.listing.title,sourceUrl:opening.finalURL,reason:error.message,openingModel:opening})}
  }
  const end=await io.read(CAREERS,{phase:'closing-careers'}),closingListing=extractCurrentListings(end.text)
  need(page.sha256===end.sha256&&same(listing,closingListing),'whole native careers listing changed at closing')
  const applicationClosing=applicationModel((await io.read(APPLY,{phase:'closing-application'})).text),programsClosing=await readPrograms('closing-application-program')
  need(same(applicationOpening.publicModel,applicationClosing.publicModel)&&same(programsOpening,programsClosing),'whole public application form/control/inline-program or own program model changed at closing')
  const jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const audit={source:SOURCE,recordKind:'vacancy-rows',nativeObservedRecords:listing.freshers.length+listing.experienced.length,qualifiedIndiaRecords:qualified.length,fullCriteriaRecords:qualified.filter(job=>job.fullCriteriaRecovered).length,partialCriteriaRecords:qualified.filter(job=>!job.fullCriteriaRecovered).length,heldRecords:held,
   openingListing:listing,closingListing,openingCareersHTML:page.text,closingCareersHTML:end.text,openingModels,closingModels,applicationOpening,applicationClosing,programsOpening,programsClosing,
   publicApplicationModelClosingReconciled:true,rawApplicationModelClosingReconciled:applicationOpening.originalHTML===applicationClosing.originalHTML,opaqueApplicationRequestStateRetained:true,opaqueApplicationBackendUnverified:true,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,applicationInteractions:0,reader:io.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeObservedRecords,observedVacancyCount:audit.nativeObservedRecords,sourceScopeComplete:false})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.reader.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-own-role-identity-workplace-and-authored-application-qualified;whole-role-and-careers-closing-reconciled;criteria-alternatives-and-company-scope-explicitly-held'})
  await options.onAudit?.(structuredClone(audit));io.check();return jobs
 }catch(error){io.check();try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,heldRecords:held,openingModels,closingModels,reader:io.stats(),lifecycleCleanupAllowed:false},enumerable:true})}catch{/* Preserve frozen caller reasons. */}throw error}
 finally{io.close()}
}
