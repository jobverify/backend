import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentReader,nativeUnavailable} from './currentRead20261121.js'
import {declaredProgramme,listingProgramme} from './currentProgramme20261121.js'
import {qualifyDeclaredDependencies} from './currentDependencies20261121.js'
import {HOME,COMPANY,PUBLISHER,ownPage,declaredLink,listingRows,selectedRole} from './currentScope20261121.js'
import * as F from './currentFacts20261121.js'
const rowBinding=row=>({id:row.id,jobId:row.jobId,title:row.title,slug:row.slug,url:row.url,group:row.group,locations:row.locations,experience:row.experience,jobType:row.jobType})
function nonDateFacts(row){
 const normalized=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase(),dates=[...row.dates.posted,...row.dates.expiry],omitted=Symbol('recognized-date-only')
 const recognized=(name,value)=>{const values=Array.isArray(value)?value:[value];return values.length>0&&values.every(candidate=>dates.some(date=>normalized(date.field)===normalized(name)&&String(date.raw)===String(typeof candidate==='string'?candidate.trim():candidate)))}
 const copy=(value,name)=>{
  if((value==null||typeof value!=='object'||Array.isArray(value)&&value.every(v=>v==null||typeof v!=='object'))&&recognized(name,value))return omitted
  if(Array.isArray(value)){const children=value.map(child=>copy(child,''));return children.every(child=>child===omitted)&&value.length?omitted:children.map(child=>child===omitted?null:child)}
  if(value&&typeof value==='object'){const entries=Object.entries(value).map(([key,child])=>[key,copy(child,key)]),retained=entries.filter(([,child])=>child!==omitted);return entries.length&&!retained.length?omitted:Object.fromEntries(retained)}
  return value
 }
 return copy(row.original,'')
}

export async function runCurrentBitwise(options={}){
 options.signal?.throwIfAborted();F.need(!options.fetchJson&&!options.fetchPage,'original metadata-aware fetchImpl required')
 const at=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),io=currentReader(HOME,options),jobs=[],views=[]
 const audit={source:'bitwisesolutions',kind:'current-own-native-India-group-positive-partials',nativeOpeningInventory:[],nativeClosingInventory:[],originalAuthorityModels:[],nativeRoleModels:[],held:[],originalResponses:[],companyIndiaTotal:null,companyGlobalTotal:null,configuredBoardTotal:null,sourceScopeComplete:false,companyInventoryComplete:false,allApplicationControlsQualified:false,nativeProgramsExecuted:false,applicationsSubmitted:false,lifecycleCleanupAllowed:false}
 const finish=async(firstParty,reason)=>{audit.originalResponses=structuredClone(io.receipts);attachSourceObservationEvidence(jobs,{source:'bitwisesolutions',recordKind:'vacancy-rows',observedRecordCount:audit.nativeOpeningInventory.length,observedVacancyCount:audit.nativeOpeningInventory.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check();return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty,listingComplete:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:io.receipts.length?at:null,lifecycleCleanupAllowed:false,reason})}
 try{
  if(options.maxJobs===0||options.maxPages===0||options.maxRequests===0){audit.sourceCallerLimited=true;return await finish(false,'caller-zero-cap;no-acquisition;inventory-unknown')}
  F.need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0&&options.maxJobs<=40,'invalid output cap');F.need(options.maxPages==null,'page caps unsupported for own dynamic source')
  for(const phase of ['opening','closing']){
   io.phase(phase)
   const homeOriginal=await io.read(HOME),home=ownPage(homeOriginal.text,HOME),careersDeclaration=declaredLink(home,HOME,'careers');io.allow(careersDeclaration.url)
   const careersOriginal=await io.read(careersDeclaration.url),careers=ownPage(careersOriginal.text,careersDeclaration.url),openingsDeclaration=declaredLink(careers,careersDeclaration.url,'openings');io.allow(openingsDeclaration.url)
   const openingsOriginal=await io.read(openingsDeclaration.url),openings=ownPage(openingsOriginal.text,openingsDeclaration.url),programmeDeclaration=declaredProgramme(openings,careers);io.allow(programmeDeclaration.url)
   const programmeOriginal=await io.read(programmeDeclaration.url,{kind:'program'}),contract=listingProgramme(programmeOriginal.text,programmeDeclaration)
   contract.importedNamespaceProof=await qualifyDeclaredDependencies(openings,programmeDeclaration,contract,programmeOriginal.text,io);io.allow(contract.url,contract.method)
   const response=await io.read(contract.url,{kind:'json',method:contract.method,body:contract.body}),view=listingRows(response.text,contract,at);view.roles=new Map();view.errors=new Map();views.push(view)
   audit[phase==='opening'?'nativeOpeningInventory':'nativeClosingInventory']=structuredClone(view.rows)
   audit.originalAuthorityModels.push({phase,home:{url:HOME,html:homeOriginal.text},careers:careersDeclaration,openings:openingsDeclaration,programme:contract,originalListingModel:view.originalModel})
   const counts=new Map();for(const row of view.rows)if(row.id)counts.set(row.id,(counts.get(row.id)??0)+1)
   for(const row of view.rows){
    if(row.group!=='india'||row.error||counts.get(row.id)!==1)continue
    io.allow(row.url)
    try{const original=await io.read(row.url);view.roles.set(row.id,selectedRole(original.text,row,at))}
    catch(error){io.check();if(io.denied.size)throw error;if(!nativeUnavailable(error)&&!error.nativeContradiction&&error.name!=='ActiveNativeContentError'&&error.name!=='SyntaxError')throw error;view.errors.set(row.id,{message:error.message,failureKind:nativeUnavailable(error)?'optional-native-unavailable':'parser_or_contract_error',original:error.nativeEvidence??null})}
   }
  }
  const indexed=view=>view.rows.reduce((map,row)=>(map.set(row.id,[...(map.get(row.id)??[]),row]),map),new Map()),opening=indexed(views[0]),closing=indexed(views[1])
  audit.closingAddedNativeRows=views[1].rows.filter(row=>!opening.has(row.id))
  for(const row of views[0].rows){if(row.group!=='india')continue
   try{
    F.need(!row.error&&opening.get(row.id)?.length===1&&closing.get(row.id)?.length===1,'native paired membership/identity missing or duplicated')
    const last=closing.get(row.id)[0];F.need(!last.error&&F.same(rowBinding(row),rowBinding(last)),'native closing listing identity/workplace/contract criteria changed')
    F.need(F.same(nonDateFacts(row),nonDateFacts(last)),'native closing unknown/non-date listing criteria changed; original models retained')
    const firstRole=views[0].roles.get(row.id),lastRole=views[1].roles.get(row.id);F.need(firstRole&&lastRole,views[0].errors.get(row.id)?.message??views[1].errors.get(row.id)?.message??'native selected role unresolved')
    const C={source:'bitwisesolutions',company:COMPANY,publisher:PUBLISHER,employer:PUBLISHER}
    const project=(view,role,phase)=>F.projection(C,row,role.model,{description:role.description,rawDescription:role.rawDescription,hidden:true,application:role.application,countryEvidence:{kind:'actual-own-current-native-listing-explicit-locationGroup-and-same-role-publication',literalGroup:view.originalModel.jobs.find(value=>value.id===row.id)?.locationGroup,groupCountry:'India',phase,publicRoleURL:row.url,originalListing:structuredClone(row.original),inferredFromCity:false,inferredFromCompanyAddress:false,inferredFromEmployerName:false},dates:role.dates})
    const prior=F.mergeObservation(null,project(views[0],firstRole,'opening'),'opening'),job=F.mergeObservation(prior,project(views[1],lastRole,'closing'),'closing')
    job.nativeLegalEmployer=null;job.legalEmployerName=null;job.sourceNativeIdentity={nativePublicJobId:row.id,nativeJobId:row.jobId,slug:row.slug,formalRequisition:null};job.nativeCountry=null;job.sourceFullCriteriaQualified=false;job.sourceDetailComplete=false;job.sourceDetailClosingQualified=false;job.detailClosingQualified=false;job.sourceNativeApplication={...job.sourceNativeApplication,activationVerified:false,allControlsQualified:false,backendActivationVerified:false,uiControlActivationVerified:false};job.applicationsSubmitted=false;job.backendActivationVerified=false;job.companyIndiaTotal=null;job.companyGlobalTotal=null;job.scrapedAt=at
    jobs.push(job);audit.nativeRoleModels.push({id:row.id,opening:firstRole.model,closing:lastRole.model})
   }catch(error){io.check();if(!error.nativeContradiction)throw error;audit.held.push({id:row.id,title:row.title,reason:error.message,openingRow:row.original,closingRows:(closing.get(row.id)??[]).map(value=>value.original),openingError:views[0].errors.get(row.id)??null,closingError:views[1].errors.get(row.id)??null})}
  }
  if(options.maxJobs!=null&&jobs.length>options.maxJobs){audit.sourceCallerLimited=true;jobs.splice(options.maxJobs)}
  return await finish(true,'current-own-native-positive-partials;company-count-facet-full-controls-renderer-backend-dates-legal-employer-inventory-cleanup-held')
 }catch(error){io.check();if(error&&typeof error==='object')error.nativeEvidence={...audit,originalResponses:structuredClone(io.receipts)};throw error}finally{io.close()}
}
