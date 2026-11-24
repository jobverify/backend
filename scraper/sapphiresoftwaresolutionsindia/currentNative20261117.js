import {isDeepStrictEqual} from 'node:util'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createSapphireNativeReader,CAREERS,LIST} from './nativeReader20261117.js'
import {readCurrentSapphireProgramme} from './currentProgramme20261121.js'
const SOURCE='sapphiresoftwaresolutionsindia'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
function corporate(body){
 const doc=readNativeDocument(body),inputs=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')
 need(JSON.stringify(activeHead(body).titles)==='["Career at Sapphire Software Solutions"]'&&inputs.length===1&&!doc.nodes(n=>n.tag==='base').length,'Current employer careers identity/model changed')
 const input=JSON.parse(inputs[0].raw)
 const programs=doc.nodes(n=>n.tag==='script'&&!n.inert&&!n.nativeTagUnqualified&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|text\/javascript|application\/javascript)$/i.test(n.attrs.type??'')&&/^\/_next\/static\/chunks\/pages\/careers-[a-f0-9]+\.js$/.test(n.attrs.src??''))
 need(input.page==='/careers'&&programs.length===1&&doc.nodes(n=>n.tag==='a'&&!n.inert&&n.attrs.href==='/contact-jobs'&&doc.text(n)==='Apply Here').length===1,'Current careers own client/intake declaration changed')
 return {title:activeHead(body).titles[0],clientURL:new URL(programs[0].attrs.src,CAREERS).href,nativeNextInput:input,generalIntakeURL:'https://www.sapphiresolutions.net/contact-jobs',wholeAuthoredText:doc.text(doc.nodes(n=>n.tag==='root')[0]),wholeOriginalHTML:body}
}
export function readCurrentSapphireListing(body){
 const payload=JSON.parse(body)
 need(payload?.statusCode===1&&payload.statusMessage==='Success'&&Array.isArray(payload.vacancyList),'Declared native vacancy response changed')
 const seen=new Set()
 for(const record of payload.vacancyList){
  need(record&&typeof record==='object'&&!Array.isArray(record)&&Number.isSafeInteger(record.vacancyId)&&record.vacancyId>0&&!seen.has(record.vacancyId)&&typeof record.position==='string'&&record.position.trim()&&typeof record.applyURL==='string','Native vacancy identity/card changed')
  seen.add(record.vacancyId)
  const parsed=new URL('/jobs/'+record.applyURL,'https://www.sapphiresolutions.net')
  need(parsed.origin==='https://www.sapphiresolutions.net'&&['/jobs/developer-hiring','/jobs/non-developer-hiring'].includes(parsed.pathname)&&parsed.searchParams.getAll('vno').length===1&&parsed.searchParams.get('vno')===String(record.vacancyId)&&parsed.searchParams.getAll('position').length===1&&parsed.searchParams.get('position')===record.position.replace(/\s+/g,'')&&/^position=[A-Za-z]+&vno=\d+$/.test(parsed.search.slice(1))&&!parsed.hash,'Exact native own role/application URL changed')
 }
 return {payload,rows:payload.vacancyList}
}
export async function runCurrentSapphire(options={}){
 options.signal?.throwIfAborted();const reader=createSapphireNativeReader(options);let opening,closing,detailFailure,detailObservation
 const round=async()=>{
  const own=corporate((await reader.read(CAREERS)).body);reader.allowProgramme(own.clientURL)
  const client=await reader.read(own.clientURL),nativeProgramme=readCurrentSapphireProgramme(client.body)
  need(nativeProgramme.apiOrigin+nativeProgramme.route===LIST,'Current declared native vacancy authority changed')
  const listing=readCurrentSapphireListing((await reader.read(LIST)).body)
  return {corporate:own,wholeNativeClient:client.body,nativeProgramme,wholeNativeListing:listing.payload,rows:listing.rows}
 }
 try{
  opening=await round()
  if(opening.rows.length){
   const url=new URL('/jobs/'+opening.rows[0].applyURL,'https://www.sapphiresolutions.net').href;reader.allowDetail(url)
   try{detailObservation={url,wholeOriginalHTML:(await reader.read(url)).body,fullOwnRoleCriteriaQualified:false}}
   catch(error){options.signal?.throwIfAborted();reader.check();if(error.failureKind!=='blocked_or_access_denied')throw error;detailFailure={url,status:error.status,httpStatus:error.httpStatus,failureKind:error.failureKind,accessChallenge:error.accessChallenge,message:error.message}}
  }
  // The actual historical own-detail denial must stop all further reads to
  // that publisher host. The independently declared API host can still close
  // its complete cohort; that is never a closed corporate/detail proof.
  if(detailFailure){const listing=readCurrentSapphireListing((await reader.read(LIST)).body);closing={wholeNativeListing:listing.payload,rows:listing.rows,corporate:null,nativeProgramme:null,wholeNativeClient:null}}
  else closing=await round()
  need(isDeepStrictEqual(opening.wholeNativeListing,closing.wholeNativeListing),'Closing whole native vacancy input changed')
  if(!detailFailure)need(isDeepStrictEqual(opening.nativeProgramme,closing.nativeProgramme)&&isDeepStrictEqual(opening.corporate.nativeNextInput,closing.corporate.nativeNextInput)&&opening.corporate.wholeAuthoredText===closing.corporate.wholeAuthoredText,'Closing native recruitment declaration/authored text changed')
  reader.check();const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,nativeOpening:opening,nativeClosing:closing,wholeObservedNativeCohortClosingReconciled:true,wholeCareerProgramClosingReconciled:false,recruitmentProgrammeClosingReconciled:!detailFailure,corporateClosingReconciled:!detailFailure,wholeCareerProgramByteEqualityClaimed:false,originalUnexecutedProgrammeRetained:true,entireDocumentReconciled:false,detailFailure,detailObservation,
   observations:opening.rows.map(record=>({nativeRecord:structuredClone(record),sourceUrl:new URL('/jobs/'+record.applyURL,'https://www.sapphiresolutions.net').href,country:null,nativeLocation:record.location,fullOwnRoleCriteriaQualified:false,publicApplicationEligibilityQualified:false,nativeActiveFlagInterpreted:false,holdReasons:['explicit-native-work-country-unqualified','full-own-detail-criteria-and-application-eligibility-unqualified',...(detailFailure?.url===new URL('/jobs/'+record.applyURL,'https://www.sapphiresolutions.net').href?['own-detail-route-publisher-access-denied']:['own-detail-not-observed-or-unqualified'])]})),
   originalResponses:reader.stats().receipts,lifecycleCleanupAllowed:false,legacyCityCountryInferenceUsed:false,companyIndiaZeroProven:false,publicApplicationEligibilityQualified:false},configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-employer-declared-native-bodyless-POST-vacancy-cohort-reconciled;country-own-details-application-and-company-scope-unqualified'})
  reader.check();return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{configurable:true,value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,detailFailure,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null}})}catch{/* Preserve the primary source failure if audit attachment is unavailable. */}throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
