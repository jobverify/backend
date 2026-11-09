import {inspectSuppliedOriginal} from './supplied20261108.js'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {settingsFor,runtime,bounded,annotateFailure} from './runtime20261108.js'
import {nativeTransport} from './transport20261108.js'
import {PRIMARY,need,parsePage,rowFor,keyFor} from './data20261108.js'
const failures=new WeakMap(),sha=raw=>createHash('sha256').update(raw).digest('hex')
export const readZietaFailureEvidence=signal=>{const value=failures.get(signal);return value?structuredClone(value):null}
export const createZietaNativeScraper=(defaults={})=>({run:async(options={})=>{
 const settings=settingsFor(defaults,options),countryFilter=settings.countryFilter??'Global';need(['Global','India','United States'].includes(countryFilter),'unsupported country selection')
 const control=runtime(settings),responses=[],entries=new Map(),openingRecords=[],closingRecords=[];let opening=null,closing=null,rows=[],phase='opening',observedAt=null,admissionAt=null,nextStart=-Infinity
 const clock=()=>{control.check();const value=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(+value),'invalid observation clock');control.check();return value.toISOString()}
 const supplied=settings.fetchPage??settings.fetchText
 const fetchImpl=settings.fetchImpl??globalThis.fetch
 const read=async url=>{
  control.check();const at=Math.max(performance.now(),nextStart);nextStart=at+(settings.rateLimitMs??500);const wait=at-performance.now();if(wait>0){try{await delay(wait,undefined,{signal:control.signal})}catch(error){control.check();throw error}}control.check();control.admit();let receipt=null
  const retain=p=>{if(!receipt){receipt={requestedURL:url,phase,response:p};responses.push(receipt)}}
  const packet=supplied?await control.read(async(signal,check)=>{const localReadStartedAt=new Date().toISOString(),p=await supplied(url,{method:'GET',redirect:'manual',credentials:'omit',signal});check();return inspectSuppliedOriginal(p,url,{check,onReceipt:retain,localReadStartedAt})}):await nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl,callerSignal:settings.signal,onReceipt:retain})(url,{signal:control.signal})
  control.check();need(packet.bodyComplete,'incomplete native entity');packet.bodySHA256=sha(Buffer.from(packet.rawBodyBase64,'base64'));return packet.body
 }

 const collect=async()=>{
  const value=parsePage(await read(PRIMARY),(model,qualification)=>{const records=phase==='opening'?openingRecords:closingRecords;records.push(structuredClone(model));const key=keyFor(model,records.length-1);if(!entries.has(key))entries.set(key,{opening:null,closing:null,openingQualification:null,closingQualification:null});const entry=entries.get(key);entry[phase]=structuredClone(model);entry[phase+'Qualification']=structuredClone(qualification)})
  for(let i=0;i<value.records.length;i++){const entry=entries.get(keyFor(value.records[i],i));entry[phase+'Qualification']=structuredClone(value.qualifications[i])}
  return value
 }
 const baseRows=()=>[...entries].map(([key,e])=>{const model=e.opening??e.closing,row=rowFor(model,e.openingQualification??e.closingQualification??{});return {...row,nativeObservationKey:key,sourceNativeRecord:structuredClone(e.opening),sourceNativeClosingRecord:structuredClone(e.closing),sourceNativeClosingOwnDescriptionHTML:e.closing?.roleHTML??null,scrapedAt:observedAt}})
 const snapshot=()=>({source:'zietatechnologies',recordKind:'vacancy-rows',observedAt,admissionAt,opening,closing,openingRecords,closingRecords,observations:rows.length?rows:baseRows(),rawResponses:responses,observedRoleCount:entries.size,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,publicationDateKnown:false,activeHiringVerified:false,applicationActions:0,publisherProgramsExecuted:false})
 const refresh=()=>{
  control.check();admissionAt=clock();rows=baseRows();const cohort=Boolean(opening&&closing)&&isDeepStrictEqual(opening.records.map(keyFor),closing.records.map(keyFor))
  for(const row of rows){const e=entries.get(row.nativeObservationKey),pair=Boolean(e.opening&&e.closing)&&isDeepStrictEqual(e.opening,e.closing)&&cohort,contract=Boolean(e.openingQualification?.contractQualified&&e.closingQualification?.contractQualified),visible=Boolean(e.openingQualification?.visibilityQualified&&e.closingQualification?.visibilityQualified);Object.assign(row,{sourceNativePairQualified:pair,sourceNativeContractQualified:contract,sourceNativeAdvertisementPairObserved:pair&&contract,sourceNativeCriteriaVisibilityQualified:visible,sourceNativeCurrentPublicationQualified:pair&&contract&&visible,sourceCurrentNativeRoleQualified:pair&&contract&&visible&&!row.sourceCountryScopeUnresolved,sourceDetailComplete:pair&&contract&&visible,sourceNativeAdmissionAt:admissionAt,sourceNativeIssues:[...(pair?[]:['native-opening-closing-model-incomplete-or-changed']),...(contract?[]:['unreviewed-native-role-structure-or-metadata']),...(visible?[]:['native-criteria-rendered-visibility-unqualified']),'native-primary-workplace-and-country-unresolved']})}control.check()
 }
 try{
  observedAt=clock();opening=await collect();phase='closing';closing=await collect();need(isDeepStrictEqual(opening.records.map(keyFor),closing.records.map(keyFor)),'native closing cohort changed');refresh()
  await bounded(async(signal,check)=>{const guard=()=>{control.check();check()};guard();if(settings.onAudit){const value=structuredClone(snapshot());guard();await settings.onAudit(value,{signal},guard);guard();refresh()}if(settings.onRecords){const value=structuredClone(rows);guard();await settings.onRecords(value,{signal},guard);guard();refresh()}},{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'ZIETA_AUDIT_TIMEOUT'});control.check();refresh()
  const selected=rows.filter(row=>row.sourceNativeCurrentPublicationQualified&&(countryFilter==='Global'||row.country===countryFilter||row.sourceCountryScopeUnresolved)),jobs=structuredClone(settings.maxJobs===null?selected:selected.slice(0,settings.maxJobs));control.check();const audit=structuredClone(snapshot());control.check();Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit});Object.defineProperty(jobs,'sourceAudit',{value:audit});attachSourceObservationEvidence(jobs,{...audit,observedRecordCount:rows.length,observedVacancyCount:rows.length})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PRIMARY,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:control.requests,verifiedAt:admissionAt,reason:'complete-original-native-advertisement-observations;primary-workplace-country-rendered-criteria-hiring-application-and-company-scope-unqualified'})
 }catch(cause){rows=baseRows().map(v=>({...v,sourceNativeCurrentPublicationQualified:false,sourceCurrentNativeRoleQualified:false,sourceDetailComplete:false,incompleteCollection:true}));const evidence=structuredClone(snapshot());if(settings.signal?.aborted){failures.set(settings.signal,evidence);throw settings.signal.reason}throw annotateFailure(cause,{source:'zietatechnologies',nativeEvidence:evidence,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}finally{control.close()}
}})
