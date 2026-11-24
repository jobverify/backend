import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {currentReader} from './currentRead20261121.js'
import {HOME,BOARD,need,one,norm,cls,all,authored,page,ownedWebsite,ownIssuer,control,publicRoleURL,scopeFacts,qualifyIssuerProse} from './currentScope20261121.js'

export {HOME,BOARD}
const SOURCE='wonksknow',COMPANY='Wonksknow',MAX_ROLES=40
const text=node=>norm(authored(node))
const ownLabel=node=>node.tag==='a'&&/^India\s+Careers$/i.test(text(node))
const applyControl=node=>node.tag==='a'&&(cls(node,'apply-link')||/^APPLY FOR THIS JOB$/i.test(text(node)))
const nearestOpening=(p,node)=>[...p.ancestors(node)].reverse().find(parent=>cls(parent,'job-opening'))
const children=node=>node.children.filter(child=>typeof child!=='string')
const sourceSnapshot=node=>({tag:node.tag,attributes:structuredClone(node.attrs)})
function publisherModels(p){
 const models=[]
 const walk=(model,depth=0)=>{
  need(depth<=24,'publisher structured nesting excessive')
  if(Array.isArray(model)){model.forEach(value=>walk(value,depth+1));return}
  if(!model||typeof model!=='object')return
  if(model['@context']!=null)need(typeof model['@context']==='string'&&/^https?:\/\/schema\.org\/?$/.test(model['@context']),'publisher structured context differs')
  const types=Array.isArray(model['@type'])?model['@type']:[model['@type']],organization=types.some(type=>['Organization','WebSite','https://schema.org/Organization','https://schema.org/WebSite','http://schema.org/Organization','http://schema.org/WebSite'].includes(type))
  if(organization&&model.name!=null)need(ownIssuer(model.name),'actual own named publisher differs')
  if(types.some(type=>['WebPage','https://schema.org/WebPage','http://schema.org/WebPage'].includes(type))&&model.name!=null)need(typeof model.name==='string'&&(/\bWonksknow\b/i.test(model.name)||/^(?:careers?|jobs?|work with us|join (?:our|the) team)$/i.test(norm(model.name))),'actual own named page differs')
  if(organization)for(const field of['url','sameAs'])if(model[field]!=null)for(const value of Array.isArray(model[field])?model[field]:[model[field]])need(ownedWebsite(value),'own publisher URI differs')
  for(const value of Object.values(model))if(value&&typeof value==='object')walk(value,depth+1)
 }
 for(const script of p.headNodes.filter(node=>node.tag==='script'&&!node.attrs.src&&/^application\/ld\+json(?:\s*;|$)/i.test(norm(node.attrs.type)))){const model=readLiteralModel(script.raw??'').value;need(model&&typeof model==='object','own publisher model malformed');walk(model);models.push(model)}
 return models
}
function ownDivisionContext(p){
 const originalDeclarations=[],programmes=[]
 for(const node of all(p.root,node=>['p','li'].includes(node.tag)&&p.ancestors(node).some(parent=>parent.tag==='footer'||parent.attrs.role==='contentinfo'))){
  const authoredText=text(node);if(!/\bare\s+divisions\s+of\b/i.test(authoredText))continue
  const declaration={...sourceSnapshot(node),text:authoredText,visibleText:p.text(node),rawHTML:p.outer(node),active:p.active(node)};originalDeclarations.push(declaration)
  if(!declaration.active)continue
  const match=/^(.*?)\s+are\s+divisions\s+of\s+(WONKSKNOW\s+LLC)(?=$|[.!?]\s|\s+\d|\s+COPYRIGHT\b)/i.exec(declaration.visibleText)
  if(!match)continue
  const names=match[1].split(/,|\s+(?:and|&)\s+/i).map(norm)
  if(names.length===0||names.length>32||names.some(name=>!name||name.length>100||/[<>;\r\n]/.test(name)))continue
  const originalDivisionDeclaration=Object.freeze({...structuredClone(declaration),publisherRaw:match[2],declaredNames:Object.freeze([...names])})
  for(const name of names)programmes.push(Object.freeze({name,publisher:'WONKSKNOW LLC',relationship:'own-footer-declared-division',originalDivisionDeclaration}))
 }
 return{originalDeclarations,programmes:Object.freeze(programmes)}
}
function ownAuthority(html,at){
 const p=page(html,HOME,{publisher:true}),candidates=all(p.root,ownLabel);need(candidates.length>0&&candidates.length<=16,'own India Careers declaration missing/excessive')
 for(const link of candidates)need(new URL(link.attrs.href,HOME).href===BOARD,'own country-labeled native account conflicts')
 const active=candidates.filter(p.active);need(active.length>0,'own India Careers declaration not active')
 for(const link of active){control(p,link);for(const ancestor of p.ancestors(link))scopeFacts(p,ancestor,{url:HOME,at,location:null},{attributesOnly:true})}
 const models=publisherModels(p),divisions=ownDivisionContext(p)
 return{officialURL:HOME,declaredNativeURL:BOARD,publisher:COMPANY,countryLabel:'India Careers',country:'India',nativeAccount:'wonksknowindia',originalHTML:html,originalHeadTitle:p.title,originalPublisherModels:structuredClone(models),originalHandoffs:candidates.map(node=>({...sourceSnapshot(node),active:p.active(node),text:p.text(node)})),originalDivisionDeclarations:divisions.originalDeclarations,programmeRelationships:divisions.programmes,nativeCountry:null,legalEmployer:null}
}
function listingRows(html){
 const p=page(html,BOARD),cards=all(p.root,node=>node.tag==='div'&&cls(node,'job-opening')&&all(node,child=>cls(child,'job-title')).length>0)
 need(cards.length>0&&cards.length<=MAX_ROLES,'current public cohort empty/excessive; no zero or total inferred')
 const rows=cards.map((card,index)=>{
  const row={index,id:null,url:null,title:null,location:null,contract:null,error:null,originalCardHTML:p.outer(card),originalAttributes:structuredClone(card.attrs)}
  try{
   const links=all(card,node=>node.tag==='a'&&(cls(node,'apply-here')||/view_job_description/.test(node.attrs.href??'')));need(links.length>0&&links.length<=16,'current listing role links missing/excessive')
   const declarations=links.map(link=>publicRoleURL(link.attrs.href));need(declarations.every(value=>value.url===declarations[0].url),'same listing role identities conflict');row.id=declarations[0].id;row.url=declarations[0].url
   for(const link of links)control(p,link)
   const title=one(all(card,node=>cls(node,'job-title')),'own listing title');control(p,title);row.title=p.text(title);need(row.title,'own listing title missing')
   const locations=all(card,node=>cls(node,'job-city')),contracts=all(card,node=>cls(node,'job-contract'));need(locations.length<=1&&contracts.length<=1,'listing header ambiguous');row.location=locations[0]?p.text(locations[0]):null;row.contract=contracts[0]?p.text(contracts[0]):null
  }catch(error){row.error=error.message}
  return{row,card}
 })
 return{p,rows,originalHTML:html}
}
function header(p,owner){
 const fields=children(owner).filter(node=>/^LOCATION:.*CONTRACT:.*WORK FROM HOME:.*EXPERIENCE REQUIRED:/i.test(text(node))),carrier=one(fields,'selected actual native header');control(p,carrier)
 const match=/^LOCATION:\s*(.*?)\s*CONTRACT:\s*(.*?)\s*WORK FROM HOME:\s*(.*?)\s*EXPERIENCE REQUIRED:\s*(.*?)$/i.exec(text(carrier));need(match&&match[1]&&match[2]&&['YES','NO'].includes(match[3]),'selected native workplace/contract/WFH header unknown')
 return{location:match[1],contract:match[2],workFromHome:match[3],experienceRequired:match[4]||null,originalHTML:p.outer(carrier)}
}
function section(p,owner,label){
 const parts=children(owner),headings=parts.map((node,index)=>({node,index})).filter(({node})=>text(node)===label);need(headings.length<=1,'selected '+label+' owner ambiguous')
 if(!headings.length)return{label,rawHTML:null,authoredText:null,visibleText:null,missing:true}
 const start=headings[0].index,next=parts.findIndex((node,index)=>index>start&&/^(?:JOB DESCRIPTION|JOB REQUIREMENT)$/.test(text(node))),content=parts.slice(start+1,next<0?undefined:next)
 const rawHTML=content.map(p.outer).join(''),authoredText=norm(content.map(authored).join(' '))||null,visibleText=norm(content.map(p.text).join(' '))||null
 return{label,rawHTML:rawHTML||null,authoredText,visibleText,missing:!authoredText}
}
function nativeApply(p,owner,row){
 const links=all(owner,applyControl);need(links.length>0&&links.length<=16,'selected application handoff missing/excessive');let url
 for(const link of links){
  control(p,link);const target=new URL(link.attrs.href,row.url);need(target.protocol==='https:'&&target.origin==='https://vinterview.ai'&&target.pathname==='/user/wonksknowindia/job_application_organization_page'&&!target.username&&!target.password&&!target.port&&!target.hash,'selected application leaves exact native account')
  need([...target.searchParams.keys()].length===1&&target.searchParams.getAll('job_id').length===1&&target.searchParams.get('job_id')===row.id,'selected application role differs');need(url==null||url===target.href,'selected application alternatives conflict');url=target.href
 }
 return{url,originalControls:links.map(node=>({...sourceSnapshot(node),text:p.text(node)})),applicationVisited:false,submitted:false,activationVerified:false,allControlsQualified:false,backendActivationVerified:false,uiControlActivationVerified:false,closingQualified:false}
}
function selectedRole(html,listing,authority,at){
 const{row,card}=listing;need(!row.error,row.error??'listing identity unresolved');const p=page(html,row.url)
 const anchors=all(p.root,applyControl),matching=anchors.filter(node=>{try{const url=new URL(node.attrs.href,row.url);return url.origin==='https://vinterview.ai'&&url.pathname==='/user/wonksknowindia/job_application_organization_page'&&url.searchParams.get('job_id')===row.id}catch{return false}}),owners=[...new Set(matching.map(node=>nearestOpening(p,node)).filter(Boolean))],owner=one(owners,'selected same-ID application owner')
 control(p,owner);const title=one(all(owner,node=>cls(node,'job-title')),'selected role title');control(p,title);const nativeTitle=p.text(title);need(nativeTitle&&nativeTitle.toLowerCase()===row.title.toLowerCase(),'selected/listed role title differs')
 const details=header(p,owner),application=nativeApply(p,owner,row),description=section(p,owner,'JOB DESCRIPTION'),requirements=section(p,owner,'JOB REQUIREMENT')
 if(row.location)need(norm(row.location).toLowerCase()===norm(details.location).toLowerCase(),'selected/listing whole workplace differs')
 if(row.contract)need(norm(row.contract).toLowerCase()===norm(details.contract).toLowerCase(),'selected/listing contract differs')
 const issuerQualification=qualifyIssuerProse(description.authoredText,authority.programmeRelationships,description.visibleText)
 const context={url:row.url,id:row.id,title:row.title,applyURL:application.url,location:details.location,contract:details.contract,workFromHome:details.workFromHome,at},roleFacts=scopeFacts(p,owner,context,{includeHead:true}),listingFacts=scopeFacts(listing.p,card,context)
 const ancestorFacts=[...p.ancestors(owner).slice(0,-1).map(node=>scopeFacts(p,node,context,{attributesOnly:true})),...listing.p.ancestors(card).slice(0,-1).map(node=>scopeFacts(listing.p,node,context,{attributesOnly:true}))]
 const allFacts=[roleFacts,listingFacts,...ancestorFacts],dates={posted:allFacts.flatMap(facts=>facts.posted),expiry:allFacts.flatMap(facts=>facts.expiry)}
 const model={binding:{id:row.id,title:row.title,publisher:COMPANY,nativeAccount:'wonksknowindia',publicURL:row.url,applicationURL:application.url,location:details.location,contract:details.contract,workFromHome:details.workFromHome,employerRelationshipUnresolved:issuerQualification.employerRelationshipUnresolved,programmeSubjects:[...new Set(issuerQualification.programmes.map(programme=>programme.normalizedSubject.toLowerCase()))].sort()},originalListing:structuredClone(row),originalSelectedOwnerHTML:p.outer(owner),originalNativeTitle:nativeTitle,originalHeader:details,originalDescription:description,originalRequirements:requirements,originalApplication:application,originalFacts:allFacts,originalCountryDeclaration:authority.originalHandoffs,originalIssuerQualification:issuerQualification,originalOwnDivisionDeclarations:structuredClone(authority.originalDivisionDeclarations),nativeCountry:null,nativePostedDate:null,nativeValidThrough:null,nativeLegalEmployer:null,formalRequisition:null}
 return{model,dates,description,requirements,details,application}
}
function projected(row,opening,closing,at){
 need(isDeepStrictEqual(opening.model.binding,closing.model.binding),'native closing role/issuer/application/workplace binding differs')
 const dates={posted:[...opening.dates.posted,...closing.dates.posted],expiry:[...opening.dates.expiry,...closing.dates.expiry]};for(const list of Object.values(dates))list.sort((a,b)=>a.iso.localeCompare(b.iso)||Number(b.exact)-Number(a.exact))
 const posted=dates.posted[0]??null,expires=dates.expiry[0]??null,descriptionTexts=[...new Set([opening.description.authoredText,closing.description.authoredText].filter(Boolean))],requirementsTexts=[...new Set([opening.requirements.authoredText,closing.requirements.authoredText].filter(Boolean))],rawDescription=closing.description.rawHTML??opening.description.rawHTML,rawRequirements=closing.requirements.rawHTML??opening.requirements.rawHTML
 const nativeCountries=[...opening.model.originalFacts,...closing.model.originalFacts].flatMap(fact=>fact.countries)
 const employerRelationshipUnresolved=opening.model.originalIssuerQualification.employerRelationshipUnresolved||closing.model.originalIssuerQualification.employerRelationshipUnresolved
 const programmeRelationships=[{phase:'opening',recruitingAssertions:structuredClone(opening.model.originalIssuerQualification.recruitingAssertions),programmes:structuredClone(opening.model.originalIssuerQualification.programmes)},{phase:'closing',recruitingAssertions:structuredClone(closing.model.originalIssuerQualification.recruitingAssertions),programmes:structuredClone(closing.model.originalIssuerQualification.programmes)}]
 return{
  source:SOURCE,company:COMPANY,title:row.title,jobId:row.id,nativePublicJobId:row.id,requisitionId:null,sourceUrl:row.url,applyUrl:closing.application.url,link:closing.application.url,companyCareerPage:BOARD,companyDomain:'wonksknow.com',atsPlatform:'Vinterview',
  country:'India',nativeCountry:nativeCountries.length?'India':null,city:null,state:null,location:closing.details.location,sourceCountryEvidence:{kind:'own-active-India-Careers-exact-native-account-membership',officialURL:HOME,declaredURL:BOARD,originalCountryLabel:'India Careers',nativeAccount:'wonksknowindia',nativeRoleURL:row.url,nativePublicRoleId:row.id,originalNativeCountryFacts:nativeCountries,inferredFromCity:false,inferredFromCompanyAddress:false,inferredFromEmployerName:false},
  sourceNativePublisher:COMPANY,nativeEmployer:employerRelationshipUnresolved?null:COMPANY,sourceEmployerRelationshipUnresolved:employerRelationshipUnresolved,sourceProgrammeRelationships:programmeRelationships,nativeLegalEmployer:null,legalEmployer:null,sourceLegalEmployerUnverified:true,nativePostedDate:posted?.raw??null,nativeValidThrough:expires?.raw??null,
  postingDate:posted?.iso??null,closingDate:expires?.iso??null,sourcePostingDateIsExact:posted?.exact??null,sourceClosingDateIsExact:expires?.exact??null,sourceNativeDates:{recognizedPostingFields:dates.posted,recognizedExpiryFields:dates.expiry,datePostedRaw:posted?.raw??null,validThroughRaw:expires?.raw??null},
  sourceNativeApplication:closing.application,sourceNativeIdentity:{nativePublicRoleId:row.id,formalRequisition:null,formalRequisitionExplicitlyAuthored:false},sourceNativeRecord:structuredClone(row),sourceNativeObservedRole:closing.model,sourceNativeRoleModels:[{phase:'opening',originalModel:opening.model},{phase:'closing',originalModel:closing.model}],
  sourceDescription:descriptionTexts.join('\n\n')||null,jobDescription:descriptionTexts.join('\n\n')||null,sourceRawDescriptionHtml:rawDescription,sourceRawRequirementsHtml:rawRequirements,minimumQualification:requirementsTexts.join('\n\n')||null,preferredQualification:null,requiredSkills:[],experienceRequired:closing.details.experienceRequired,nativeWorkFromHome:closing.details.workFromHome,remoteStatus:null,employmentType:closing.details.contract,department:null,
  sourceCriteriaStatus:descriptionTexts.length?'present':'missing',sourceCriteriaObservationConflict:!isDeepStrictEqual(opening.model,closing.model),sourceHiddenCriteriaUnreviewed:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceFullCriteriaQualified:false,sourceDetailClosingQualified:false,detailClosingQualified:false,sourceDetailFailureKind:'current-own-country-declared-public-partial;full-application-controls-legal-employer-renderer-backend-and-inventory-unverified',
  sourcePublicationClosingQualified:true,sourceClosingQualified:true,sourceScopeComplete:false,sourceListingComplete:false,sourceCompanyInventoryUnresolved:true,sourceCompanyScopeUnresolved:false,sourceCountryScopeUnresolved:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,sourceNativeProgramsExecuted:false,applicationsSubmitted:false,backendActivationVerified:false,scrapedAt:at,
 }
}
export async function runCurrentIndiaPublications(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original native Responses required; use explicit legacy factory for fetchText compatibility');need(options.maxJobs==null||options.maxJobs===0,'positive maxJobs cap unsupported');need(options.maxPages==null||options.maxPages===0,'positive maxPages cap unsupported')
 const at=new Date(typeof options.now==='function'?options.now():options.now??new Date().toISOString()).toISOString(),io=currentReader([HOME,BOARD],[new URL(HOME).origin,new URL(BOARD).origin],options),jobs=[],views=[],audit={source:SOURCE,kind:'own-declared-India-channel-positive-partials',nativeOpeningInventory:[],nativeClosingInventory:[],originalAuthorityModels:[],nativeRoleModels:[],held:[],originalResponses:[],sourceScopeComplete:false,sourceSearchSurfaceComplete:false,sourceSearchSurfaceClosingQualified:false,companyIndiaTotal:null,companyGlobalTotal:null,companyInventoryComplete:false,allApplicationControlsQualified:false,backendActivationVerified:false,rendererActivationVerified:false,nativeProgramsExecuted:false,applicationsSubmitted:false,lifecycleCleanupAllowed:false}
 const finish=async(reason,firstParty)=>{
  audit.originalResponses=structuredClone(io.receipts);attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeOpeningInventory.length,observedVacancyCount:audit.nativeOpeningInventory.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await io.callback(options.onAudit,structuredClone(audit));io.check();return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty,listingComplete:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:io.receipts.length?at:null,lifecycleCleanupAllowed:false,reason})
 }
 try{
  if(options.maxJobs===0||options.maxPages===0){audit.sourceCallerLimited=true;audit.sourceAcquisitionAttempted=false;return await finish('explicit-caller-zero-cap-no-acquisition;inventory-unknown',false)}
  audit.sourceAcquisitionAttempted=true
  for(const phase of['opening','closing']){
   const authority=ownAuthority((await io.read(HOME)).text,at),view=listingRows((await io.read(BOARD)).text);audit.originalAuthorityModels.push({phase,model:authority});view.authority=authority;view.roles=new Map();views.push(view);audit[phase==='opening'?'nativeOpeningInventory':'nativeClosingInventory']=structuredClone(view.rows.map(item=>item.row))
   for(const item of view.rows){item.p=view.p;if(item.row.url&&!view.roles.has(item.row.url)){io.allow(item.row.url);const original=await io.read(item.row.url);view.roles.set(item.row.url,{html:original.text,url:original.url})}}
  }
  const byId=rows=>rows.reduce((map,item)=>(map.set(item.row.id,[...(map.get(item.row.id)??[]),item]),map),new Map()),opening=byId(views[0].rows),closing=byId(views[1].rows)
  const added=views[1].rows.filter(item=>!opening.has(item.row.id));audit.closingAddedNativeRows=structuredClone(added.map(item=>item.row))
  for(const first of views[0].rows)try{
   const row=first.row;need(row.id&&opening.get(row.id)?.length===1&&closing.get(row.id)?.length===1,'native paired role identity missing/duplicate');const last=closing.get(row.id)[0];need(!row.error&&!last.row.error,row.error??last.row.error)
   const firstRole=selectedRole(views[0].roles.get(row.url).html,first,views[0].authority,at),lastRole=selectedRole(views[1].roles.get(last.row.url).html,last,views[1].authority,at),job=projected(row,firstRole,lastRole,at);jobs.push(job);audit.nativeRoleModels.push({id:row.id,opening:firstRole.model,closing:lastRole.model})
  }catch(error){io.check();audit.held.push({id:first.row.id,title:first.row.title,reason:error.message,originalOpeningListing:first.row,originalClosingListings:(closing.get(first.row.id)??[]).map(item=>item.row)})}
  audit.sourceSearchSurfaceClosingQualified=true;audit.observedAt=at;return await finish('current-own-India-Careers-declared-account-selected-role-publication-partials;native-countries-dates-legal-employer-full-controls-renderer-backend-company-inventory-and-cleanup-unverified',true)
 }catch(error){io.check();if(error&&typeof error==='object')error.nativeEvidence={...audit,originalResponses:structuredClone(io.receipts)};throw error}finally{io.close()}
}
