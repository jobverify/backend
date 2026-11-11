import {createHash} from 'node:crypto'
import {HOME,CAREERS,SEARCH,CLIENT,CORE,parseCargillSearch,buildCargillSearchURL,parseCargillPage,parseCargillOfficialRole,parseCargillRmkDetail,CargillSameCountryWorksiteDisagreement,CargillNativeWithdrawnRole,CargillSameCountryPublicOfficeIncomplete} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {cargillGuardError,tagCargillError,cargillHttpCode,cargillTransportCode,parseCargillJson,parseCargillAtStage} from './nativeErrors.js'
const prove=(ok,message,code)=>{if(!ok){const error=cargillGuardError('RUN',message);if(code)Object.defineProperty(error,'code',{value:code,writable:true,configurable:true,enumerable:true});throw error}}
export async function runNativeCargill(options={}){
 prove(options.maxJobs==null,'Truncated native extraction is not permitted');const fetchImpl=options.fetchImpl??globalThis.fetch,timeoutMs=options.timeoutMs??180000,now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();prove(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isFinite(Date.parse(now)),'Invalid bounded extraction options')
 const c=new AbortController(),timer=setTimeout(()=>c.abort(tagCargillError(Error('Cargill source deadline'),'CARGILL_RUN_SOURCE_DEADLINE')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,c.signal]):c.signal,abort=()=>{try{signal.throwIfAborted()}catch(error){throw tagCargillError(error,'CARGILL_RUN_ABORTED')}}
 const receipts=[]
 async function bounded(fn){
  abort();let listener,settlementTimer
  const operation=Promise.resolve().then(fn)
  try{return await Promise.race([operation,new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})])}
  catch(error){
   if(signal.aborted)await Promise.race([
    operation.then(()=>{},()=>{}),
    new Promise(resolve=>{settlementTimer=setTimeout(resolve,1000)}),
   ])
   throw error
  }finally{clearTimeout(settlementTimer);signal.removeEventListener('abort',listener);abort()}
 }
 async function get(url,kind){const receipt={sequence:receipts.length+1,requestUrl:url,stage:kind};receipts.push(receipt);let r;try{r=await bounded(()=>fetchImpl(url,{signal,headers:{Accept:'text/html,application/json,application/javascript','User-Agent':'Mozilla/5.0'},redirect:'follow'}))}catch(error){throw tagCargillError(error,cargillTransportCode('fetch',kind,error))}Object.assign(receipt,{status:r.status,finalUrl:r.url,contentType:r.headers?.get?.('content-type')??null});try{prove(r.status===200,'Native HTTP failure',cargillHttpCode(kind,r.status));if(kind==='careers')prove(r.url===CAREERS+'en','Current official careers redirect changed');else if(kind==='sap')prove(new URL(r.url).origin==='https://jobs.cargill.com','Current SAP application handoff changed');else prove(r.url===url,'Native final URL changed');}catch(error){Object.assign(error,{status:r.status,requestUrl:url,finalUrl:r.url,stage:kind});if([202,401,403,429,451].includes(r.status))Object.assign(error,{softFailure:true,upstreamOutage:false,failureKind:'blocked_or_access_denied',abortRetries:true});error.message+='; HTTP '+r.status+' at '+kind+' for '+url+'; final URL '+r.url;throw error}let body;try{body=await bounded(()=>r.text())}catch(error){throw tagCargillError(error,cargillTransportCode('body',kind,error))}prove(typeof body==='string'&&body.length<=3000000,'Native body invalid');Object.assign(receipt,{decodedBodyBytes:Buffer.byteLength(body),decodedBodySha256:createHash('sha256').update(body).digest('hex')});return{body,url:r.url,receipt}}
 try{
  const home=await get(HOME,'home'),careers=await get(CAREERS,'careers'),search=await get(SEARCH,'search'),client=await get(CLIENT,'client'),core=await get(CORE,'core'),surface=parseCargillAtStage(()=>parseCargillSearch(home.body,careers.body,search.body,client.body,core.body),'bootstrap'),rows=[]
  const pages=Math.ceil(surface.total/15);for(let page=1;page<=pages;page++){const body=(await get(buildCargillSearchURL(page,surface.total),'listing')).body;rows.push(...parseCargillAtStage(()=>parseCargillPage(parseCargillJson(body,'listing'),page,surface.total),'listing').jobs)}
  prove(rows.length===surface.total&&new Set(rows.map(j=>j.publicJobId)).size===rows.length,'Native all-page identity/count drift')
  const jobs=[],heldRoles=[],heldErrors=[],roleProofs=[];for(let i=0;i<rows.length;i+=3){
   let failed=false,firstFailure
   const settled=await Promise.allSettled(rows.slice(i,i+3).map(async row=>{
    try{
     const publicResponse=await get(row.sourceUrl,'official'),official=parseCargillAtStage(()=>parseCargillOfficialRole(publicResponse.body,row,{now,deferIncompletePublicOffice:true}),'official'),native=await get(official.applicationURL,'sap')
     let model,holdError,withdrawalProof
     try{model=parseCargillAtStage(()=>parseCargillRmkDetail(native.body,native.url,official,{now}),'sap')}
     catch(error){if(!(error instanceof CargillSameCountryWorksiteDisagreement)&&!(error instanceof CargillNativeWithdrawnRole)&&!(error instanceof CargillSameCountryPublicOfficeIncomplete))throw error;holdError=error;model=error.validatedModel;withdrawalProof=error.withdrawalProof}
     const identity={jobId:official.requisitionId,nativeRmkPublicId:withdrawalProof?.nativeRmkPublicId??model.nativeRmkPublicId}
     const proof={row:structuredClone(row),officialModel:official,identity,...(withdrawalProof?{withdrawalProof}:{validatedModel:model}),publicReceipt:publicResponse.receipt.sequence,nativeReceipt:native.receipt.sequence}
     if(holdError)return{proof,holdError,hold:{...proof,requisitionId:official.requisitionId,code:holdError.code,disposition:withdrawalProof?'held-unpublished-native-filled-notice':holdError instanceof CargillSameCountryPublicOfficeIncomplete?'held-unpublished-incomplete-public-office':'held-unpublished-same-country-worksite-disagreement',
      publicResponse:{url:publicResponse.url,body:publicResponse.body},nativeResponse:{url:native.url,body:native.body}}}
     return{proof,job:model}
    }
    catch(error){if(!failed){failed=true;firstFailure=error;c.abort(error)}throw error}
   }))
   if(failed)throw firstFailure
   for(const {value} of settled){roleProofs.push(value.proof);if(value.hold){heldRoles.push(value.hold);heldErrors.push(value.holdError)}else jobs.push(value.job)}
  }
  prove(roleProofs.length===rows.length&&new Set(roleProofs.map(p=>p.identity.jobId)).size===rows.length&&new Set(roleProofs.map(p=>p.identity.nativeRmkPublicId)).size===rows.length,'Native cross-surface duplicate requisitions')
  const final=[];for(let page=1;page<=pages;page++){const body=(await get(buildCargillSearchURL(page,surface.total),'recheck')).body;final.push(...parseCargillAtStage(()=>parseCargillPage(parseCargillJson(body,'recheck'),page,surface.total),'recheck').jobs)}
  prove(JSON.stringify(rows)===JSON.stringify(final),'Native full India-filter inventory drift');abort()
  const withdrawnRoles=heldRoles.filter(hold=>hold.withdrawalProof)
  const incompleteOfficeRoles=heldRoles.filter(hold=>hold.code==='CARGILL_SAME_COUNTRY_PUBLIC_OFFICE_INCOMPLETE')
  const worksiteDisagreementRoles=heldRoles.filter(hold=>hold.code==='CARGILL_SAME_COUNTRY_WORKSITE_DISAGREEMENT')
  for(const hold of [...incompleteOfficeRoles,...worksiteDisagreementRoles]){
   const HoldType=hold.code==='CARGILL_SAME_COUNTRY_PUBLIC_OFFICE_INCOMPLETE'?CargillSameCountryPublicOfficeIncomplete:CargillSameCountryWorksiteDisagreement
   const publicClosing=await get(hold.row.sourceUrl,'official')
   const closingOfficial=parseCargillAtStage(()=>parseCargillOfficialRole(publicClosing.body,hold.row,{now,deferIncompletePublicOffice:true}),'official')
   prove(JSON.stringify(closingOfficial)===JSON.stringify(hold.officialModel),'Incomplete public office model changed at closing')
   const nativeClosing=await get(closingOfficial.applicationURL,'sap')
   let closingModel
   try{parseCargillAtStage(()=>parseCargillRmkDetail(nativeClosing.body,nativeClosing.url,closingOfficial,{now}),'sap')}
   catch(error){if(!(error instanceof HoldType))throw error;closingModel=error.validatedModel}
   prove(closingModel&&JSON.stringify(closingModel)===JSON.stringify(hold.validatedModel),'Incomplete public office native proof changed at closing')
   hold.publicClosingResponse={url:publicClosing.url,body:publicClosing.body,receipt:publicClosing.receipt.sequence}
   hold.nativeClosingResponse={url:nativeClosing.url,body:nativeClosing.body,receipt:nativeClosing.receipt.sequence}
  }
  for(const hold of withdrawnRoles){
   const closing=await get(hold.officialModel.applicationURL,'sap')
   let proof
   try{parseCargillAtStage(()=>parseCargillRmkDetail(closing.body,closing.url,hold.officialModel,{now}),'sap')}
   catch(error){if(!(error instanceof CargillNativeWithdrawnRole))throw error;proof=error.withdrawalProof}
   prove(proof&&JSON.stringify(proof)===JSON.stringify(hold.withdrawalProof),'Native withdrawn role status/identity changed at closing')
   hold.nativeClosingResponse={url:closing.url,body:closing.body,receipt:closing.receipt.sequence}
  }
  const observedVacancies=rows.length-withdrawnRoles.length
  for(const job of jobs){job.sourceObservedIndiaJobCount=observedVacancies;job.sourceObservedAdvertisedIndiaRowCount=rows.length;job.sourceGlobalJobCount=null;job.sourceNativeFacet='India country 1269750';job.sourceDisplayedGlobalCount=surface.globalDisplayedTotal;job.lifecycleCleanupAllowed=false}
  const observations={source:'cargill',recordKind:withdrawnRoles.length?'mixed':'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:observedVacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const audit={...observations,verifiedAt:now,observedNativeRecords:rows.length,returnedNativeRecords:jobs.length,fullyQualifiedNativeRecords:jobs.filter(job=>job.sourceDetailComplete).length,
   heldRoles,nativeWithdrawnRecords:withdrawnRoles.length,incompletePublicOfficeRecords:incompleteOfficeRoles.length,worksiteDisagreementRecords:heldRoles.length-withdrawnRoles.length-incompleteOfficeRoles.length,rawOpeningRows:structuredClone(rows),rawClosingRows:structuredClone(final),roleProofs,receipts,closingInventoryMatches:true,lifecycleCleanupAllowed:false,
   candidateDetails:rows.length,extractedDetailJobs:jobs.length,jobs:jobs.map(job=>({id:job.jobId})),failures:heldRoles.map(hold=>({jobId:hold.requisitionId,code:hold.code}))}
  if(options.onAudit)await bounded(()=>options.onAudit(audit))
  // No candidate surviving the guard is still a real source failure, never an
  // empty-success/India-absence claim. Retain the complete audit on that guard.
  if(!jobs.length){const error=heldErrors[0];prove(error,'Native validated role cohort unavailable');error.nativeCollectionEvidence=audit;throw error}
  attachSourceObservationEvidence(jobs,observations)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SEARCH,firstParty:true,listingComplete:false,pagesFetched:pages*2,reportedTotal:null,indiaFacetCount:surface.total,verifiedAt:now,reason:'current-official-India-country-filter-enumerated-company-wide-scope-unproven'+(heldRoles.length?';same-country-worksite-holds:'+(heldRoles.length-withdrawnRoles.length-incompleteOfficeRoles.length):'')+(withdrawnRoles.length?';native-withdrawn-holds:'+withdrawnRoles.length:'')+(incompleteOfficeRoles.length?';incomplete-public-office-holds:'+incompleteOfficeRoles.length:'')})
 }catch(error){if(!c.signal.aborted)c.abort(error);throw error}finally{clearTimeout(timer)}
}
