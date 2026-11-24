import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader,sha} from './currentTransport20261121.js'
import {CAREERS_URL,readCorporate,readBoard,readRelevantProtocol,readDetailTemplate} from './currentProtocol20261121.js'
import {readAccount,readListing,rowHasIndiaLabel,qualifyRole,same} from './currentModels20261121.js'

export async function collectCurrentFuturism(options={}){
 const io=createCurrentReader(options),held=[],observations=[],passes=[],details=[]
 const budget=options.maxNativeDetails??1000
 if(!Number.isSafeInteger(budget)||budget<0||budget>1000){io.close();throw RangeError('Invalid Futurism detail budget')}
 const acquire=async()=>{
  const pass={};passes.push(pass)
  const corporate=readCorporate(await io.read(CAREERS_URL));pass.corporate=corporate
  const integration=await io.read(corporate.integration,'js')
  const board=readBoard(await io.read(corporate.portal));pass.board=board
  const programmes={integration}
  for(const key of ['controller','encoder','globalClient'])programmes[key]=await io.read(board[key],'js')
  const protocol=readRelevantProtocol(programmes)
  const listTemplate=await io.read(board.listTemplate)
  const detailTemplate=readDetailTemplate(await io.read(board.detailTemplate))
  const accountEnvelope=await io.read(protocol.accountURL,'json');pass.accountEnvelope=accountEnvelope
  const account=readAccount(accountEnvelope);pass.account=account
  const listing=await io.read(protocol.listURL,'json',protocol.listInput);pass.listing=listing
  const rows=readListing(listing);pass.rows=rows
  io.check()
  const state={corporate,board,protocol,account,accountEnvelope,listing,rows,detailTemplate,listTemplateSHA256:sha(listTemplate),programmeProvenance:Object.fromEntries(Object.entries(programmes).map(([key,body])=>[key,{url:key==='integration'?corporate.integration:board[key],sha256:sha(body),bytes:Buffer.byteLength(body)}]))}
  Object.assign(pass,state);return pass
 }
 try{
  const opening=await acquire(),candidates=opening.rows.filter(rowHasIndiaLabel).slice(0,budget),initial=new Map()
  for(const row of opening.rows)if(!candidates.includes(row))held.push({nativeID:row.reqId,reason:rowHasIndiaLabel(row)?'explicit source detail budget; full own JD not acquired':'explicit India worksite not established for this native role',nativeRecord:row})
  for(const row of candidates){
   const envelope=await io.read(opening.protocol.detailURL,'json',opening.protocol.detailInput(row.reqId))
   details.push({nativeID:row.reqId,opening:envelope})
   try{initial.set(row.reqId,qualifyRole(row,envelope,opening.account,{now:typeof options.now==='function'?options.now():options.now}))}
   catch(error){held.push({nativeID:row.reqId,reason:error.message,nativeRecord:row,nativeDetail:envelope})}
   io.check()
  }
  const closing=await acquire(),closingMap=new Map(closing.rows.map(row=>[row.reqId,row]))
  const authorityReconciled=same(opening.corporate,closing.corporate)&&same(opening.board,closing.board)&&same(opening.account,closing.account)&&same(opening.detailTemplate,closing.detailTemplate)
  const listingReconciled=same(opening.listing,closing.listing)
  const jobs=[]
  for(const row of candidates){
   const pair=details.find(pair=>pair.nativeID===row.reqId)
   pair.closing=await io.read(closing.protocol.detailURL,'json',closing.protocol.detailInput(row.reqId))
   const fullDetailsEqual=same(pair.opening.data?.reqDetailsBO,pair.closing.data?.reqDetailsBO)
   const fullRecordEqual=closingMap.has(row.reqId)&&same(row,closingMap.get(row.reqId))
   if(initial.has(row.reqId)&&authorityReconciled&&fullDetailsEqual&&fullRecordEqual)jobs.push(Object.assign(initial.get(row.reqId),{sourceRoleClosingReconciled:true}))
   else if(initial.has(row.reqId))held.push({nativeID:row.reqId,reason:'closing native role, full criteria/application data or employer authority did not reconcile',nativeRecord:row,nativeDetail:pair})
   io.check()
  }
  for(const row of opening.rows)observations.push({nativeID:row.reqId,recordKind:'vacancy',nativeRecord:row,detail:details.find(pair=>pair.nativeID===row.reqId)??null})
  for(const row of closing.rows)if(!opening.rows.some(old=>old.reqId===row.reqId)){observations.push({nativeID:row.reqId,recordKind:'vacancy',nativeRecord:row,detail:null,observedOn:'closing-only'});held.push({nativeID:row.reqId,reason:'closing-only native role lacks opening full JD reconciliation',nativeRecord:row})}
  const limited=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0?jobs.slice(0,options.maxJobs):jobs
  const now=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
  attachSourceObservationEvidence(limited,{source:'futurismtechnologies',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false})
  attachInventoryEvidence(limited,{status:'discovery-only',firstParty:true,surface:CAREERS_URL,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:io.receipts.length,verifiedAt:now,lifecycleCleanupAllowed:false,reason:'Own current native roles independently qualified; employer-wide and India-wide inventory scope not certified'})
  Object.defineProperty(limited,'nativeCollectionEvidence',{value:{source:'futurismtechnologies',recordKind:'vacancy-rows',observedNativeRecords:observations.length,observedRecordCount:observations.length,observedVacancyCount:observations.length,
   qualifiedVacancies:limited.length,nativeIndiaRoleLabels:opening.rows.filter(rowHasIndiaLabel).length,detailBudget:budget,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,listingComplete:false,
   currentNativeClosingReconciled:authorityReconciled&&listingReconciled&&details.length===observations.length&&details.every(pair=>same(pair.opening.data?.reqDetailsBO,pair.closing.data?.reqDetailsBO)),
   selectedRoleDetailsClosingReconciled:details.every(pair=>same(pair.opening.data?.reqDetailsBO,pair.closing.data?.reqDetailsBO)),
   fullRawDetailDataEqual:details.every(pair=>same(pair.opening.data,pair.closing.data)),
   fullRawListingEqual:listingReconciled,fullRawProgrammeEquality:passes[0].programmeProvenance&&same(passes[0].programmeProvenance,passes[1].programmeProvenance),
   authorityReconciled,observations,heldRecords:held,opening:{account:opening.accountEnvelope,listing:opening.listing,programmes:opening.programmeProvenance},closing:{account:closing.accountEnvelope,listing:closing.listing,programmes:closing.programmeProvenance},nativeRoleDetails:details,
   applicationEvidence:{activeNativeApplyURL:true,browserExecuted:false,formSubmitted:false},requests:io.receipts,
  },configurable:true})
  io.check();return limited
 }catch(error){
  options.signal?.throwIfAborted()
  const prefixRows=[...(passes[0]?.rows??[])]
  for(const row of passes[1]?.rows??[])if(!prefixRows.some(old=>old.reqId===row.reqId))prefixRows.push(row)
  const prefixObservations=prefixRows.map(row=>({nativeID:row.reqId,recordKind:'vacancy',nativeRecord:row,detail:details.find(pair=>pair.nativeID===row.reqId)??null}))
  const prefixHeld=[...held,...prefixRows.filter(row=>!held.some(hold=>hold.nativeID===row.reqId)).map(row=>({nativeID:row.reqId,reason:'acquired native observation; closing acquisition failed before qualification could be returned',nativeRecord:row}))]
  if(error instanceof Error&&Object.isExtensible(error))Object.defineProperty(error,'nativeCollectionEvidence',{value:{source:'futurismtechnologies',recordKind:'vacancy-rows',observedNativeRecords:passes[0]?.rows?prefixRows.length:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,currentNativeClosingReconciled:false,observations:prefixObservations,heldRecords:prefixHeld,opening:passes[0]??null,closing:passes[1]??null,partialAcquisitionPasses:passes,nativeRoleDetails:details,requests:io.receipts},configurable:true})
  throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
