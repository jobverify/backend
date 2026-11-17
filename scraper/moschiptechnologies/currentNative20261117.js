import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='moschiptechnologies',COMPANY='MosChip Technologies',HOME='https://moschip.com/',CAREERS=HOME+'careers/',OPENINGS=CAREERS+'current-openings/'
const TENANT='https://moschip.keka.com/careers/',TOKEN='5a91f0e1-2508-41a4-bfbc-849b6299d25e'
const EMBED=TENANT+'api/embedjobs/js/'+TOKEN,INFO=TENANT+'api/organization/default/careerportalinfo',GROUP=TENANT+'api/embedjobs/grouplinkstatus/'+TOKEN,DEPARTMENTS=TENANT+'api/embedjobs/departments/'+TOKEN,ACTIVE=TENANT+'api/embedjobs/default/active/'+TOKEN
const APP='https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'
const ROLE_SCRIPTS=['jquery.min.js','modernizr-2.6.2.js','jquery.ui.widget.js','jquery.fileupload.js','datepicker.js','select2.min.js','jquery.validate.min.js'].map(name=>'https://cdn.keka.com/careers/v/2026/scripts/lib/'+name).concat(APP)
const EMBED_SHA='176878893ddcd1a0dabb3b84d1c8a98bde7c16c6ace1af2871db06c741fa022b',APP_SHA='e2585ba1c4a259792330b7524042e3376994836454234a6da414eb1eeaaf315f'
const CONFIG="window.khConfig = { identifier: '5a91f0e1-2508-41a4-bfbc-849b6299d25e',domain: 'https://moschip.keka.com/careers/',targetContainer: '#khembedjobs'}"
const rowKeys=['id','title','description','departmentIdentifier','departmentName','excerpt','jobLocations','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames'].sort()
const fail=(message,fields)=>{throw firstPartyFailure(SOURCE,message,fields)}
const need=(ok,message,fields)=>{if(!ok)fail(message,fields)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const clone=value=>structuredClone(value)
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const clean=value=>typeof value==='string'&&value.trim().length>0
const literal=body=>{try{return readLiteralModel(body).value}catch(error){fail('Invalid or duplicate native literal model: '+error.message)}}
const rootText=html=>{const doc=readNativeDocument(html);return doc.nodes(node=>node.tag==='root').map(node=>doc.text(node)).join(' ')}
export function parseNativeInventory(body){
 const rows=literal(body)
 need(Array.isArray(rows)&&rows.length<=2000,'Native active cohort is not a bounded array')
 for(const row of rows){
  need(object(row)&&Number.isSafeInteger(row.id)&&row.id>0&&row.id<10000000000&&clean(row.title)&&typeof row.description==='string'&&Array.isArray(row.jobLocations)&&row.jobLocations.length<=30,'Malformed native active vacancy identity/model')
  for(const location of row.jobLocations){
   need(object(location)&&clean(location.name??location.city),'Invalid native vacancy location label')
   const isIndiaName=location.countryName==='India',isIndiaCode=location.countryCode==='IN'
   need(!(isIndiaName&&location.countryCode!=null&&!isIndiaCode)&&!(isIndiaCode&&location.countryName!=null&&!isIndiaName),'Native country name/code conflict')
  }
 }
 need(new Set(rows.map(row=>row.id)).size===rows.length,'Duplicate native vacancy ID')
 return rows
}
const isIndia=row=>row.jobLocations.length>0&&row.jobLocations.every(location=>location.countryName==='India'&&location.countryCode==='IN')
const nonIndia=row=>row.jobLocations.length>0&&row.jobLocations.every(location=>clean(location.countryName)&&clean(location.countryCode)&&location.countryName!=='India'&&location.countryCode!=='IN')
const detailURL=id=>TENANT+'jobdetails/'+id,applyURL=id=>TENANT+'applyjob/'+id,formURL=id=>TENANT+id+'/2/applicationform'
const retained=node=>typeof node==='string'?[]:[node,...node.children.flatMap(retained)]
const one=(rows,label)=>{need(rows.length===1,'Expected exactly one native '+label);return rows[0]}
function roleModel(html,row,application=false){
 const doc=readNativeDocument(html),head=activeHead(html),base=doc.nodes(node=>node.tag==='base')
 need(same(head.titles,[row.title])&&same(doc.nodes(node=>node.tag==='h1').map(node=>doc.text(node)),application?[row.title,'Apply for this job']:[row.title]),'Own native role title/identity disagrees')
 need(one(doc.nodes(node=>node.tag==='meta'&&node.attrs.name==='description'),'whole native criteria metadata').attrs.content===row.excerpt,'Whole native description/full criteria metadata disagree')
 need(base.length===1&&base[0].attrs.href==='/careers/'&&base[0].attrs.id==='baseHref','Unreviewed own native role base authority')
 need(same(retained(one(doc.nodes(node=>node.tag==='root'),'role document')).filter(node=>node.tag==='script').map(node=>node.attrs),ROLE_SCRIPTS.map(src=>({src}))),'Unreviewed own native role program declarations')
 const homeLinks=doc.nodes(node=>node.tag==='a'&&doc.text(node)==='Home')
 // The current native application template publishes a broken Home href.
 // Retain it as a publisher defect, never as employer/link authority. The
 // independently bound HTTPS tenant, portal identity, source token, own role
 // URL/client rule and matching role banner establish this application owner.
 need(homeLinks.length===1&&homeLinks[0].attrs.href===(application?'http://https://moschip.com':'https://moschip.com'),'Current native role employer anchor changed')
 if(application)need(doc.nodes(node=>node.attrs['data-storage']==='/ats/documents/'+TOKEN).length===1,'Missing exact independently bound native tenant application token')
 const banner=one(doc.nodes(node=>(node.attrs.class??'').split(' ').includes('banner')),'role banner')
 const experienceIcon=one(doc.nodes(node=>node.tag==='span'&&(node.attrs.class??'').split(' ').includes('ki-user-tie'),banner),'native experience icon')
 const experienceOwner=one(retained(banner).filter(node=>node.children.includes(experienceIcon)),'native experience owner'),nativeExperienceLabel=doc.text(experienceOwner)
 need(nativeExperienceLabel===row.experience||/^\d+(?:\.\d+)?$/.test(row.experience)&&nativeExperienceLabel===row.experience+' Years','Own native experience value/unit disagrees')
 const expected=[row.title,nativeExperienceLabel,row.jobLocations.map(location=>location.name??location.city).join(', '),row.jobType===2?'Full-Time':row.jobType===1?'Part-Time':null].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
 need([1,2].includes(row.jobType)&&doc.text(banner)===expected,'Own native full title/location/experience/employment banner disagrees')
 if(application){
  const form=one(doc.nodes(node=>node.tag==='form'&&node.attrs.id==='jobApplicationForm'),'own application form')
  need(form.attrs.name==='jobApplicationForm'&&doc.nodes(node=>node.tag==='button'&&node.attrs.id==='jobApplicationSubmitButton'&&doc.text(node)==='Apply Now').length===1,'Missing own native role application entry')
  return {html,roleID:row.id,title:row.title,bannerText:expected,nativeExperienceLabel,formAttributes:clone(form.attrs),wholeApplicationText:doc.text(form),completeFormTree:clone(form),nativeHomeAnchor:homeLinks[0].attrs.href,malformedNativeHomeAnchorUsedAsAuthority:false}
 }
 const description=one(doc.nodes(node=>(node.attrs.class??'').split(' ').includes('job-description-container')),'whole role description')
 const tree=retained(description)
 need(tree.every(node=>!node.inert&&!['script','style','template','iframe','object','embed','noscript'].includes(node.tag)),'Unreviewed hidden/inert full criteria carrier')
 const text=rootText(row.description)
 need(text.length>=50&&doc.text(description)===text,'Whole native rendered description/full criteria disagree with current active record')
 const social=one(doc.nodes(node=>node.attrs.selectedjobid===String(row.id)&&node.attrs.selectedjobtitle===row.title),'own native selected role identity')
 need(doc.nodes(node=>node.tag==='button'&&node.attrs.id==='apply-job'&&doc.text(node)==='Apply for this job').length===1&&!Object.hasOwn(one(doc.nodes(node=>node.attrs.id==='apply-job'),'apply button').attrs,'disabled'),'Own native application entry unavailable')
 return {html,roleID:row.id,title:row.title,bannerText:expected,nativeExperienceLabel,fullDescriptionText:text,completeDescriptionTree:clone(description),selectedRoleAttributes:clone(social.attrs)}
}
function nativeForm(body){
 const rows=literal(body)
 need(Array.isArray(rows)&&rows.length>0&&rows.length<=100&&new Set(rows.map(row=>row.identifier)).size===rows.length,'Invalid whole native application field model')
 need(rows.every(row=>object(row)&&clean(row.fieldName)&&clean(row.identifier)&&Array.isArray(row.validators)&&Array.isArray(row.fieldOptions)&&[0,1,2].includes(row.requirementType)),'Unreviewed full native application field shape')
 return rows
}
export {roleModel as readCurrentMoschipRoleModel}
function applicationCriteria(fields){
 // Preserve publisher labels/options without projecting internal flags into
 // visible requirements. Full untouched DTOs remain available separately.
 return fields.map(field=>[field.fieldName,
  field.fieldOptions.length?'Options: '+field.fieldOptions.map(option=>option.value).join('; '):'',
  ...field.validators.filter(value=>typeof value==='string').map(value=>'Validation: '+value)
 ].filter(Boolean).join('\n')).join('\n\n')
}
export async function runCurrentMoschip(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid native source/read deadline')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(now)),'Invalid native observation clock')
 const aggregate=new AbortController(),timer=setTimeout(()=>aggregate.abort(new DOMException('MosChip native source deadline exceeded','TimeoutError')),sourceTimeoutMs),signal=options.signal?AbortSignal.any([options.signal,aggregate.signal]):aggregate.signal
 const originalResponses=[],observations=[],fetchImpl=options.fetchImpl??globalThis.fetch,boundIDs=new Set(),permitted=new Set([HOME,CAREERS,OPENINGS,EMBED,INFO,GROUP,DEPARTMENTS,ACTIVE,APP]);let nextStart=0,decodedBytes=0
 async function read(url){
  signal.throwIfAborted();need(originalResponses.length<258&&permitted.has(url),'Unbound or excessive native read')
  if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal});nextStart=performance.now()+500
  const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};originalResponses.push(receipt)
  const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,fetchImpl:(requested,init)=>fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'}),overflowError:firstPartyFailure(SOURCE,'Native original exceeds 16MiB bound')})
  signal.throwIfAborted();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
  Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:response.headers,bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyComplete:true,completedAt:new Date().toISOString()})
  need(decodedBytes<=24*1024*1024&&response.url===url,'Native original authority/aggregate byte bound changed')
  need(response.status===200,'Original native HTTP '+response.status,{status:response.status,requestUrl:url,failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':response.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
  const kind=url===EMBED||url===APP?'script':[INFO,GROUP,DEPARTMENTS,ACTIVE].includes(url)||/\/\d+\/2\/applicationform$/.test(url)?'json':'html'
  need((kind==='script'?/^(?:(?:text|application)\/(?:x-)?javascript|text\/js)(?:;|$)/i:kind==='json'?/^application\/json(?:;|$)/i:/^text\/html(?:;|$)/i).test(response.headers['content-type']??''),'Original native representation changed at '+url)
  return new TextDecoder('utf8',{fatal:true}).decode(bytes)
 }
 function corporate(html,url){
  const doc=readNativeDocument(html),canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
  need(canonical.length===1&&canonical[0].attrs.href===url&&activeHead(html).titles.length===1&&/MosChip/.test(activeHead(html).titles[0]),'Current native corporate employer canonical identity changed')
  need(!doc.nodes(node=>node.tag==='base').length,'Unreviewed native corporate base authority')
  return doc
 }
 async function authority(){
  const homeHTML=await read(HOME),home=corporate(homeHTML,HOME),careerHTML=await read(CAREERS),career=corporate(careerHTML,CAREERS),openingHTML=await read(OPENINGS),opening=corporate(openingHTML,OPENINGS)
  need(home.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS&&home.text(node)==='Careers').length===1&&career.nodes(node=>node.tag==='a'&&node.attrs.href===OPENINGS&&career.text(node)==='Current Openings').length===1,'Current native employer careers handoff changed')
  const configs=opening.nodes(node=>node.tag==='script'&&!node.attrs.src&&node.raw?.includes('khConfig'))
  need(configs.length===1&&configs[0].raw.trim()===CONFIG&&opening.nodes(node=>node.tag==='script'&&node.attrs.src===EMBED).length===1&&opening.nodes(node=>node.attrs.id==='khembedjobs').length===1,'Current native exact employer Keka embed authority changed')
  const embed=await read(EMBED);need(sha(embed)===EMBED_SHA,'Whole reviewed current embed client changed')
  const portal=literal(await read(INFO));need(portal.name==='MosChip Technologies Limited'&&portal.shortName==='MosChip Technologies Limited'&&portal.careersPortalDomain==='moschip.keka.com'&&portal.companyWebsite==='https://moschip.com','Native tenant employer identity disagrees')
  const group=literal(await read(GROUP));need(same(group,{isGroupLinked:false}),'Current native tenant group authority changed')
  const departments=literal(await read(DEPARTMENTS));need(Array.isArray(departments),'Invalid native department model')
  const applicationClient=await read(APP);need(sha(applicationClient)===APP_SHA,'Whole reviewed current application client changed')
  const rows=parseNativeInventory(await read(ACTIVE))
  return {homeHTML,careerHTML,openingHTML,portal,group,departments,rows,embedSHA256:sha(embed),applicationClientSHA256:sha(applicationClient)}
 }
 async function rolePass(row,observation,phase){
  if(!boundIDs.has(row.id))return
  observation['own'+phase+'Model']=roleModel(await read(detailURL(row.id)),row)
  if(isIndia(row)){
   observation['own'+phase+'Application']=roleModel(await read(applyURL(row.id)),row,true)
   observation['native'+phase+'ApplicationFields']=clone(nativeForm(await read(formURL(row.id))))
  }
 }
 try{
  const opening=await authority()
  // Forty complete own role/application/form triples fit the fixed source
  // request budget. Extra actual native rows remain observations with a hold;
  // neither the cohort nor eligible IDs are frozen to this capture.
  for(const row of opening.rows){
   if(boundIDs.size<40){boundIDs.add(row.id);for(const url of [detailURL(row.id),applyURL(row.id),formURL(row.id)])permitted.add(url)}
   const issues=[];if(!isIndia(row))issues.push(nonIndia(row)?'explicit-native-non-india':'native-role-country-unpublished')
   if(!same(Object.keys(row).sort(),rowKeys))issues.push('unreviewed-native-criteria-field')
   if(!boundIDs.has(row.id))issues.push('own-role-model-read-budget-exhausted')
   const observation={id:String(row.id),nativeOpeningRecord:clone(row),country:isIndia(row)?'India':null,qualificationIssues:issues,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   observations.push(observation);await rolePass(row,observation,'Opening')
  }
  const closing=await authority();need(same(opening,closing),'Opening/closing whole native employer/client/active cohort changed')
  for(let index=0;index<closing.rows.length;index++){
   const row=closing.rows[index],observation=observations[index];observation.nativeClosingRecord=clone(row);await rolePass(row,observation,'Closing')
   for(const [a,b]of [['ownOpeningModel','ownClosingModel'],['ownOpeningApplication','ownClosingApplication'],['nativeOpeningApplicationFields','nativeClosingApplicationFields']])need(same(observation[a],observation[b]),'Opening/closing full native own role/application/criteria changed')
  }
  signal.throwIfAborted()
  const jobs=[]
  for(const observation of observations){
   const row=observation.nativeOpeningRecord
   if(observation.qualificationIssues.length)continue
   if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(row.publishedOn??'')||!Number.isFinite(Date.parse(row.publishedOn))||Date.parse(row.publishedOn)>Date.parse(now)){observation.qualificationIssues.push('native-publication-invalid-or-future');continue}
   const fields=observation.nativeOpeningApplicationFields,sourceURL=detailURL(row.id)
   jobs.push({title:row.title,company:COMPANY,source:SOURCE,jobId:SOURCE+'-'+row.id,requisitionId:String(row.id),department:row.departmentName,location:row.jobLocations.map(location=>(location.name??location.city)+', '+location.countryName).join(' / '),country:'India',employmentType:row.jobType===2?'Full-time':'Part-time',experienceRequired:observation.ownOpeningModel.nativeExperienceLabel,requiredSkills:Array.isArray(row.skillNames)?clone(row.skillNames):[],jobDescription:observation.ownOpeningModel.fullDescriptionText+'\n\nApplication instructions as published:\n'+observation.ownOpeningApplication.wholeApplicationText+'\n\nPublisher application field labels and options (visibility and requiredness unverified):\n'+applicationCriteria(fields),postingDate:row.publishedOn,sourcePostingDate:row.publishedOn,sourceDateEvidence:'keka-native-active-published-on-v1',sourceUrl:sourceURL,applyUrl:applyURL(row.id),link:applyURL(row.id),companyCareerPage:OPENINGS,companyDomain:'moschip.com',atsPlatform:'keka',scrapedAt:now,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceDetailComplete:true,sourceNativeRoleRecord:clone(row),sourceNativeApplicationFields:clone(fields),sourceNativeApplicationHTML:observation.ownOpeningApplication.html,sourceNativeApplicationCriteriaVerified:false,nativeApplicationFieldModelRetained:true,publicApplicationEligibilityQualified:false})
  }
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:ACTIVE,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:originalResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'whole-current-native-tenant-cohort-criteria-application-closing-reconciled-company-inventory-scope-and-country-omissions-remain-unqualified'})
  const summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null};attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,originalResponses,wholeObservedNativeBoardClosingReconciled:true,allObservedOwnRecordsClosingReconciled:observations.length<=40,unknownCountryVacancies:opening.rows.filter(row=>!isIndia(row)&&!nonIndia(row)).length,explicitNonIndiaVacancies:opening.rows.filter(nonIndia).length,companyIndiaZeroProven:false,companyScopeComplete:false,lifecycleCleanupAllowed:false,applicationInteractions:0,publicApplicationGETsOnly:true,readLimits:{maximumReads:258,maximumCompleteOwnRoles:40,nativeRequestIntervalMs:500,sourceTimeoutMs,requestTimeoutMs,decodedBytes}},configurable:true});return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,observations,originalResponses,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},configurable:true,enumerable:true})}catch{};throw error}finally{clearTimeout(timer)}
}
