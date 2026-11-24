import {isDeepStrictEqual} from 'node:util'
import {decodeHTML} from 'entities'
import {parse} from 'acorn'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {corporateProgramme} from './currentProgrammeData.js'
export const SOURCE='huntress',COMPANY='Huntress',EMPLOYER='Huntress Labs',CAREERS_URL='https://www.huntress.com/company/careers',PLATFORM='greenhouse',TOKEN='huntress',TITLE='Careers | Huntress',DECLARATION='https://job-boards.greenhouse.io/huntress',API='https://boards-api.greenhouse.io/v1/boards/huntress/jobs?content=true'
const ROLE_URL=id=>'https://job-boards.greenhouse.io/huntress/jobs/'+id
const fail=message=>firstPartyFailure(SOURCE,message,{failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim()
const own=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))
const unique=(rows,key)=>new Set(rows.map(r=>r[key])).size===rows.length
const walk=node=>!node||typeof node!=='object'?[]:[node,...Object.values(node).flatMap(v=>Array.isArray(v)?v.flatMap(walk):walk(v))]
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.name===object&&node.property?.name===property
const literal=(node,value)=>node?.type==='Literal'&&node.value===value
const countries={'United States of America':'United States','Remote US':'United States','Remote UK':'United Kingdom','Remote Ireland':'Ireland'}
const country=value=>countries[value]??nativeCountryName(value)
const ghKeys=['absolute_url','data_compliance','internal_job_id','location','metadata','id','updated_at','requisition_id','title','company_name','first_published','language','application_deadline','content','departments','offices','ai_disclaimer','include_ai_disclaimer','ai_opt_out_request_url']
const leverKeys=['additional','additionalPlain','applyUrl','categories','country','createdAt','description','descriptionBody','descriptionBodyPlain','descriptionPlain','hostedUrl','id','lists','opening','openingPlain','salaryDescription','salaryDescriptionPlain','salaryRange','text','workplaceType']

export function readCorporate(body){
 const doc=readNativeDocument(body),head=activeHead(body)
 need(!doc.nodes(n=>n.tag==='base').length&&head.titles.length===1&&head.titles[0]===TITLE,'Current own career identity/base changed')
 let contract
 if(PLATFORM==='greenhouse'){
  const nodes=SOURCE==='housecallpro'?doc.nodes(n=>n.tag==='script'&&n.attrs.src===DECLARATION):doc.nodes(n=>n.tag==='a'&&(()=>{try{const u=new URL(n.attrs.href);return u.origin==='https://job-boards.greenhouse.io'&&u.pathname==='/huntress'&&[...u.searchParams.keys()].every(k=>k==='hsCtaTracking')}catch{return false}})())
  need(nodes.length>0&&(SOURCE!=='housecallpro'||nodes.length===1),'Active own native recruitment tenant declaration missing/ambiguous')
  if(SOURCE==='housecallpro')need(doc.nodes(n=>n.attrs.id==='grnhse_app').length===1,'Current native board target missing/ambiguous')
  const other=doc.nodes(n=>(n.tag==='a'||n.tag==='script')&&(()=>{try{const u=new URL(n.attrs.href??n.attrs.src);return ['boards.greenhouse.io','job-boards.greenhouse.io','boards-api.greenhouse.io'].includes(u.hostname)&&((u.pathname.startsWith('/embed/job_board')&&u.searchParams.get('for')!==TOKEN)||(u.hostname==='job-boards.greenhouse.io'&&u.pathname.split('/')[1]!==TOKEN))}catch{return false}})())
  need(other.length===0,'Conflicting active native employer tenant declaration')
  contract={platform:PLATFORM,tenant:TOKEN,nativeRecruitmentDeclarations:nodes.map(n=>({tag:n.tag,href:n.attrs.href??null,src:n.attrs.src??null,text:n.tag==='a'?doc.text(n):null})),nativeAPI:API,protocol:'Existing public Greenhouse same-tenant Job Board API; current own active board declaration binds tenant; no tenant guessed'}
 }else{
  const candidates=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('api.lever.co/v0/postings/'))
  need(candidates.length===1,'One active current Lever consumer required')
  let ast;try{ast=parse(candidates[0].raw,{ecmaVersion:'latest'})}catch{throw fail('Current published Lever consumer is not parseable')}
  const nodes=walk(ast),init=nodes.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name==='initJobsApp')
  need(init.length===1&&init[0].async&&init[0].params.length===0,'Current public Lever initializer binding changed')
  const calls=walk(init[0]).filter(n=>n.type==='CallExpression'&&n.callee?.name==='fetch')
  need(calls.length===1&&calls[0].arguments.length===1&&literal(calls[0].arguments[0],DECLARATION),'Current public native fetch endpoint/method/options changed')
  const response=walk(init[0]).filter(n=>n.type==='VariableDeclarator'&&n.id?.name==='response'&&n.init?.type==='AwaitExpression'&&n.init.argument===calls[0])
  const data=walk(init[0]).filter(n=>n.type==='VariableDeclarator'&&n.id?.name==='data'&&n.init?.type==='AwaitExpression'&&n.init.argument?.type==='CallExpression'&&member(n.init.argument.callee,'response','json')&&n.init.argument.arguments.length===0)
  const scheduled=nodes.filter(n=>n.type==='CallExpression'&&member(n.callee,'Webflow','push')&&n.arguments.length===1&&n.arguments[0].name==='initJobsApp')
  need(response.length===1&&data.length===1&&scheduled.length===1&&!nodes.some(n=>n.type==='AssignmentExpression'&&n.left?.name==='initJobsApp'),'Published native response/JSON/public initializer consumer binding changed')
  need(nodes.some(n=>n.type==='VariableDeclarator'&&n.id?.name==='EMULATE_NO_JOBS'&&literal(n.init,false)),'Published native no-jobs emulation changed')
  need(doc.nodes(n=>n.attrs.id==='open-positions-list').length===1,'Published native role container missing/ambiguous')
  const intakes=doc.nodes(n=>n.tag==='a'&&/^https:\/\/jobs\.lever\.co\/immuta\//.test(n.attrs.href??''))
  need(intakes.length===1,'Current native intake declaration changed')
  contract={platform:PLATFORM,tenant:TOKEN,declaredGroupedAPI:DECLARATION,nativeAPI:API,protocol:'Existing public Lever same-tenant flat postings API; grouped department display query is retained separately, never relabelled company inventory',publicInitializer:'Webflow.push(initJobsApp)',responseConsumer:'await response.json()',nativeIntakeDeclarations:intakes.map(n=>({href:n.attrs.href,text:doc.text(n)})),intakeVisited:false}
 }
 return {title:head.titles[0],contract,wholeOriginalHTML:body,wholeObservedDOM:structuredClone(doc.nodes(()=>true))}
}
const authored=value=>{
 need(typeof value==='string','Missing full native authored criteria')
 const html=decodeHTML(value),doc=readNativeDocument(html)
 need(!doc.nodes(n=>['script','iframe','object','embed','base','form'].includes(n.tag)).length,'Unreviewed active carrier in authored native criteria')
 return {html,text:doc.nodes(n=>n.tag==='root').map(n=>doc.text(n)).join(' ')}
}
export function readNativeAPI(body){
 let payload;try{payload=parseEightfoldJson(body)}catch{throw fail('Malformed native API JSON')}
 const rows=PLATFORM==='greenhouse'?payload?.jobs:payload
 need(Array.isArray(rows)&&rows.length<=1000&&unique(rows,'id'),'Missing/duplicate/excessive native API inventory')
 if(PLATFORM==='greenhouse')need(own(payload,['jobs','meta'])&&own(payload.meta,['total'])&&payload.meta.total===rows.length,'Native API full inventory/count model changed')
 const models=rows.map(raw=>{
  const holds=[],id=raw.id
  let title,location,countryRaw,employer,applicationURL,roleURL,description,posted,closing,criterionFields
  if(PLATFORM==='greenhouse'){
   need(own(raw,ghKeys)&&Number.isSafeInteger(id)&&id>0&&typeof raw.title==='string'&&norm(raw.title),'Unreviewed native role schema/identity/authored fields')
   need(own(raw.location,['name'])&&typeof raw.location.name==='string','Native role workplace model changed')
   title=raw.title;location=raw.location.name;countryRaw=location;employer=raw.company_name;applicationURL=raw.absolute_url;roleURL=raw.absolute_url;posted=raw.first_published??null;closing=raw.application_deadline??null;criterionFields={content:raw.content}
   need(employer===EMPLOYER&&roleURL===ROLE_URL(id),'Native API employer/own application identity mismatch')
   const a=authored(raw.content);description=a.html;if(norm(a.text).length<100)holds.push('incomplete-authored-native-role-criteria')
   if(raw.metadata!==null||raw.ai_disclaimer!==null||raw.include_ai_disclaimer!==null||raw.ai_opt_out_request_url!==null)holds.push('new-native-metadata-or-application-criteria-needs-review')
  }else{
   need(own(raw,leverKeys)&&typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)&&typeof raw.text==='string'&&norm(raw.text),'Unreviewed native role schema/identity/authored fields')
   need(own(raw.categories,['allLocations','commitment','department','location','team'])&&typeof raw.categories.location==='string','Native role workplace/category model changed')
   title=raw.text;location=raw.categories.location;countryRaw=raw.country??null;employer=EMPLOYER;applicationURL=raw.applyUrl;roleURL=raw.hostedUrl;posted=null;closing=null
   need(roleURL===ROLE_URL(id)&&applicationURL===roleURL+'/apply','Native API own role/application identity mismatch')
   criterionFields=Object.fromEntries(['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain','salaryDescription','salaryDescriptionPlain'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]))
   need(Array.isArray(raw.lists)&&raw.lists.every(v=>own(v,['text','content'])&&typeof v.text==='string'&&typeof v.content==='string'),'Native complete authored criteria lists changed')
   const html=['opening','description','descriptionBody','additional','salaryDescription'].filter(k=>Object.hasOwn(raw,k)).map(k=>authored(raw[k]).html)
   const plain=['openingPlain','descriptionPlain','descriptionBodyPlain','additionalPlain','salaryDescriptionPlain'].filter(k=>Object.hasOwn(raw,k)).map(k=>{need(typeof raw[k]==='string','Native plain criteria model changed');return raw[k]})
   description=[...html,...raw.lists.map(v=>'<h3>'+v.text+'</h3>'+authored(v.content).html),...plain].join('\n')
   if(norm(authored(description).text).length<100)holds.push('incomplete-authored-native-role-criteria')
   criterionFields.lists=structuredClone(raw.lists);if(raw.salaryRange!=null)criterionFields.salaryRange=structuredClone(raw.salaryRange)
   if(!Number.isSafeInteger(raw.createdAt)||raw.createdAt<0)holds.push('invalid-native-createdAt');
  }
  const workCountry=country(countryRaw)
  if(!workCountry)holds.push('native-role-work-country-unqualified')
  if(PLATFORM==='greenhouse'&&Array.isArray(raw.offices))for(const office of raw.offices){const c=country(office.name)||nativeLocationCountryName(office.location);if(c&&workCountry&&c!==workCountry)holds.push('native-workplace-country-conflict')}
  if(PLATFORM==='lever'&&(!Array.isArray(raw.categories.allLocations)||raw.categories.allLocations.some(v=>v!==location)))holds.push('additional-native-workplaces-unqualified')
  if(posted!==null&&(typeof posted!=='string'||!Number.isFinite(Date.parse(posted))))holds.push('native-publication-date-unqualified')
  if(closing!==null&&(typeof closing!=='string'||!Number.isFinite(Date.parse(closing))))holds.push('native-closing-date-unqualified')
  return {jobId:id,requisitionId:PLATFORM==='greenhouse'?raw.requisition_id??null:null,title,location,country:workCountry,countryRaw,countryEvidence:PLATFORM==='greenhouse'?'native-role-location.name-explicit-written-country':'native-role-country-ISO',nativeEmployer:employer,nativeEmployerFieldPublished:PLATFORM==='greenhouse',nativeEmployerBinding:PLATFORM==='greenhouse'?'native-company_name-and-current-own-tenant':'current-own-career-Lever-tenant-and-exact-native-role-application-path',nativeApplicationURL:applicationURL,sourceURL:roleURL,activeApplyVerified:false,applicationVisited:false,postingDate:posted,closingDate:closing,nativeCreatedAt:PLATFORM==='lever'?raw.createdAt:null,sourceDescription:description,fullAuthoredCriteria:criterionFields,fullOwnRoleCriteriaQualified:!holds.includes('incomplete-authored-native-role-criteria'),sourceRoleQualified:holds.length===0,holds:[...new Set(holds)],wholeNativeRecord:structuredClone(raw)}
 })
 return {wholeNativePayload:payload,models,reportedNativeTotal:PLATFORM==='greenhouse'?payload.meta.total:null,observedVacancyCount:rows.length}
}
const semantic=c=>({title:c.title,contract:c.contract})
export async function run(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'Original current HTTP metadata via fetchImpl is required; body-only callbacks are not publisher authority')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[CAREERS_URL,'html'],[API,'json']]});let opening,closing,reconciled=false
 const audit=()=>({source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening?.native?.observedVacancyCount??0,observedVacancyCount:opening?.native?.observedVacancyCount??0,nativeScopedReportedTotal:opening?.native?.reportedNativeTotal??null,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,wholeNativeRoleModelsClosingReconciled:reconciled,wholeRawPublisherOpeningClosingEqual:!!closing&&isDeepStrictEqual(opening,closing),fullNativeAuthoredCriteriaRetained:true,nativePayload:opening?.native?structuredClone(opening.native.wholeNativePayload):undefined,nativePayloadOriginalResponseSHA256:opening?.nativeResponse?.sha256??null,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,nativeRequests:reader.stats().requests,ownRolePagesAcquired:false,ownRoleSchemaAcquired:false,applicationScreeningAcquired:false,legalRegistryIdentityVerified:false,applicationReads:0,applicationSubmissions:0,holds:['additional-employer-hiring-channels-and-whole-company-inventory-unknown']})
 // Keep the presentation parser public; runtime qualification also binds every
 // corporate authority byte under the existing reviewed comparison slots.
 const capture=async target=>{const corporate=await reader.read(CAREERS_URL);target.corporateResponse=corporate;target.corporate=readCorporate(corporate.body);target.corporateAuthority=corporateProgramme(corporate.body);const api=await reader.read(API);target.nativeResponse=api;target.native=readNativeAPI(api.body)}
 try{
  opening={};await capture(opening);closing={};await capture(closing)
  need(opening.corporateAuthority.canonicalSHA256===closing.corporateAuthority.canonicalSHA256&&isDeepStrictEqual(semantic(opening.corporate),semantic(closing.corporate))&&isDeepStrictEqual(opening.native,closing.native),'Full native employer/role/criteria/country/application/closing models changed');reconciled=true
  const jobs=opening.native.models.filter(m=>m.sourceRoleQualified&&m.country==='India').map(m=>({id:m.jobId,jobId:m.jobId,requisitionId:m.requisitionId,title:m.title,source:SOURCE,company:COMPANY,location:m.location,country:m.country,sourceUrl:m.sourceURL,applyUrl:m.nativeApplicationURL,link:m.nativeApplicationURL,jobDescription:m.sourceDescription,sourceDescription:m.sourceDescription,postingDate:m.postingDate,closingDate:m.closingDate,activeApplyVerified:false,applicationVisited:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeFacts:m}))
  const evidence=audit();need(Buffer.byteLength(JSON.stringify(evidence))<=24*1024*1024,'Native audit byte budget exceeded')
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.native.observedVacancyCount,observedVacancyCount:opening.native.observedVacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:API,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:4,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'paired-full-current-native-API-cohort;whole-company-inventory-unknown;no-company-zero-or-cleanup'})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true});Object.defineProperty(jobs,'recruitmentObservations',{value:evidence,configurable:true});reader.check();options.signal?.throwIfAborted();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:audit(),configurable:true})}catch{};options.signal?.throwIfAborted();throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
