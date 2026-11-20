import{readNativeDocument,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import{nativeCountryName,nativeLocationCountryName,nativeDate}from'../../scraper-support/shared/nativeJobPosting.js'
import{findExplicitNativeClosure}from'../../scraper-support/utils/sourceAvailability.js'
import{createBoundedPublicCareerTransport}from'../../scraper-support/utils/boundedPublicCareerTransport.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{inspectSightSpectrumCareers}from'./nativeCareers.js'
const source='sightspectrumtechnologysolutions',company='SightSpectrum Technology Solutions',origin='https://www.sightspectrum.com',home=origin+'/careers',app='159461dd-8f53-4f2e-991c-0aa089917bba',collection='@beaver-codes/career-and-job-board/'
const norm=x=>String(x??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('SightSpectrum current publication: '+message),{abortRetries:true})}
const one=(xs,label)=>{need(xs.length===1,'unique '+label+' unavailable');return xs[0]}
export function readSightPublishedPage(html){
 const d=readNativeDocument(html),inspected=inspectSightSpectrumCareers(html),viewer=JSON.parse(one(d.nodes(n=>n.tag==='script'&&n.attrs.id==='wix-viewer-model'),'own native viewer model').raw)
 need(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===home).length===1&&viewer.site?.externalBaseUrl===origin&&viewer.accessTokensUrl===origin+'/_api/v1/access-tokens','own publisher/site identity differs')
 const bootstrap=viewer.siteFeaturesConfigs?.platform?.bootstrapData,code=bootstrap?.wixCodeBootstrapData,installation=bootstrap?.appsSpecData?.[app],siteName=viewer.siteFeaturesConfigs?.siteWixCodeSdk?.siteDisplayName
 need(installation?.appDefinitionName==='Careers Page and Job Board'&&installation.appDefinitionId===app&&code?.codePackagesData?.some(p=>p.importName==='@beaver-codes/career-and-job-board'&&p.appDefId===app)&&typeof code.wixCodeModel?.appData?.codeAppId==='string','current declared own native jobs app unavailable')
 need(siteName===viewer.siteFeaturesConfigs?.seo?.context?.siteName&&norm(siteName),'current own publisher technical name unavailable')
 const roles=inspected.jobs.map(j=>{
  need(j.jobId&&j.sourceNativeRecord.hiringOrganization?.name===siteName,'native schema/own publisher binding differs')
  const id=j.jobId,candidates=d.nodes(n=>n.attrs.id?.endsWith('__'+id)),apply=one(candidates.filter(n=>d.text(n)==='Apply'&&d.nodes(x=>x.tag==='button'&&d.text(x)==='Apply',n).length===1),'same-record Apply control'),button=one(d.nodes(n=>n.tag==='button',apply),'Apply button')
  const locations=candidates.filter(n=>d.text(n)==='chennai'),card=one(candidates.filter(n=>n.attrs.role==='listitem'),'same-record SSR role card')
  const visibleRole={id:card.attrs.id,text:d.text(card),model:structuredClone(card),blocks:d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag),card).map(d.text)}
  return{id,title:j.title,schema:j.sourceNativeRecord,visibleCard:j.sourceNativeVisibleCard,visibleRole,locationLabels:locations.map(n=>({id:n.attrs.id,text:d.text(n)})),apply:{id:apply.attrs.id,type:button.attrs.type,label:d.text(button),disabled:[button,apply,card].some(n=>Object.hasOwn(n.attrs,'disabled')||n.attrs['aria-disabled']==='true'),attrs:button.attrs}}
 })
 return{roles,nativeViewerModel:viewer,publisherSiteName:siteName,metaSiteId:viewer.site.metaSiteId,codeAppId:code.wixCodeModel.appData.codeAppId,appInstanceId:installation.instanceId,accessTokensUrl:viewer.accessTokensUrl}
}
function constraints(record,schema,observedAt,visibleRole){
 const now=new Date(observedAt);need(Number.isFinite(+now),'invalid observation clock');const expiries=[]
 for(const object of[record,schema]){
  if(object.status!=null)need(!/^(?:archived|closed|expired|inactive|removed|draft)$/i.test(norm(object.status)),'native publication explicitly closed')
  for(const field of['canApply','isActive','isPublished'])if(object[field]!=null)need(object[field]===true,'native availability conflict')
  for(const field of['isClosed','closed','archived','isArchived','expired','isExpired'])if(object[field]!=null)need(object[field]===false,'native availability explicitly closed')
  for(const field of['country','countryCode','workCountry'])if(object[field]!=null)need(nativeCountryName(object[field])==='India','explicit native country conflict')
  for(const field of['hiringOrganization','employer','legalEmployer'])if(object[field]!=null){const name=typeof object[field]==='string'?object[field]:object[field].name;need(['SightSpectrum',company,'Sightspectrum_Website_New'].includes(norm(name)),'explicit native employer conflict')}
  for(const field of['validThrough','publicTo','closingDate','applicationDeadline','dateExpires'])if(object[field]!=null&&object[field]!==''){
   const date=nativeDate(object[field],{required:true});need(date.exact?Date.parse(date.iso)>=+now:date.iso.slice(0,10)>=now.toISOString().slice(0,10),'native role expired');expiries.push({field,value:object[field]})
  }
  if(object.publicFrom!=null){const date=nativeDate(object.publicFrom,{required:true});need(Date.parse(date.iso)<=+now,'native publication window not started')}
  const blocks=['description','shortDescription'].flatMap(field=>{const d=readNativeDocument(typeof object[field]==='string'?object[field]:'');return[extractActiveDescription(object[field]??'')??'',...d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag)).map(d.text)]})
  if(object===record)blocks.push(...visibleRole.blocks)
  const declarations=blocks.map(block=>block.replace(/^Role Summary:\s*/i,''))
  need(!findExplicitNativeClosure(declarations),'native role explicitly closed')
  for(const block of declarations){const c=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block);if(c)need(nativeCountryName(c[1])==='India','native criteria country conflict');const l=/^(?:(?:job|work)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(block);if(l){const country=nativeLocationCountryName(l[1]);need(!country||country==='India','native criteria workplace conflict')}const e=/^(?:company(?: name)?|employer|legal employer|hiring organization)\s*:\s*(.+)$/i.exec(block);if(e)need(['SightSpectrum',company].includes(norm(e[1])),'native criteria employer conflict')}
 }
 return expiries
}
export function sightPublishedRole(item,{page,observedAt=new Date().toISOString()}={}){
 const record=item?.data
 need(item?.dataCollectionId===collection+'Jobs'&&typeof item.id==='string'&&item.id===record?._id&&/^[a-f0-9-]{36}$/.test(item.id)&&norm(record.title),'native original job identity unavailable')
 const role=one(page.roles.filter(r=>r.id===item.id),'native own role declaration'),schema=role.schema
 need(record.title===role.title&&record.title===schema.title&&role.visibleCard?.id===item.id,'native data/schema/title identity differs')
 need(role.apply.label==='Apply'&&role.apply.type==='button'&&!role.apply.disabled&&role.apply.id.endsWith('__'+item.id),'native same-role application unavailable')
 need(schema.jobLocation?.['@type']==='Place'&&schema.jobLocation.address==='chennai'&&role.locationLabels.length>=1&&role.locationLabels.length<=4,'same-role exact Chennai workplace unavailable')
 const locations=record.tags?.filter(t=>String(t.icon??'').includes('11062b_8502ff3e62d54083a747ade42905ba05'))??[]
 need(locations.length===1&&locations[0].text==='chennai','native role location tag/schema differs')
 const expiry=constraints(record,schema,observedAt,role.visibleRole),description=extractActiveDescription(record.description??''),schemaDescription=extractActiveDescription(schema.description??'')
 const conflict=Boolean(description&&schemaDescription&&description!==schemaDescription)||record.title==='UI/UX Designer'&&/Frontend Engineer/i.test(description??schemaDescription??'')
 const posted=schema.datePosted==null?null:nativeDate(schema.datePosted,{required:true}).raw;need(!posted||Date.parse(posted)<=Date.parse(observedAt),'native posting date in future')
 return{source,company,nativeEmployer:null,nativeLegalEmployer:null,sourceNativePublisher:'SightSpectrum',sourcePublisherTechnicalName:page.publisherSiteName,sourceLegalEmployerUnverified:true,
  title:record.title,jobId:item.id,requisitionId:null,sourceUrl:home,applyUrl:home,link:home,country:'India',city:'Chennai',location:'chennai',sourceCountryScopeUnresolved:false,
  sourceCountryEvidence:{kind:'same-role-published-schema-visible-label-and-native-location-tag',nativeLabel:'chennai',reference:'https://chennai.nic.in/'},
  sourceDescription:description||schemaDescription||null,jobDescription:description||schemaDescription||null,sourceNativeDescription:record.description??null,sourceNativeShortDescription:record.shortDescription??null,sourceNativeVisibleRole:role.visibleRole,sourceNativeSchemaDescription:schema.description??null,sourceNativeRecord:item,sourceNativeJobPosting:schema,
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:conflict?'native-title-or-criteria-discrepancy':'published-native-criteria-and-Apply-handoff-only-full-controls-unverified',sourceCriteriaConflict:conflict,
  sourceNativeApplication:{url:home,jobId:item.id,controlId:role.apply.id,kind:'same-record-published-Apply-control',declaredInstalledApp:app,reviewedClientHandoff:'openAppLightbox("apply-form", {job: nativeRecord})',allControlsQualified:false,activationVerified:false,submitted:false,nativeClientExecuted:false},
  sourceNativeAvailability:{publishedSchema:true,nativeSSRCardDeclared:true,nativeStatus:record.status??null,publicFrom:record.publicFrom??null,publicTo:record.publicTo??null,backendCanApplyVerified:false},
  postingDate:posted,closingDate:expiry[0]?.value??null,sourceNativeDates:{datePosted:schema.datePosted??null,created:record._createdDate??null,updated:record._updatedDate??null,publicFrom:record.publicFrom??null,publicTo:record.publicTo??null,recognizedExpiryFields:expiry},
  department:null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceCompanyScopeUnresolved:false}
}
const query=(page,name,offset=0)=>origin+'/_api/cloud-data/v2/items/query?.r='+Buffer.from(JSON.stringify({dataCollectionId:collection+name,query:{filter:name==='Jobs'?{status:{$ne:'archived'}}:{},paging:{offset,...(name==='Settings'?{limit:1}:{})},fields:[]},referencedItemOptions:[],returnTotalCount:true,environment:'LIVE',appId:page.codeAppId})).toString('base64url')
export async function runSightPublished(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free callback transport unqualified')
 const transport=options.fetchImpl??globalThis.fetch,allowed=new Set([home]),raw=[]
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:(u,m)=>m==='GET'&&allowed.has(u),fetchImpl:async(u,init)=>{const r=await transport(u,init);need(r?.url===u&&Number.isInteger(r.status)&&r.headers?.get&&r.body,'native HTTP metadata unavailable');return r}})
 let requests=0,bytes=0
 const read=async(u,json=false,headers)=>{need(++requests<=30,'native request cap exceeded');const value=json?await io.fetchJson(u,headers?{headers}:undefined):await io.fetchText(u);bytes+=Buffer.byteLength(json?JSON.stringify(value):value);need(bytes<=12000000,'native aggregate byte cap exceeded');raw.push({url:u,...(json?{originalModel:value}:{originalHTML:value})});return value}
 const phase=async()=>{
  const page=readSightPublishedPage(await read(home));allowed.add(page.accessTokensUrl);const tokens=await read(page.accessTokensUrl,true),token=tokens.apps?.[app]?.instance
  need(tokens.metaSiteId===page.metaSiteId&&typeof token==='string'&&token.length>20,'current own anonymous public site/app scope unavailable')
  const headers={Authorization:token,Accept:'application/json, text/plain, */*'},settingsURL=query(page,'Settings');allowed.add(settingsURL);const settings=await read(settingsURL,true,headers)
  need(settings.dataItems?.length===1&&settings.dataItems[0].dataCollectionId===collection+'Settings','native own application settings unavailable')
  const records=[];let offset=0,total=null,terminal=false
  for(let index=0;index<10;index++){const url=query(page,'Jobs',offset);allowed.add(url);const model=await read(url,true,headers),meta=model.pagingMetadata
   need(Array.isArray(model.dataItems)&&meta&&Number.isSafeInteger(meta.total)&&meta.total<=500&&meta.count===model.dataItems.length&&meta.offset===offset&&typeof meta.hasNext==='boolean'&&meta.tooManyToCount===false,'native pagination/count unavailable')
   need(total===null||total===meta.total,'native pagination total changed');total=meta.total;records.push(...model.dataItems)
   if(!meta.hasNext){need(records.length===total,'native pagination terminal total incomplete');terminal=true;break}need(model.dataItems.length>0&&records.length<total,'native pagination progress unavailable');offset+=model.dataItems.length
  }
  need(terminal&&records.length>0&&new Set(records.map(r=>r.id)).size===records.length,'native complete publication inventory unavailable; zero unqualified')
  return{page,records,settings}
 }
 try{
  const opening=await phase(),closing=await phase(),jobs=[],held=[],closed=new Map(closing.records.map(r=>[r.id,r])),observedAt=(options.now||(()=>new Date().toISOString()))()
  need(opening.page.metaSiteId===closing.page.metaSiteId&&opening.page.appInstanceId===closing.page.appInstanceId,'native closing publisher/app binding differs')
  for(const record of opening.records){try{need(same(record,closed.get(record.id)),'native closing whole publication model changed');const job=sightPublishedRole(record,{page:opening.page,observedAt}),current=sightPublishedRole(closed.get(record.id),{page:closing.page,observedAt});need(same(job,current),'native closing role/schema/application changed');job.sourceClosingQualified=true;job.scrapedAt=observedAt;jobs.push(job)}catch(error){held.push({id:record.id,reason:error.message,originalRecord:record,closingRecord:closed.get(record.id)??null})}}
  const audit={source,openingNativeRecords:opening.records,closingNativeRecords:closing.records,openingRoleDeclarations:opening.page.roles,closingRoleDeclarations:closing.page.roles,openingApplicationSettings:opening.settings,closingApplicationSettings:closing.settings,originalResponses:raw,held,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,backendActivationVerified:false,applicationSubmitted:false,nativeClientExecuted:false}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit){let listener;try{await Promise.race([Promise.resolve().then(()=>options.onAudit(structuredClone(audit))),new Promise((_,reject)=>{listener=()=>reject(io.signal.reason);io.signal.addEventListener('abort',listener,{once:true});if(io.signal.aborted)listener()})])}finally{if(listener)io.signal.removeEventListener('abort',listener)}}io.signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:home,firstParty:true,pagesFetched:raw.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-own-published-native-India-records-schema-Apply-controls-and-closing-qualified;partial-authored-criteria-full-application-controls-legal-employer-company-inventory-and-cleanup-held'})
 }finally{io.close()}
}
