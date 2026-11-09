import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {PRIMARY,ALL_JOBS,BOARD,CLIENT,CLIENT_SHA,parsePrimary,parseBoard,parseClient,parseJSON,parseRedirect,closingPagesMatch} from './data20261108.js'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261108.js'
import {nativeTransport} from './transport20261108.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const failures=new WeakMap(),criteriaFields=['description','responsibilities','qualifications','preferred_qualifications','benefits']
const need=(ok,message,code='AXA_NATIVE_PROOF')=>{if(!ok)throw failure('AXA native: '+message,code)}
const diagnostic=error=>Object.fromEntries(['name','code','message'].map(key=>{const value=errorValue(error,key);return[key,typeof value==='string'?value.slice(0,key==='message'?2048:128):null]}))
export const readAXAFailureEvidence=signal=>{const value=failures.get(signal);return value?structuredClone(value):null}
const countryNames=(()=>{const names=new Map(),display=new Intl.DisplayNames(['en'],{type:'region'});for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){names.set(code.toLowerCase(),name);names.set(name.toLowerCase(),name)}}names.set('ind','India');names.set('usa','United States');return names})()
const country=value=>typeof value==='string'?countryNames.get(value.trim().toLowerCase())??null:null
function locations(value){
 const more=value?.additional_locations,valid=more==null||Array.isArray(more),native=[value,...(Array.isArray(more)?more:[])]
 return{valid,locations:native.map(item=>{const object=item&&typeof item==='object'&&!Array.isArray(item),claims=object?['country','country_code'].filter(key=>item[key]!=null&&item[key]!=='').map(key=>item[key]):[],resolved=claims.map(country),known=resolved.length>0&&resolved.every(Boolean)&&new Set(resolved).size===1;return{country:known?resolved[0]:null,nativeClaims:claims,city:object&&typeof item.city==='string'?item.city:null,state:object&&typeof item.state==='string'?item.state:null,nativeValue:item??null,conflict:new Set(resolved.filter(Boolean)).size>1}})}
}
function countryEvidence(row,detail){
 const left=locations(row),right=locations(detail),known=left.valid&&right.valid&&[...left.locations,...right.locations].every(value=>value.country),same=known&&left.locations[0].country===right.locations[0].country&&isDeepStrictEqual(left.locations.slice(1).map(value=>value.country).sort(),right.locations.slice(1).map(value=>value.country).sort())
 return{listing:left.locations,detail:right.locations,consistent:Boolean(same),conflict:[...left.locations,...right.locations].some(value=>value.conflict)||Boolean(known&&!same)}
}
function canonical(value,record){
 if(value==null)return true
 if(typeof value!=='string')return false
 try{const url=new URL(value);return url.origin==='https://careers.axa.com'&&!url.username&&!url.password&&!url.hash&&['/jobs/'+record.slug,'/careers-home/jobs/'+record.slug].includes(url.pathname)&&[...url.searchParams.keys()].every(key=>key==='lang')&&url.searchParams.getAll('lang').length===1&&url.searchParams.get('lang')===record.language}catch{return false}
}
function pageCanonical(value,paths){
 return value.head.canonicals.every(claim=>{if(typeof claim!=='string'||!claim.trim())return false;try{const url=new URL(claim,value.sourcePage);return url.origin==='https://careers.axa.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&paths.includes(url.pathname.replace(/\/$/,''))}catch{return false}})
}
function facts(listing,detail,at){
 const row=listing?.data,d=detail?.nativeValue
 if(!row||!d||typeof d!=='object'||Array.isArray(d))return{identity:false,publication:false,criteria:false,criteriaHTML:null,descriptionHTML:null,descriptionText:null,countries:countryEvidence(row,d)}
 let identity=['req_id','slug','language','title'].every(key=>typeof row[key]==='string'&&row[key]&&row[key]===d[key]),publication=true,criteria=true
 for(const value of[row,d]){
  const codes=[value.client_code,value.meta_data?.client_code].filter(code=>code!=null)
  identity&&=codes.length>0&&codes.every(code=>code==='axa')&&value.hiring_organization==='AXA'&&canonical(value.meta_data?.canonical_url,value)
  publication&&=value.internal===false&&value.searchable===true&&value.applyable===true&&value.meta_data?.icims?.jps_is_public===true
 }
 const expiries=[],posted=[]
 for(const value of[row,d]){
  const site=value.meta_data?.icims?.primary_posted_site_object??{}
  for(const raw of[value.posting_expiry_date,site.validThrough])if(raw!=null){const time=typeof raw==='string'?Date.parse(raw):NaN;if(!Number.isFinite(time))publication=false;else expiries.push(time)}
  for(const raw of[value.posted_date,site.datePosted])if(raw!=null){const time=typeof raw==='string'?Date.parse(raw):NaN;if(!Number.isFinite(time))publication=false;else posted.push(time)}
 }
 const instant=Date.parse(at)
 publication&&=Number.isFinite(instant)&&expiries.every(time=>time>instant)&&new Set(expiries).size<=1&&posted.every(time=>time<=instant)&&new Set(posted).size<=1
 const sections=[]
 for(const key of criteriaFields){const value=d[key];if(value==null||Array.isArray(value)&&value.length===0)continue;if(typeof value!=='string'){criteria=false;continue}sections.push(value)}
 const descriptionHTML=typeof d.description==='string'?d.description:null,criteriaHTML=sections.join('\n'),descriptionText=extractActiveDescription(criteriaHTML)
 criteria&&=descriptionHTML!==null&&Boolean(extractActiveDescription(descriptionHTML))&&(descriptionText?.length??0)>=100
 return{identity:Boolean(identity),publication:Boolean(publication),criteria:Boolean(criteria),criteriaHTML,descriptionHTML,descriptionText,countries:countryEvidence(row,d)}
}
function envelopeProfile(value){const result=structuredClone(value);delete result.request_id;if(result.meta_data&&typeof result.meta_data==='object')delete result.meta_data.ResponseMetadata;return result}

export const createAXANativeScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options);need(!settings.fetchPage||settings.fetchImpl,'Supply original streaming fetchImpl','AXA_INVALID_OPTIONS')
 const filter=settings.countryFilter??'India';need(['India','Global'].includes(filter),'Unsupported country selection','AXA_INVALID_OPTIONS')
 const control=runtime(settings),models={},rawResponses=[],auditSinkFailures=[],listings=[],detailModels=[],pageLabels=[]
 let observedAt=null,qualifiedAt=null,candidateTotal=null,pageSize=null,locale=null,phase='current-primary',nextStart=-Infinity,closingVerified=false,firstCause=null,failureObserved=false
 const physical=async(url,label,mime='html')=>{
  phase=label;control.check();const at=Math.max(performance.now(),nextStart);nextStart=at+(settings.rateLimitMs??500)
  if(at>performance.now()){try{await delay(at-performance.now(),undefined,{signal:control.signal})}catch(error){control.check();throw error}}
  control.check();control.admit();let receipt=null
  return nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl:settings.fetchImpl??globalThis.fetch,callerSignal:settings.signal,onReceipt:response=>{if(!receipt){receipt={requestedURL:url,phase:label,response};rawResponses.push(receipt)}}})(url,{signal:control.signal,expectedMime:mime,headers:{Accept:mime==='javascript'?'application/javascript,text/javascript':mime==='json'?'application/json':mime==='redirect'?'text/plain,text/html':'text/html'}})
 }
 const readModel=async(url,label,mime,parse)=>{const packet=await physical(url,label,mime);const model=parse(packet.body,url,packet);models[label]=model;control.check();return model}
 const rows=()=>listings.map((listing,index)=>{
  const row=listing?.data&&typeof listing.data==='object'&&!Array.isArray(listing.data)?listing.data:null
  const detail=detailModels[index]??null,d=detail?.nativeValue,fact=facts(listing,detail,qualifiedAt??observedAt),bound=fact.identity,known=fact.countries.consistent,ownLocations=fact.countries.detail,nativeCountries=known?[...new Set(ownLocations.map(value=>value.country))]:[],published=Boolean(bound&&closingVerified&&fact.publication),qualified=Boolean(published&&fact.criteria&&known),url=row?.meta_data?.canonical_url??(typeof row?.slug==='string'&&typeof row?.language==='string'?BOARD+'/'+encodeURIComponent(row.slug)+'?lang='+encodeURIComponent(row.language):null)
  return{source:'axa',publisher:'AXA',company:bound?'AXA':null,jobId:typeof row?.req_id==='string'?row.req_id:null,requisitionId:typeof d?.req_id==='string'?d.req_id:null,title:typeof row?.title==='string'?row.title:null,sourceUrl:row&&url!=null&&canonical(url,row)?url:null,applyUrl:null,country:known?ownLocations[0].country:null,city:typeof d?.city==='string'?d.city:null,state:typeof d?.state==='string'?d.state:null,location:typeof d?.full_location==='string'?d.full_location:null,employmentType:typeof d?.employment_type==='string'?d.employment_type:null,postingDate:typeof d?.posted_date==='string'?d.posted_date:null,closingDate:typeof d?.posting_expiry_date==='string'?d.posting_expiry_date:null,nativeObservationOrdinal:index,sourceNativeListingRecord:listing,sourceNativeRecord:listing,sourceNativeDetail:detail,sourceNativeCountryEvidence:fact.countries,sourceNativeLocations:ownLocations,sourceNativeCountries:nativeCountries,sourceNativeCountryClaimConflict:fact.countries.conflict,sourceCountryScopeUnresolved:!known,sourceNativeOwnDescriptionHTML:fact.descriptionHTML,sourceDescription:fact.criteriaHTML,jobDescription:fact.descriptionText,sourceNativeCriteriaComplete:Boolean(bound&&fact.criteria),sourceNativeAuthoredCriteria:criteriaFields.map(field=>({field,present:Boolean(d&&Object.hasOwn(d,field)),nativeValue:d?.[field]??null})),sourceNativeIdentityBound:bound,sourceNativeCurrentPublicationQualified:published,sourceCurrentNativeRoleQualified:qualified,sourceNativeIndiaLocationQualified:qualified&&nativeCountries.includes('India'),sourceNativeCriteriaVisibilityQualified:false,sourceDetailComplete:Boolean(bound&&fact.criteria),sourceScopeComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,applicationVisited:false,scrapedAt:observedAt}
 })
 const snapshot=()=>({source:'axa',recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,observedAt,qualifiedAt,phase,models,observations:rows(),rawResponses,auditSinkFailures,requestCount:control.requests,candidateQueryCountry:'India',candidateQueryReportedTotal:candidateTotal,candidatePagesComplete:candidateTotal!==null&&listings.length===candidateTotal,closingVerified,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,renderedCriteriaVisibilityQualified:false,activeHiringVerified:false,applicationActions:0,publisherProgramsExecuted:false})
 const validatePrimary=value=>need(value.head.titles.length===1&&value.head.titles[0]==='Careers Home'&&pageCanonical(value,['/careers-home'])&&value.nativeAccount?.cid==='axa'&&value.nativeSettings?.contextSettings?.currentClient==='axa'&&value.nativeHandoffs.length===1&&value.nativeHandoffs[0].url===ALL_JOBS,'Active exact company ALL JOBS handoff unavailable')
 const validateBoard=value=>{
  const config=value.nativeSettings,contexts=config?.contextSettings,current=contexts?.contextDefinitions?.filter(item=>item.name===contexts.currentContext)
  need(value.head.titles.length===1&&value.head.titles[0]==='AXA Careers'&&pageCanonical(value,['/careers-home/jobs','/jobs'])&&value.nativeAccount?.cid==='axa'&&config?.externalSearch===true&&config.isLoggedIn===false&&config.path==='/careers-home/jobs'&&/^[a-z]{2}-[a-z]{2}$/i.test(config.locale??'')&&Number.isSafeInteger(config.numRowsPerPage)&&config.numRowsPerPage>0&&config.numRowsPerPage<=100&&(config.jobDescriptionAtsOverride==null||config.jobDescriptionAtsOverride===false)&&config.useCustomJDUrl!==true&&config.searchOverride&&typeof config.searchOverride==='object'&&!Array.isArray(config.searchOverride)&&Object.keys(config.searchOverride).length===0&&config.searchListingOverride==null&&contexts?.currentClient==='axa'&&contexts.currentContext==='careers-home'&&current?.length===1&&(!current[0].search||Object.keys(current[0].search).length===0)&&value.nativeRecruitmentScripts.length===4&&value.nativeRecruitmentScripts.every((script,index)=>script.url==='https://app.jibecdn.com/prod/search/4.11.225/'+['runtime.js','polyfills.js','vendor.js','main.js'][index]&&!Object.hasOwn(script.attrs,'nomodule')&&/^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(script.attrs.type??'')),'Anonymous native board account scope or client declaration unavailable')
 }
 const validateClient=value=>need(value.nativeSHA256===CLIENT_SHA&&!value.nativeJavaScript.includes('useStar'),'Declared reviewed public client changed before query authority')
 const query=page=>{const url=new URL('https://careers.axa.com/api/jobs');for(const[key,value]of Object.entries({lang:locale,country:'India',limit:pageSize,page,internal:'false'}))url.searchParams.set(key,String(value));return url.href}
 const validateEnvelope=(model,expected=null)=>{const value=model.nativeValue;need(value&&typeof value==='object'&&!Array.isArray(value)&&!value.error&&Array.isArray(value.jobs)&&Number.isSafeInteger(value.totalCount)&&value.totalCount>=0&&value.totalCount<=500&&value.count===value.totalCount&&value.jobs.length<=pageSize&&(expected===null||value.totalCount===expected),'Native result envelope or total is inconsistent');return value}
 try{
  const date=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(+date),'Invalid observation time','AXA_INVALID_OPTIONS');observedAt=date.toISOString()
  const primary=await readModel(PRIMARY,'current-primary','html',parsePrimary);validatePrimary(primary)
  const redirect=await readModel(ALL_JOBS,'declared-all-jobs','redirect',(body,url,packet)=>parseRedirect(body,{requestedURL:url,status:packet.status,headers:packet.headers}));need(redirect.nativeStatus===302&&redirect.declaredTarget===BOARD,'Declared public redirect changed')
  const board=await readModel(BOARD,'redirected-public-board','html',parseBoard);validateBoard(board);locale=board.nativeSettings.locale;pageSize=board.nativeSettings.numRowsPerPage
  const client=await readModel(CLIENT,'declared-search-client','javascript',parseClient);validateClient(client)
  const seen=new Set()
  for(let page=1;;page++){
   const label='native-india-page-'+page,model=await readModel(query(page),label,'json',parseJSON),value=validateEnvelope(model,candidateTotal)
   if(candidateTotal===null)candidateTotal=value.totalCount
   pageLabels.push(label);listings.push(...value.jobs)
   need(listings.length<=candidateTotal&&(value.jobs.length>0||candidateTotal===0),'Native pagination ended or exceeded its total')
   for(const listing of value.jobs){const row=listing?.data;need(row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.req_id==='string'&&row.req_id.length>0&&row.req_id.length<=160&&/^[a-z\d_-]{1,128}$/i.test(row.slug??'')&&/^[a-z]{2}-[a-z]{2}$/i.test(row.language??'')&&typeof row.title==='string'&&row.title.trim()&&!seen.has(row.req_id),'Native result identity missing repeated or unsafe');seen.add(row.req_id)}
   if(listings.length===candidateTotal)break
  }
  for(const[index,listing]of listings.entries()){
   const row=listing.data,url='https://careers.axa.com/api/jobs/'+encodeURIComponent(row.slug)+'/'+encodeURIComponent(row.language),detail=await readModel(url,'native-detail-'+index,'json',parseJSON)
   detailModels.push(detail);need(detail.nativeValue&&['req_id','slug','language','title'].every(key=>detail.nativeValue[key]===row[key]),'Native detail identity contradicts its own listing')
  }
  const closingClient=await readModel(CLIENT,'closing-search-client','javascript',parseClient);validateClient(closingClient);need(isDeepStrictEqual(client,closingClient),'Closing native client changed','AXA_NATIVE_CLOSING_CONFLICT')
  for(const[index,label]of pageLabels.entries()){const close=await readModel(query(index+1),'closing-'+label,'json',parseJSON);validateEnvelope(close,candidateTotal);need(isDeepStrictEqual(envelopeProfile(models[label].nativeValue),envelopeProfile(close.nativeValue)),'Closing full native result records changed','AXA_NATIVE_CLOSING_CONFLICT')}
  const closingBoard=await readModel(BOARD,'closing-public-board','html',parseBoard);validateBoard(closingBoard);need(closingPagesMatch(board,closingBoard,{allowUseStarBooleanTransition:true}),'Closing native board configuration changed','AXA_NATIVE_CLOSING_CONFLICT')
  const closingPrimary=await readModel(PRIMARY,'closing-primary','html',parsePrimary);validatePrimary(closingPrimary);need(closingPagesMatch(primary,closingPrimary),'Closing native company routing changed','AXA_NATIVE_CLOSING_CONFLICT')
  const complete=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(+complete),'Invalid closing observation time','AXA_INVALID_OPTIONS');qualifiedAt=complete.toISOString();closingVerified=true
 }catch(error){firstCause=error;failureObserved=true}
 try{
  for(const[name,sink]of[['audit',settings.onAudit],['records',settings.onRecords]])if(sink){try{control.check()}catch(error){if(!failureObserved){firstCause=error;failureObserved=true}break}try{await bounded(async(signal,check)=>{const guard=()=>{control.check();check()};guard();const value=structuredClone(name==='audit'?snapshot():rows());guard();await sink(value,{signal},guard);guard()},{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'AXA_AUDIT_TIMEOUT'})}catch(error){settings.signal?.throwIfAborted();if(failureObserved)auditSinkFailures.push({sink:name,...diagnostic(error)});else{firstCause=error;failureObserved=true}}}
  settings.signal?.throwIfAborted()
  if(failureObserved)throw annotateFailure(firstCause,{source:'axa',nativeEvidence:structuredClone(snapshot()),sourceScopeComplete:false,lifecycleCleanupAllowed:false,abortRetries:true,failureKind:errorValue(firstCause,'failureKind')??'incomplete_listing',...(['AXA_NATIVE_PROOF','AXA_NATIVE_CLOSING_CONFLICT'].includes(errorValue(firstCause,'code'))?{softFailure:true,upstreamOutage:false,failureKind:'coverage_gap'}:{})})
  control.check()
  const selected=rows().filter(row=>row.sourceCurrentNativeRoleQualified&&(filter==='Global'||row.sourceNativeCountries.includes('India'))).map(row=>{
   if(filter==='Global')return row
   const location=row.sourceNativeLocations.find(value=>value.country==='India');return{...row,country:'India',city:location.city,state:location.state,location:[location.city,location.state,'India'].filter(Boolean).join(', ')}
  }),jobs=structuredClone(settings.maxJobs===null?selected:selected.slice(0,settings.maxJobs)),audit=structuredClone(snapshot())
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit});Object.defineProperty(jobs,'sourceAudit',{value:audit});attachSourceObservationEvidence(jobs,audit)
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:control.requests,verifiedAt:qualifiedAt,reason:'Complete observed native India-candidate models and authored detail criteria retained;contradictory countries and company-wide inventory remain unresolved'})
 }catch(error){if(settings.signal?.aborted){failures.set(settings.signal,structuredClone(snapshot()));throw settings.signal.reason}throw error}finally{control.close()}
}})
