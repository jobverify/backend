import {disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {setTimeout as delay} from 'node:timers/promises'
import {types,isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {C0,C1,A,H,UUID,need,sha,exactFields,plainSnapshot,shape,rawJSON,readRawPacket,readNativePacket,
  layout,authoredCharacters,authoredProjection} from './currentProgrammeRenderer.js'
import {readHyperscienceFormSelection,readHyperscienceFormClientContract} from './currentFormContract.js'
import {compareHyperscienceServerFormCriteria} from './serverFormCriteriaComparison.js'
import {reconcileHyperscienceAcquiredProgramme} from './currentProgrammeAcquisition.js'
import {readInitialHyperscienceCorporate,hyperscienceCorporateComparison} from './currentProgrammeData.js'

const SOURCE='hyperscience'
const Q='https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiSourcingForm'
const REQUEST_BASE64='eyJvcGVyYXRpb25OYW1lIjoiQXBpU291cmNpbmdGb3JtIiwidmFyaWFibGVzIjp7Im9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZSI6Ikh5cGVyc2NpZW5jZSIsInNvdXJjaW5nRm9ybVNsdWciOiJ0YWxlbnQtY29tbXVuaXR5In0sInF1ZXJ5IjoiIyBTdGF0aWMgZG9jdW1lbnQgZGVyaXZlZCBmcm9tIG9yaWdpbmFsIHNlbGVjdGVkIGN1cnJlbnQgZW50cnkgQVNULiBObyByZXF1ZXN0IGhhcyBiZWVuIGF1dGhvcml6ZWQgb3IgZXhlY3V0ZWQuXG5xdWVyeSBBcGlTb3VyY2luZ0Zvcm0oJG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZTogU3RyaW5nISwgJHNvdXJjaW5nRm9ybUlkOiBTdHJpbmcsICRzb3VyY2luZ0Zvcm1TbHVnOiBTdHJpbmcpIHtcbiAgc291cmNpbmdGb3JtKG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZTogJG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZSwgc291cmNpbmdGb3JtSWQ6ICRzb3VyY2luZ0Zvcm1JZCwgc291cmNpbmdGb3JtU2x1ZzogJHNvdXJjaW5nRm9ybVNsdWcpIHtcbiAgICAuLi5Tb3VyY2luZ0Zvcm1XaXRoRm9ybVJlbmRlclBhcnRzXG4gICAgX190eXBlbmFtZVxuICB9XG59XG5cbmZyYWdtZW50IEpTT05Cb3hQYXJ0cyBvbiBKU09OQm94IHtcbiAgdmFsdWVcbiAgX190eXBlbmFtZVxufVxuXG5mcmFnbWVudCBGaWxlUGFydHMgb24gRmlsZSB7XG4gIGlkXG4gIGZpbGVuYW1lXG4gIF9fdHlwZW5hbWVcbn1cblxuZnJhZ21lbnQgRm9ybUZpZWxkRW50cnlQYXJ0cyBvbiBGb3JtRmllbGRFbnRyeSB7XG4gIGlkXG4gIGZpZWxkXG4gIGZpZWxkVmFsdWUge1xuICAgIC4uLiBvbiBKU09OQm94IHtcbiAgICAgIC4uLkpTT05Cb3hQYXJ0c1xuICAgICAgX190eXBlbmFtZVxuICAgIH1cbiAgICAuLi4gb24gRmlsZSB7XG4gICAgICAuLi5GaWxlUGFydHNcbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgLi4uIG9uIEZpbGVMaXN0IHtcbiAgICAgIGZpbGVzIHtcbiAgICAgICAgLi4uRmlsZVBhcnRzXG4gICAgICAgIF9fdHlwZW5hbWVcbiAgICAgIH1cbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgX190eXBlbmFtZVxuICB9XG4gIGlzUmVxdWlyZWRcbiAgZGVzY3JpcHRpb25IdG1sXG4gIGlzSGlkZGVuXG4gIF9fdHlwZW5hbWVcbn1cblxuZnJhZ21lbnQgRm9ybVJlbmRlclBhcnRzIG9uIEZvcm1SZW5kZXIge1xuICBpZFxuICBmb3JtQ29udHJvbHMge1xuICAgIGlkZW50aWZpZXJcbiAgICB0aXRsZVxuICAgIF9fdHlwZW5hbWVcbiAgfVxuICBlcnJvck1lc3NhZ2VzXG4gIGZvcm1FcnJvcnMge1xuICAgIG1lc3NhZ2VcbiAgICBmaWVsZEVudHJ5SWRcbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgc2VjdGlvbnMge1xuICAgIHRpdGxlXG4gICAgZGVzY3JpcHRpb25IdG1sXG4gICAgZmllbGRFbnRyaWVzIHtcbiAgICAgIC4uLkZvcm1GaWVsZEVudHJ5UGFydHNcbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgaXNIaWRkZW5cbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgc291cmNlRm9ybURlZmluaXRpb25JZFxuICBfX3R5cGVuYW1lXG59XG5cbmZyYWdtZW50IFNvdXJjaW5nRm9ybVdpdGhGb3JtUmVuZGVyUGFydHMgb24gU291cmNpbmdGb3JtV2l0aEZvcm1SZW5kZXIge1xuICBpZFxuICBvcmdhbml6YXRpb25JZFxuICBzb3VyY2luZ0Zvcm1SZW5kZXIge1xuICAgIC4uLiBvbiBGb3JtUmVuZGVyIHtcbiAgICAgIC4uLkZvcm1SZW5kZXJQYXJ0c1xuICAgICAgX190eXBlbmFtZVxuICAgIH1cbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgcHVibGljVGl0bGVcbiAgZGVzY3JpcHRpb25IZWFkZXJIdG1sXG4gIGRlc2NyaXB0aW9uRm9vdGVySHRtbFxuICBzdWJtaXNzaW9uU3VjY2Vzc01lc3NhZ2VIdG1sXG4gIHN1Ym1pdEJ1dHRvblRleHRcbiAgc2hvd0F1dG9maWxsQm94XG4gIG9yZ2FuaXphdGlvbkJyYW5kIHtcbiAgICBob3N0ZWRKb2JzUGFnZVNsdWdcbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgX190eXBlbmFtZVxufVxuIn0K'
const requestBody=()=>Buffer.from(REQUEST_BASE64,'base64')
const POST_HEADERS=Object.freeze({'Content-Type':'application/json',Accept:'*/*','Cache-Control':'no-store',Pragma:'no-cache'})
// These are the same reviewed closed individual-publication families as the
// frozen Data reader. Cross-model salary/criteria reconciliation stays there.
const API_FIELDS=['id','title','department','team','employmentType','location','secondaryLocations','publishedAt','isListed','isRemote','workplaceType','address','jobUrl','applyUrl','descriptionHtml','descriptionPlain']
const OWN_FIELDS=['id','title','departmentName','departmentExternalName','locationName','locationAddress','workplaceType','employmentType','descriptionHtml','isListed','isConfidential','teamNames','secondaryLocationNames','compensationTierSummary','compensationTiers','applicationDeadline','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','applicationLimitCalloutHtml','shouldAskForTextingConsent','shouldAskForWhatsAppConsent','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','legalEntityNameForTextingConsent','automatedProcessingLegalNotice','__typename']
const LD_FIELDS=['@context','@type','title','description','directApply','identifier','datePosted','hiringOrganization','jobLocation','employmentType','jobLocationType','applicantLocationRequirements']
const SECURITY=['content-security-policy','content-security-policy-report-only','permissions-policy','document-policy','cross-origin-opener-policy','cross-origin-embedder-policy','cross-origin-resource-policy','referrer-policy','x-frame-options','x-content-type-options','strict-transport-security','access-control-allow-origin','access-control-allow-credentials']
const commonOptions=['signal','sourceTimeoutMs','requestTimeoutMs','maxRequests','maxResponseBytes','maxAggregateBytes','onAudit']
const plain=value=>value!==null&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
function optionsModel(value,extra){
  need(plain(value),'options','Plain own-data controller options required')
  const descriptors=Object.getOwnPropertyDescriptors(value),allowed=[...commonOptions,...extra],result={}
  for(const key of Reflect.ownKeys(descriptors)){
    need(typeof key==='string'&&allowed.includes(key)&&Object.hasOwn(descriptors[key],'value'),'options','Unknown/accessor option')
    const item=descriptors[key].value
    if(item!==undefined)Object.defineProperty(result,key,{value:item,enumerable:true})
  }
  return result
}
const limit=(value,fallback,max,label)=>{value??=fallback;need(Number.isSafeInteger(value)&&value>0&&value<=max,'bounds','Invalid downward '+label+' limit');return value}
const callable=value=>typeof value==='function'&&!types.isProxy(value)
const signalAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get
const signalReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get
const listen=(signal,fn)=>EventTarget.prototype.addEventListener.call(signal,'abort',fn,{once:true})
const unlisten=(signal,fn)=>EventTarget.prototype.removeEventListener.call(signal,'abort',fn)
function nativeSignal(value){if(value===undefined)return;need(value&&typeof value==='object'&&!types.isProxy(value),'options','Native AbortSignal required');try{signalAborted.call(value)}catch{need(false,'options','Native AbortSignal required')}}
const aborted=signal=>{if(signalAborted.call(signal))throw signalReason.call(signal)}
const typed=Object.getPrototypeOf(Uint8Array.prototype)
const nativeLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get
const nativeOffset=Object.getOwnPropertyDescriptor(typed,'byteOffset').get
const nativeBuffer=Object.getOwnPropertyDescriptor(typed,'buffer').get
const nativeSet=typed.set
const resizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get
function byteView(value){
  need(value&&!types.isProxy(value)&&types.isUint8Array(value),'ownership','Original byte view required')
  const length=nativeLength.call(value),buffer=nativeBuffer.call(value),offset=nativeOffset.call(value)
  need(!types.isSharedArrayBuffer(buffer)&&!resizable?.call(buffer),'ownership','Shared/resizable bytes are unsupported')
  for(const key of Reflect.ownKeys(value))need(typeof key==='string'&&/^(?:0|[1-9][0-9]*)$/.test(key)&&Number(key)<length,'ownership','Custom byte hooks are unsupported')
  return{length,copy:maximum=>{const size=Math.min(length,maximum),result=new Uint8Array(size);nativeSet.call(result,new Uint8Array(buffer,offset,size),0);return Buffer.from(nativeBuffer.call(result))}}
}
const ownData=(value,key)=>{need(plain(value),'ownership','Plain own-data value required');const d=Object.getOwnPropertyDescriptor(value,key);need(d&&Object.hasOwn(d,'value'),'ownership','Original own data unavailable: '+key);return d.value}
const nativeThen=Promise.prototype.then
const supportedPromise=value=>{
  if(Object.getPrototypeOf(value)!==Promise.prototype)return false
  const descriptors=Object.getOwnPropertyDescriptors(value)
  // Node async-context instrumentation adds own data Symbols. They are never
  // read or used as publication authority. String hooks and every accessor hold.
  return Reflect.ownKeys(descriptors).every(key=>typeof key==='symbol'&&Object.hasOwn(descriptors[key],'value'))
}
function react(value,onValue){
  if(!types.isPromise(value))return onValue(value)
  need(supportedPromise(value),'ownership','Custom Promise hooks/prototypes are unsupported')
  return nativeThen.call(value,onValue)
}
const ignore=operation=>{try{const value=operation();if(types.isPromise(value)&&supportedPromise(value))nativeThen.call(value,()=>{},()=>{})}catch{/* Cleanup/probing must not replace the primary failure. */}}
// Rejection gets one microtask turn to publish already-received raw progress.
// A pending/uncooperative operation is never awaited after cancellation.
function wait(operation,signal,late){
  return new Promise((resolve,reject)=>{
    let settled=false
    const finish=(fn,value)=>{if(settled)return;settled=true;unlisten(signal,abort);fn(value)}
    const abort=()=>queueMicrotask(()=>finish(reject,signalReason.call(signal)))
    listen(signal,abort)
    if(signalAborted.call(signal)){abort();return}
    Promise.resolve().then(operation).then(value=>{if(settled){if(late)ignore(()=>late(value));return}finish(resolve,value)},error=>finish(reject,error))
  })
}
const dataField=(value,key)=>value&&typeof value==='object'&&!types.isProxy(value)?Object.getOwnPropertyDescriptor(value,key)?.value:undefined
function errorFacts(value){
  let name=dataField(value,'name'),message=dataField(value,'message')
  if(value&&typeof value==='object'&&!types.isProxy(value)&&!types.isNativeError(value))try{name=Object.getOwnPropertyDescriptor(DOMException.prototype,'name').get.call(value);message=Object.getOwnPropertyDescriptor(DOMException.prototype,'message').get.call(value)}catch{/* Cleanup/probing must not replace the primary failure. */}
  return{name:typeof name==='string'?name:'Error',message:typeof message==='string'?message.slice(0,65536):typeof value==='string'?value.slice(0,65536):'Hyperscience operation held',
    ...Object.fromEntries(['code','gate','reason','failureKind'].flatMap(key=>typeof dataField(value,key)==='string'?[[key,dataField(value,key)]]:[]))}
}
function safeError(value){
  let native=!!(value&&typeof value==='object'&&!types.isProxy(value)&&types.isNativeError(value))
  if(!native&&value&&typeof value==='object'&&!types.isProxy(value))try{Object.getOwnPropertyDescriptor(DOMException.prototype,'name').get.call(value);native=true}catch{/* Cleanup/probing must not replace the primary failure. */}
  if(native&&Object.isExtensible(value))return value
  const error=Object.assign(new Error(errorFacts(value).message,native?{cause:value}:undefined),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'},errorFacts(value))
  return error
}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
function corporateInitial(record,kind){return readInitialHyperscienceCorporate(record,kind)}
function apiInitial(record,cards){
  const packet=readRawPacket(record,A,'A'),payload=rawJSON(packet.bytes)
  shape(payload,['jobs','apiVersion'],'api')
  need(payload.apiVersion==='1'&&Array.isArray(payload.jobs),'api','Exact complete envelope/string1 required')
  need(payload.jobs.length>=1&&payload.jobs.length<=6&&new Set(payload.jobs.map(j=>j?.id)).size===payload.jobs.length,'membership','Complete unique one..six native vacancies required')
  for(const job of payload.jobs){
    shape(job,API_FIELDS,'api');need(UUID.test(job.id)&&job.isListed===true&&job.jobUrl==='https://jobs.ashbyhq.com/hyperscience/'+job.id&&job.applyUrl===job.jobUrl+'/application','api','Exact listed own/application route required')
    for(const key of ['title','department','team','location'])need(typeof job[key]==='string'&&job[key].length>0&&job[key].length<=1000,'api','Complete authored native role labels required');
    const projection=authoredProjection(job.descriptionHtml).comparisonText;
    need(projection.length>0&&layout(job.descriptionPlain)===projection,'criteria','Complete current HTML/plain source criteria disagree');
    shape(job.address,['postalAddress'],'country');shape(job.address.postalAddress,['addressRegion','addressCountry','addressLocality'],'country');
    need(Object.values(job.address.postalAddress).every(v=>typeof v==='string'&&v.length>0)&&['Remote','Hybrid'].includes(job.workplaceType)&&job.isRemote===true&&Array.isArray(job.secondaryLocations)&&job.secondaryLocations.length===0,'country','Unknown work-country/display/mode publication');
    need(job.employmentType==='FullTime'&&typeof job.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$/.test(job.publishedAt)&&Number.isFinite(Date.parse(job.publishedAt)),'employment-date','Unknown original employment/date')
    const card=cards.find(c=>c.id===job.id)
    need(card&&card.url===job.jobUrl&&['title','department','team','location','employmentType'].every(k=>card[k]===job[k]),'membership','Independent current corporate/API records disagree')
  }
  need(payload.jobs.length===cards.length,'membership','Whole current corporate/API inventories differ')
  return{packet,payload}
}
function ownInitial(record,api){
  const model=readNativePacket(record),native=model.originalAppData.posting,ld=model.originalLD
  shape(native,OWN_FIELDS,'native-model');shape(ld,[...LD_FIELDS,...(Object.hasOwn(ld,'baseSalary')?['baseSalary']:[])],'own-schema')
  need(native.id===api.id&&native.title===api.title&&ld.title===api.title&&ld['@context']==='https://schema.org/'&&ld['@type']==='JobPosting'&&native.__typename==='JobPostingDetails'
    &&native.isListed===true&&native.isConfidential===false&&ld.directApply===false,'own-schema','Own identity/availability/schema differs')
  shape(ld.identifier,['@type','name','value'],'own-schema');need(ld.identifier['@type']==='PropertyValue'&&ld.identifier.name==='Hyperscience'&&ld.identifier.value===api.id,'own-schema','Original role identifier differs')
  shape(ld.hiringOrganization,['@type','name','sameAs','logo'],'own-schema')
  need(ld.hiringOrganization['@type']==='Organization'&&ld.hiringOrganization.name==='Hyperscience'&&ld.hiringOrganization.sameAs==='https://www.hyperscience.ai/'&&ld.hiringOrganization.logo===model.originalAppData.organization.theme.logoSquareImageUrl,'own-schema','Own employer publication differs')
  need(native.descriptionHtml===api.descriptionHtml&&ld.description===api.descriptionHtml&&model.headDescriptions.every(text=>layout(text)===layout(api.descriptionPlain)),'criteria','Complete own/API/schema/head primary differs')
  shape(ld.jobLocation,['@type','address'],'country');shape(ld.jobLocation.address,['@type','addressLocality','addressRegion','addressCountry'],'country');shape(ld.applicantLocationRequirements,['@type','name'],'country')
  need(ld.jobLocation['@type']==='Place'&&ld.jobLocation.address['@type']==='PostalAddress'&&Object.entries(api.address.postalAddress).every(([k,v])=>ld.jobLocation.address[k]===v)
    &&ld.applicantLocationRequirements['@type']==='Country'&&ld.applicantLocationRequirements.name===api.address.postalAddress.addressCountry&&native.locationAddress===null&&native.locationName===api.location
    &&Array.isArray(native.secondaryLocationNames)&&native.secondaryLocationNames.length===0,'country','Unknown/contradictory own work or applicant location')
  need(native.workplaceType===api.workplaceType&&ld.jobLocationType==='TELECOMMUTE'&&native.employmentType==='FullTime'&&ld.employmentType==='FULL_TIME'
    &&native.applicationDeadline===null&&ld.datePosted===api.publishedAt.slice(0,10),'mode','Original own mode/employment/date differs')
  need(native.departmentName===api.department&&native.departmentExternalName===api.department&&Array.isArray(native.teamNames)&&[1,2].includes(native.teamNames.length)&&native.teamNames[0]===api.department&&native.teamNames.at(-1)===api.team,'department','Direct native team path differs')
  for(const key of ['compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])need(native[key]===null,'supplement','New supplemental publication')
  need(native.shouldAskForTextingConsent===false&&native.shouldAskForWhatsAppConsent===false&&native.legalEntityNameForTextingConsent==='Hyper Labs, Inc. dba Hyperscience','supplement','New native consent fields')
  need(Array.isArray(native.compensationTiers),'salary','Full native tiers required')
  for(const tier of native.compensationTiers)shape(tier,['id','title','tierSummary','__typename'],'salary')
  if(native.compensationTierSummary===null)need(native.compensationTiers.length===0&&native.scrapeableCompensationSalarySummary===null&&native.compensationPhilosophyHtml===null&&!Object.hasOwn(ld,'baseSalary'),'salary','Null/absent salary snapshot changed')
  else{
    need(typeof native.compensationTierSummary==='string'&&native.compensationTiers.length===1&&typeof native.scrapeableCompensationSalarySummary==='string'&&typeof native.compensationPhilosophyHtml==='string','salary','Unknown complete salary snapshot')
    authoredCharacters(native.compensationTierSummary);authoredProjection(native.compensationPhilosophyHtml,{philosophy:true})
    need(sha(native.compensationPhilosophyHtml)==='f3bdb85bff4244dc133007eb6c0170a6dacb090313ad5ce0d679c0fe0b062cdf','supplement','New compensation philosophy requires review')
    shape(ld.baseSalary,['@type','currency','value'],'salary');shape(ld.baseSalary.value,['@type','minValue','maxValue','unitText'],'salary')
  }
  // Amount/currency/range/tier agreement and every remaining material field
  // are mandatorily reparsed by the acquired adapter after real Qclose.
  return model
}
const settleNativeTransport=async pending=>{
  if(!types.isPromise(pending)||!supportedPromise(pending))return;
  let timer;
  // Do not assimilate caller-controlled fulfillment/rejection values or inspect
  // a Promise whose own hooks/prototype were rejected by the acquisition path.
  const settled=new Promise(resolve=>nativeThen.call(pending,()=>resolve(),()=>resolve()));
  try{await Promise.race([settled,new Promise(resolve=>{timer=setTimeout(resolve,1000)})])}finally{clearTimeout(timer)}
}
const progressBySignal=new WeakMap()
/** The reader supplies actual {body,receipt}; observation clocks stay separate. */
export async function readCurrentHyperscienceProgramme(options={}){
  const input=optionsModel(options,['readPage']),parent=input.signal;nativeSignal(parent);if(parent)aborted(parent)
  need(callable(input.readPage)&&(input.onAudit===undefined||callable(input.onAudit)),'options','Raw reader/observer must be supported functions')
  const bounds={requests:limit(input.maxRequests,26,26,'request'),entity:limit(input.maxResponseBytes,6291456,6291456,'entity'),aggregate:limit(input.maxAggregateBytes,25165824,25165824,'aggregate'),
    source:limit(input.sourceTimeoutMs,90000,120000,'source deadline'),request:limit(input.requestTimeoutMs,20000,20000,'complete-request deadline')}
  need(bounds.requests>=16,'bounds','The smallest complete programme needs16 attempts')
  const started=performance.now(),controller=new AbortController(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal
  const expire=()=>controller.abort(new DOMException('Hyperscience source deadline exceeded','TimeoutError'))
  const timer=setTimeout(expire,bounds.source)
  const check=()=>{if(parent)aborted(parent);if(performance.now()-started>=bounds.source&&!signalAborted.call(controller.signal))expire();aborted(signal)}
  const audit={source:SOURCE,archiveNativeCollectionEvidence:true,controllerStartedAt:new Date().toISOString(),requests:0,nativeProgrammeRequests:0,rawPages:[],nativePayload:null,nativeRecords:null,partialOwnPublications:[],nonVacancyRecords:[],
    recordKind:'mixed',observedRecordCount:null,observedVacancyCount:null,reportedTotal:null,nativeIndiaCount:null,sourceScopeComplete:false,companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,
    applicantEligibilityQualified:false,legalEmployerQualified:false,rendererConsumptionQualified:false,UIOrApplicationEquivalent:false,applicationVisited:false,screeningCriteriaAcquired:false,
    sourceTimeSemanticsQualified:false,sideEffectFreeInitializationQualified:false,publisherScriptsExecuted:false,lifecycleCleanupAllowed:false,currentTransactionQualified:false,currentDeclaredSourceProgramComplete:false,
    allChannelsClosed:false,allWholeBodiesEqual:null,totalPublicRequests:null,legacyPublicRequestCount:null,countryQualificationScope:'finite-server-published-work-country',
    sourceScope:'Exact current corporate-declared finite server publications only; no global/company/UI/application/eligibility/legal inventory or cleanup claim.',
    requestCountScope:'Attempted declared native responses only; prior primary/discovery reads remain unknown.',protocol:'C0,C1,A,O1..ON,H,M,S,Q,ON..O1,Q,S,M,H,A,C1,C0',bounds,byteReserveLedger:[],openingClosingEquality:[]}
  let aggregate=0,retained=0,closingBytes=0,openingCount=8,openingsFinished=false,N=null,apiModel=null
  const opened=new Map(),opening={},closing={},allowed=new Set([C0,C1,A,H])
  const snapshot=()=>freeze(plainSnapshot({...audit,aggregateBytes:aggregate,retainedBytes:retained,controllerElapsedMs:performance.now()-started}))
  const client=values=>({manifest:values.M,entry:values.S,requestBody:requestBody()})
  const sourceGuard=values=>{check();const result=readHyperscienceFormClientContract({shell:values.H,client:client(values)});check();return result}
  function pendingKinds(){
    const plan=['C0','C1','A',...Array(N??1).fill('O'),'H','M','S','Q']
    return plan.slice(opened.size)
  }
  async function acquire(url,kind,isOpening,apiRow){
    check();need(allowed.has(url),'route','Only a current declared exact route may be requested')
    need(isOpening?!openingsFinished:openingsFinished,'phase','All genuine openings must precede any close')
    const remainingOpen=isOpening?openingCount-opened.size:0
    need(audit.requests+(isOpening?2*remainingOpen+opened.size:opened.size)<=bounds.requests,'bounds','Every pending native opening/closing request must fit')
    const channel=kind==='S'?6291456:kind==='M'?1048576:4194304
    let maximum
    if(isOpening)maximum=Math.min(bounds.entity,channel,Math.floor((bounds.aggregate-aggregate-closingBytes-2*(remainingOpen-1))/2))
    else{
      const previous=opened.get(url);need(previous,'phase','Cannot close an unopened channel')
      need(bounds.aggregate-aggregate>=closingBytes,'bounds','All known closing lengths must remain reserved')
      maximum=Math.min(bounds.entity,channel,previous.body.length,bounds.aggregate-aggregate-(closingBytes-previous.body.length))
    }
    need(maximum>0,'bounds','No complete entity and closing reserve remains')
    audit.byteReserveLedger.push({attempt:audit.requests+1,kind,phase:isOpening?'opening':'closing',aggregateBefore:aggregate,closingReservedBytes:closingBytes,maximumBodyBytes:maximum,
      pendingOpeningKinds:isOpening?pendingKinds():[],pendingClosingKinds:[...opened.values()].map(row=>row.kind),unknownOpeningSizesRemain:isOpening&&remainingOpen>0,
      futureNonemptyOpeningClosingBytes:isOpening?2*(remainingOpen-1):0})
    const observed={kind,phase:isOpening?'opening':'closing',requestedURL:url,controllerRequestedAt:new Date().toISOString(),maximumBodyBytes:maximum,bodyComplete:false}
    audit.rawPages.push(observed);audit.requests=audit.nativeProgrammeRequests=audit.rawPages.length
    const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal]),requestStarted=performance.now()
    const requestExpire=()=>requestController.abort(new DOMException('Hyperscience request deadline exceeded','TimeoutError'))
    const requestTimer=setTimeout(requestExpire,bounds.request)
    const requestCheck=()=>{check();if(performance.now()-requestStarted>=bounds.request&&!signalAborted.call(requestController.signal))requestExpire();aborted(requestSignal)}
    const method=kind==='Q'?'POST':'GET',headers=kind==='Q'?POST_HEADERS:Object.freeze({Accept:kind==='A'||kind==='M'?'application/json':kind==='S'?'text/javascript':'text/html','Cache-Control':'no-store',Pragma:'no-cache'})
    const init=Object.freeze({method,cache:'no-store',credentials:'omit',redirect:'manual',headers,signal:requestSignal,maxBodyBytes:maximum,checkDeadline:requestCheck,...(kind==='Q'?{body:requestBody()}:{})})
    if(kind==='Q')observed.request={method,url,headers:{...POST_HEADERS},bodyBytes:1983,bodySHA256:'26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8',bodyBase64:REQUEST_BASE64}
    let accounted=false,accepting=true,record,pendingRead,transportSettlement
    const settleTransport=()=>transportSettlement??=settleNativeTransport(pendingRead)
    const capture=value=>{
      if(!accepting)return
      const fields=exactFields(value,['body','receipt']),receipt=plainSnapshot(fields.receipt)
      observed.receipt=receipt
      const view=byteView(fields.body),body=view.copy(maximum)
      aggregate+=view.length;retained+=body.length;accounted=true
      Object.assign(observed,{bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:view.length,
        discardedOverflowBytes:view.length-body.length,overflowBytes:view.length-body.length,bodyComplete:view.length<=maximum&&receipt.bodyComplete===true,
        controllerResponseReceivedAt:new Date().toISOString()})
      record={body,receipt}
      need(view.length>0&&view.length<=maximum,'body','Empty/oversized complete response cannot qualify')
    }
    try{
      await wait(()=>{
        const value=input.readPage(url,init)
        if(types.isPromise(value))pendingRead=value
        return react(value,result=>{capture(result);return undefined})
      },requestSignal)
      requestCheck();need(record,'response','Original raw response unavailable')
      const r=record.receipt
      need(r&&typeof r==='object'&&!Array.isArray(r)&&r.requestedURL===url&&r.finalURL===url&&r.method===method&&r.status===200&&r.cache==='no-store'&&r.credentials==='omit'&&r.redirect==='manual','transport','Exact original route/status/options required')
      need(r.bodyComplete===true&&r.streamDone===true&&r.decodedPrefixOnly===false&&(!Object.hasOwn(r,'error')||r.error===null)&&Array.isArray(r.headerEntries),'transport','Actual complete original metadata/Fetch entries required')
      need(Number.isSafeInteger(r.consumedBodyBytes)&&r.consumedBodyBytes===record.body.length&&r.discardedOverflowBytes===0&&r.overflowBytes===0,'transport','Actual measured consumption and each overflow alias required')
      let model
      if(kind==='C0'||kind==='C1')model=corporateInitial(record,kind)
      else if(kind==='A')model=apiInitial(record,opening.C1Model.cards)
      else if(kind==='O'){model=ownInitial(record,apiRow);if(isOpening)audit.partialOwnPublications.push({id:apiRow.id,originalAPI:plainSnapshot(apiRow),originalAppData:plainSnapshot(model.originalAppData),originalLD:plainSnapshot(model.originalLD),headDescriptions:plainSnapshot(model.headDescriptions),fullCrossModelSupplementQualification:false,closingReconciled:false})}
      else if(kind==='H')model=readNativePacket(record,{intake:true})
      else if(kind==='M'||kind==='S')model={packet:readRawPacket(record,url,kind)}
      else{
        // Validate this actually acquired snapshot only. Discard the artificial
        // self-pair; it creates no closing, request, equality or authority fact.
        const self=compareHyperscienceServerFormCriteria({opening:record,closing:record,requestBody:requestBody()})
        model={securityFacts:{original:Object.fromEntries(SECURITY.map(name=>[name,r.headers[name]??null]))}}
        need(self.opening.independentKnownBaselineQualified,'intake','Individual current form snapshot held')
      }
      const packet=model.packet
      if(packet)need(packet.completeTransportMetadataQualified,'transport','Complete actual transport views/clocks required')
      const security=model.securityFacts?.original??packet?.security?.original
      need(security,'security','Qualified original policy snapshot required')
      observed.securityPolicy=plainSnapshot(security);requestCheck()
      if(isOpening){opened.set(url,{body:record.body,receipt:r,security,kind,corporateComparison:['C0','C1'].includes(kind)?hyperscienceCorporateComparison(model):null});closingBytes+=record.body.length}
      else{
        const previous=opened.get(url),equal=record.body.equals(previous.body)
        need(isDeepStrictEqual(security,previous.security),'closing','Original security policy changed')
        if(kind==='C0'||kind==='C1')need(isDeepStrictEqual(hyperscienceCorporateComparison(model),previous.corporateComparison),'closing','Current corporate authored recruitment facts changed')
        else if(kind!=='Q')need(equal,'closing','Whole non-Q source entity changed')
        else{
          check();const pair=compareHyperscienceServerFormCriteria({opening:opening.Q,closing:record,requestBody:requestBody()});check()
          need(pair.serverDefinitionCriteriaEqual,'intake','Actual Q pair criteria differ')
        }
        audit.openingClosingEquality.push({url,kind,openingSHA256:sha(previous.body),closingSHA256:sha(record.body),wholeRawEntityEqual:equal,securityPolicyEqual:true,...(['C0','C1'].includes(kind)?{corporateAuthoredFactsEqual:true,rawStyleTelemetryBrowserEquivalenceQualified:false}:{}),
          rawHeaderViewsEqual:isDeepStrictEqual(previous.receipt.headers,r.headers)&&isDeepStrictEqual(previous.receipt.headerEntries,r.headerEntries),...(kind==='Q'?{serverDefinitionCriteriaEqual:true}:{})})
        closingBytes-=previous.body.length;opened.delete(url)
      }
      observed.controllerCompletedAt=new Date().toISOString();requestCheck();return{record,model}
    }catch(caught){
      await settleTransport()
      // Retain genuine acquired metadata/prefix before final caller ownership
      // is rechecked by finally; opaque caller reasons must still win there.
      const primary=progressBySignal.get(requestSignal)?.primaryFailure?.()
      const error=safeError(primary??caught)
      if(!accounted){
        const state=progressBySignal.get(requestSignal),progress=state?.take()
        if(progress){Object.assign(observed,progress);aggregate+=progress.consumedBodyBytes;retained+=progress.bodyBytes}
      }
      observed.failure=errorFacts(error);observed.controllerCompletedAt=new Date().toISOString();throw error
    }finally{
      accepting=false;clearTimeout(requestTimer);requestController.abort()
      await settleTransport()
      progressBySignal.get(requestSignal)?.seal();progressBySignal.delete(requestSignal)
      if(parent)aborted(parent)
    }
  }
  const full=values=>{check();const result=reconcileHyperscienceAcquiredProgramme({entry:values.C0,positions:values.C1,api:values.A,
    roles:apiModel.payload.jobs.map(job=>values.roles.get(job.jobUrl)),intakeShell:values.H,intakeClient:client(values),intakeOpening:opening.Q,intakeClosing:closing.Q});check();return result}
  try{
    opening.roles=new Map();closing.roles=new Map()
    opening.C0=(await acquire(C0,'C0',true)).record
    const positions=await acquire(C1,'C1',true);opening.C1=positions.record;opening.C1Model=positions.model
    const api=await acquire(A,'A',true);opening.A=api.record;apiModel=api.model;N=apiModel.payload.jobs.length;openingCount=7+N
    audit.nativePayload=plainSnapshot(apiModel.payload);audit.observedVacancyCount=N;audit.observedRecordCount=N+1
    need(2*openingCount<=bounds.requests,'bounds','Every native role and H/M/S/Q closing must fit')
    for(const job of apiModel.payload.jobs){allowed.add(job.jobUrl);opening.roles.set(job.jobUrl,(await acquire(job.jobUrl,'O',true,job)).record)}
    const shell=await acquire(H,'H',true);opening.H=shell.record;const manifestURL=shell.model.declaration.manifestURL;allowed.add(manifestURL)
    opening.M=(await acquire(manifestURL,'M',true)).record;check()
    const selection=readHyperscienceFormSelection({shell:opening.H,manifest:opening.M});check()
    const entryURL=selection.selectedEntry.url;allowed.add(entryURL)
    opening.S=(await acquire(entryURL,'S',true)).record;sourceGuard(opening)
    allowed.add(Q);opening.Q=(await acquire(Q,'Q',true)).record
    openingsFinished=true;audit.allOpeningReadsBeforeClosing=true
    for(const job of [...apiModel.payload.jobs].reverse())closing.roles.set(job.jobUrl,(await acquire(job.jobUrl,'O',false,job)).record)
    sourceGuard(opening);closing.Q=(await acquire(Q,'Q',false)).record
    const openingResult=full(opening);audit.pureOpeningResult=openingResult;audit.nativeRecords=openingResult.nativeRecords;audit.nonVacancyRecords=[openingResult.intake]
    closing.S=(await acquire(entryURL,'S',false)).record
    closing.M=(await acquire(manifestURL,'M',false)).record
    closing.H=(await acquire(H,'H',false)).record
    check();readHyperscienceFormSelection({shell:closing.H,manifest:closing.M});sourceGuard(closing)
    closing.A=(await acquire(A,'A',false)).record
    closing.C1=(await acquire(C1,'C1',false)).record
    closing.C0=(await acquire(C0,'C0',false)).record
    const closingResult=full(closing);audit.pureClosingResult=closingResult
    need(opened.size===0&&closingBytes===0&&audit.requests===14+2*N&&isDeepStrictEqual(openingResult.nativePayload,closingResult.nativePayload),'closing','Full protocol/models/native envelope did not reconcile')
    Object.assign(audit,{allChannelsClosed:true,allWholeBodiesEqual:audit.openingClosingEquality.every(row=>row.wholeRawEntityEqual),QrawEntityEqual:openingResult.intake.comparison.rawEntityEqual,
      QserverDefinitionCriteriaEqual:true,allChannelSecurityEqual:true,nativeIndiaCount:0,completedAt:new Date().toISOString()})
    if(input.onAudit){
      audit.observerStartedAt=new Date().toISOString();check();const copy=plainSnapshot(audit);check()
      await wait(()=>{const value=input.onAudit(copy);need(types.isPromise(value)||value===null||!['object','function'].includes(typeof value),'ownership','Observer async result must be a supported native Promise');return react(value,()=>undefined)},signal)
      check();audit.observerCompletedAt=new Date().toISOString()
    }
    check();audit.currentTransactionQualified=true;audit.currentDeclaredSourceProgramComplete=true
    const final=snapshot();check();const jobs=[]
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:N+1,observedVacancyCount:N,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});check()
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:final,configurable:true});check()
    const result=attachInventoryEvidence(jobs,{status:'complete-inventory',surface:C0,firstParty:true,listingComplete:true,reportedTotal:null,indiaFacetCount:0,lifecycleCleanupAllowed:false,
      pagesFetched:audit.requests,verifiedAt:audit.completedAt,reason:'Complete finite corporate-declared server publications and prospective intake; all original work-country/criteria/source/security closings reconcile. No company/global/applicant/legal/UI/application/cleanup scope.'})
    check();return result
  }catch(caught){
    let error=safeError(caught);audit.currentTransactionQualified=false;audit.currentDeclaredSourceProgramComplete=false;audit.heldAt=new Date().toISOString();audit.failure=errorFacts(error)
    const evidence=snapshot(),existing=Object.getOwnPropertyDescriptor(error,'nativeCollectionEvidence')
    if(existing&&!existing.configurable)error=Object.assign(new Error('Hyperscience finite server programme held',{cause:error}),{softFailure:true,abortRetries:true,failureKind:'coverage_gap'})
    Object.defineProperty(error,'nativeCollectionEvidence',{value:evidence,configurable:true});throw error
  }finally{clearTimeout(timer);controller.abort();if(parent)aborted(parent)}
}

const responseGetter=(response,key)=>{
  need(response&&typeof response==='object'&&!types.isProxy(response),'response','Original Fetch response required')
  const own=Object.getOwnPropertyDescriptor(response,key)
  if(own){need(Object.hasOwn(own,'value'),'ownership','Response accessor unsupported');return own.value}
  const getter=Object.getOwnPropertyDescriptor(Response.prototype,key)?.get
  need(getter,'response','Original Fetch response field required')
  try{return getter.call(response)}catch{need(false,'response','Native Fetch response required')}
}
const readerMethod=(reader,name)=>{
  need(reader&&typeof reader==='object'&&!types.isProxy(reader),'ownership','Native/plain reader required')
  const own=Object.getOwnPropertyDescriptor(reader,name)
  if(own){need(Object.hasOwn(own,'value')&&callable(own.value),'ownership','Reader method accessor/proxy unsupported');return()=>own.value.call(reader)}
  const method=ReadableStreamDefaultReader.prototype[name];need(typeof method==='function','body','Native reader method unavailable');return()=>method.call(reader)
}
function cancelBody(response){
  const body=responseGetter(response,'body')
  if(!body)return
  need(!types.isProxy(body),'ownership','Body Proxy is unsupported')
  const own=Object.getOwnPropertyDescriptor(body,'cancel')
  if(own){need(Object.hasOwn(own,'value')&&callable(own.value),'ownership','Body cancellation accessor/proxy unsupported');return own.value.call(body)}
  return ReadableStream.prototype.cancel.call(body)
}
/** Real bounded Fetch transport; this task exercises it only with controlled
 * injection. No retry, redirect following, publisher execution or child reads. */
export async function runCurrentHyperscienceProgramme(options={}){
  const input=optionsModel(options,['fetchImpl','requestIntervalMs']),parent=input.signal;nativeSignal(parent);if(parent)aborted(parent)
  const fetchImpl=input.fetchImpl??globalThis.fetch,interval=input.requestIntervalMs??500
  need(callable(fetchImpl)&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'options','Supported Fetch and bounded pacing required')
  const forwarded={};for(const key of commonOptions)if(Object.hasOwn(input,key))forwarded[key]=input[key]
  let next=0
  return readCurrentHyperscienceProgramme({...forwarded,readPage:async(url,init)=>{
    if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal})
    init.checkDeadline();next=performance.now()+interval
    const requestedAt=new Date().toISOString(),chunks=[]
    let response,reader,base=null,size=0,discarded=0,complete=false,canceled=false,released=false,sealed=false,pendingResponse,cleanupPromise,metadataFailure
    const current=()=>{const body=Buffer.concat(chunks,size);return{...(base?{receipt:{...base,bodyComplete:false,streamDone:false,decodedPrefixOnly:true,bodyBytes:body.length,bodySHA256:sha(body),
      consumedBodyBytes:size+discarded,discardedOverflowBytes:discarded,overflowBytes:discarded,completedAt:new Date().toISOString()}}:{}),bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),
      bodyComplete:false,streamDone:false,decodedPrefixOnly:true,consumedBodyBytes:size+discarded,discardedOverflowBytes:discarded,overflowBytes:discarded,
      cancellation:{requested:canceled,readerReleaseRequested:released},bodyRepresentation:'Genuinely acquired bounded Fetch-decoded prefix, not a complete entity or raw-wire bytes.'}}
    progressBySignal.set(init.signal,{take:()=>base?current():null,seal:()=>{sealed=true},primaryFailure:()=>metadataFailure})
    const release=()=>{if(released||!reader)return;released=true;ignore(()=>readerMethod(reader,'releaseLock')())}
    const cancel=()=>{
      if(cleanupPromise)return cleanupPromise
      if(!reader&&!response)return Promise.resolve()
      canceled=true
      const owned={cancel:()=>reader?readerMethod(reader,'cancel')():cancelBody(response)}
      cleanupPromise=disposeResponseReader(owned,{bestEffort:true})
      return cleanupPromise
    }
    const abort=()=>{void cancel()}
    const captureHeaders=value=>{
       response=value
      const headersValue=responseGetter(value,'headers')
      need(headersValue&&!types.isProxy(headersValue),'ownership','Native Fetch Headers required')
      let entries;try{entries=[...Headers.prototype.entries.call(headersValue)]}catch{need(false,'response','Native Fetch Headers required')}
      const headers=Object.fromEntries(entries)
      base={source:SOURCE,requestedURL:url,finalURL:responseGetter(value,'url'),status:responseGetter(value,'status'),method:init.method,cache:'no-store',credentials:'omit',redirect:'manual',requestHeaders:{...init.headers},
        requestedAt,responseAt:new Date().toISOString(),headers,headerEntries:entries,...(init.method==='POST'?{requestBodyBytes:1983,requestBodySHA256:sha(requestBody()),requestBodyBase64:REQUEST_BASE64}:{})}
      const fail=(message,failureKind='coverage_gap')=>Object.assign(Error('[hyperscience] '+message),{
        code:'HYPERSCIENCE_NATIVE_METADATA',status:base.status,httpStatus:base.status,
        abortRetries:true,softFailure:failureKind!=='parser_or_contract_error',failureKind,
      })
      try{
        if(base.finalURL!==url)throw fail('Native response URL does not match its declared source','parser_or_contract_error')
        if(!Number.isInteger(base.status)||base.status<100||base.status>599)throw fail('Invalid native HTTP status','parser_or_contract_error')
        if([401,403,429,451].includes(base.status)||isHttpAccessChallenge(headers))throw fail('Native publisher access denied or challenged','blocked_or_access_denied')
        if(base.status!==200)throw fail('Native HTTP '+base.status,base.status>=500?'network_or_timeout':'coverage_gap')
        if(['location','refresh','www-authenticate','proxy-authenticate'].some(key=>Object.hasOwn(headers,key)))throw fail('Native navigation/authentication header')
        const mime=(headers['content-type']??'').split(';')[0].trim().toLowerCase()
        const accepted=url===A||url===Q||url.endsWith('/.vite/manifest.json')?mime==='application/json':/\.js(?:\?|$)/.test(url)?['text/javascript','application/javascript'].includes(mime):mime==='text/html'
        if(!accepted)throw fail('Native declared MIME does not match channel')
      }catch(error){metadataFailure=error;throw error}
    }
    const captureChunk=part=>{
      if(sealed)return
      const done=ownData(part,'done');need(typeof done==='boolean','body','Explicit native stream completion required')
      if(done){complete=true;return}
      const view=byteView(ownData(part,'value')),remaining=Math.max(0,init.maxBodyBytes-size),copy=view.copy(remaining)
      if(copy.length){chunks.push(copy);size+=copy.length}
      discarded+=view.length-copy.length
      need(discarded===0,'body','Streamed response exceeds exact entity/closing reserve')
    }
    try{
      listen(init.signal,abort)
      await wait(()=>{
        const value=fetchImpl(url,{method:init.method,cache:'no-store',credentials:'omit',redirect:'manual',headers:init.headers,signal:init.signal,...(init.method==='POST'?{body:requestBody()}:{})})
        const pending=react(value,async response=>{
          try{captureHeaders(response)}catch(error){await cancel();throw error}
          if(sealed||signalAborted.call(init.signal))await cancel()
        })
        if(types.isPromise(pending))pendingResponse=pending
        return pending
      },init.signal)
      init.checkDeadline();need(base,'response','Original Fetch headers unavailable')
      const advertised=base.headers['content-length']
      need(advertised===undefined||/^\d+$/.test(advertised)&&Number(advertised)<=init.maxBodyBytes,'body','Advertised entity exceeds bounded complete allowance')
      const body=responseGetter(response,'body')
      need(body&&!types.isProxy(body),'body','Native original body stream required')
      try{reader=ReadableStream.prototype.getReader.call(body)}catch{const get=ownData(body,'getReader');need(callable(get),'ownership','Native/plain stream required');reader=get.call(body)}
      init.checkDeadline()
      while(!complete){
        init.checkDeadline()
        await wait(()=>react(readerMethod(reader,'read')(),captureChunk),init.signal)
        init.checkDeadline()
      }
      const bytes=Buffer.concat(chunks,size);init.checkDeadline()
      return{body:bytes,receipt:{...base,bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,
        consumedBodyBytes:bytes.length,discardedOverflowBytes:0,overflowBytes:0,completedAt:new Date().toISOString(),bodyRepresentation:'Complete original Fetch-decoded entity bytes; not raw-wire bytes.'}}
    }finally{
      unlisten(init.signal,abort)
      const disposal=complete?Promise.resolve():cancel()
      await Promise.all([disposal,settleNativeTransport(pendingResponse)])
      release()
      if(parent)aborted(parent)
    }
  }})
}
