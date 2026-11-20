import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {createCurrentReader} from './currentRead20261120.js'
import {flightDocument,geography} from './data20261107.js'

const SOURCE='cribl',ROOT='https://cribl.io/careers/',API='https://boards-api.greenhouse.io/v1/boards/cribl/jobs?content=true'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message,{failureKind:'parser_or_contract_error'})}
function authority(html){
 const d=readNativeDocument(html),canonical=d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical'))
 need(canonical.length===1&&canonical[0].attrs.href===ROOT,'current own canonical publisher differs');need(activeHead(html).titles.some(t=>/careers/i.test(t)&&/Cribl/.test(t)),'current own careers publisher unavailable')
 const flight=flightDocument(html),owners=flight.elements.filter(e=>e[3]?.sectionId==='open-roles');need(d.nodes(n=>n.tag==='section'&&n.attrs.id==='open-roles').length===1&&owners.length===1,'current active native openings owner unavailable')
 const binding=flight.imports.get(owners[0][1].slice(2));need(Array.isArray(binding)&&binding[2]==='default','current openings component declaration unavailable')
 return{url:ROOT,publisher:'Cribl',ownOpeningOwnerObserved:true,currentComponentImport:binding,componentProps:owners[0][3],nativePublicClientDataflowQualified:false,programmesExecuted:false,legalEmployer:null}
}
function nativeFeed(text){let data;try{data=JSON.parse(text)}catch(cause){throw firstPartyFailure(SOURCE,'malformed complete200 registered native board JSON',{failureKind:'parser_or_contract_error',cause})}need(data&&Array.isArray(data.jobs)&&data.jobs.length<=10000,'registered native board lead shape changed');const ids=new Set();for(const row of data.jobs){need(row&&Number.isSafeInteger(row.id)&&row.id>0&&!ids.has(row.id)&&typeof row.title==='string'&&row.title.trim(),'registered native lead identity unavailable or duplicated');ids.add(row.id)}return data}
export async function runCurrentScope(options={}){
 options.signal?.throwIfAborted();const at=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid observation clock')
 const reader=createCurrentReader(options,u=>[ROOT,API].includes(u)),responses=[]
 const read=async(url,phase)=>{const p=await reader.read(url,{kind:url===API?'json':'html',phase});responses.push({...p,requestedUrl:url,phase});return p.text}
 try{
  const openingPublisher=authority(await read(ROOT,'opening')),opening=nativeFeed(await read(API,'opening')),closingPublisher=authority(await read(ROOT,'closing')),closing=nativeFeed(await read(API,'closing'))
  need(openingPublisher.publisher===closingPublisher.publisher,'current own publisher changed');const owned=opening.jobs.filter(r=>r.company_name==='Cribl'),foreignOrUnknownEmployer=opening.jobs.filter(r=>r.company_name!=='Cribl'),countries=owned.map(r=>({id:r.id,...geography(r.location?.name??'')})),jobs=[]
  // Observation only. The registered account remains a lead until its current
  // client, role/application and every workplace are independently qualified.
  // Plain office names and the Corporation address never supply countries.
  const audit={source:SOURCE,scopeDisposition:'unresolved-native-scope',observedRecordCount:opening.jobs.length,observedVacancyCount:owned.length,openingPublisher,closingPublisher,nativeOpeningFeed:opening,nativeClosingFeed:closing,currentOpeningClosingNativeModelsEqual:isDeepStrictEqual(opening,closing),registeredNativeBoardObserved:true,currentNativeClientDataflowQualified:false,observedNativeEnvelopeTotal:opening.meta?.total??null,observedNativeEnvelopeConsistent:Number.isSafeInteger(opening.meta?.total)&&opening.meta.total===opening.jobs.length,writtenWorkplaceObservations:countries,knownWrittenIndiaLeadCount:countries.filter(r=>r.country==='India').length,knownWrittenForeignLeadCount:countries.filter(r=>r.country&&r.country!=='India').length,unknownWrittenCountryLeadCount:countries.filter(r=>r.country===null).length,otherOrUnknownEmployerLeads:foreignOrUnknownEmployer,officesAndCorporateAddressesUsedAsWorkplaceCountry:false,positiveRoleQualificationRequired:true,applicationBindingQualified:false,originalResponses:responses,nativeTransport:reader.stats(),sourceScopeComplete:false,sourceListingComplete:false,companyInventoryQualified:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,applicationsSubmitted:false}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:audit.observedRecordCount,observedVacancyCount:audit.observedVacancyCount,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await reader.callback(options.onAudit,structuredClone(audit));reader.check();const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:ROOT,firstParty:true,listingComplete:false,pagesFetched:responses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,lifecycleCleanupAllowed:false,reason:'current-own-careers-and-complete-original-registered-board-leads-retained;unknown-written-workplaces-and-current-client-role-application-binding-unqualified;no-authoritative-India-zero'});reader.check();return result
 }catch(error){reader.check();if(error&&typeof error==='object')Object.assign(error,{sourceAudit:{source:SOURCE,scopeDisposition:'unresolved-native-scope',originalResponses:responses,nativeTransport:reader.stats(),sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false}});throw error}finally{reader.close()}
}
