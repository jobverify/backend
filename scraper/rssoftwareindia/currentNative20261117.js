import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]},has=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const all=(root,predicate)=>{const found=[];function visit(node){if(!node||typeof node!=='object')return;if(predicate(node))found.push(node);for(const c of node.children??[])visit(c)}visit(root);return found}
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export const SOURCE='rssoftwareindia',COMPANY='RS Software (India) Ltd.',HOMEPAGE_URL='https://rssoftware.ai/',CAREERS_URL=HOMEPAGE_URL+'home/jointeam'
const ownDetail=url=>typeof url==='string'&&/^https:\/\/rssoftware\.ai\/Home\/job_details\/[0-9]+$/.test(url)
export function readCurrentRsSoftware(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'document title'),root=one(doc.nodes(n=>n.tag==='html'),'own complete document'),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs.href)
 need(title==='RS SOFTWARE'&&!doc.nodes(n=>n.tag==='base').length&&canonical.every(value=>value===url)&&doc.text(root).includes('RS Software'),'Current own RS Software employer/title/canonical changed')
 const careers=doc.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS_URL&&doc.text(n)==='Join Our Team').map(n=>({href:n.attrs.href,text:doc.text(n)}));need(careers.length>0,'Current own RS Software Join Our Team declaration changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Unreviewed RS Software JobPosting model requires acquisition review')
 return {doc,title,canonical,careers,structured,programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),wholeOriginalHTML:html}
}
export function readCurrentRsSoftwareListing(model){
 const {doc}=model;need(doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Open roles').length===1,'Current whole native Open roles context changed')
 const listing=one(doc.nodes(n=>has(n,'career-section')),'whole role list'),items=doc.nodes(n=>has(n,'career-item'),listing);need(items.length>0,'No qualified current native role list; inventory unknown')
 const cards=items.map(item=>{const heading=one(doc.nodes(n=>n.tag==='h4'&&has(n,'career-title'),item),'role title'),apply=one(doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply',item),'role application detail'),detailUrl=apply.attrs.href,title=doc.text(heading);need(title&&ownDetail(detailUrl),'Unbound native role detail URL');return {title,detailUrl,roleId:new URL(detailUrl).pathname.split('/').at(-1),wholeNativeCard:structuredClone(item)}})
 need(new Set(cards.map(r=>r.roleId)).size===cards.length,'Duplicate native role IDs');return {cards,wholeNativeListing:structuredClone(listing),sourceScopeComplete:false}
}
export function readCurrentRsSoftwareDetail(model,card){
 const {doc}=model,header=one(doc.nodes(n=>has(n,'post-header')),'whole role header'),title=one(doc.nodes(n=>/^h[1-6]$/.test(n.tag),header),'role header title'),content=one(doc.nodes(n=>has(n,'post-content')),'whole native post criteria'),form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='application-form'),'whole role-specific application form'),fields=all(form,n=>['input','select','textarea'].includes(n.tag)),id=one(fields.filter(n=>n.attrs.name==='job_details_id'),'native application job ID')
 need(doc.text(title)===card.title&&id.attrs.value===card.roleId&&form.attrs.action===HOMEPAGE_URL+'home/submit_application'&&form.attrs.method==='post'&&form.attrs.enctype==='multipart/form-data','Current role title/employer/own application identity changed')
 need(doc.text(content).length>100&&doc.text(content).includes('RS Software'),'Complete native role criteria missing or employer changed')
 const date=doc.nodes(n=>n.tag==='time'||has(n,'post-date'),header).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)}))
 return {title:card.title,roleId:card.roleId,sourceUrl:card.detailUrl,applyUrl:card.detailUrl,country:null,location:null,workCountryQualified:false,corporateOrTitleCityCountryInferred:false,jobDescription:doc.text(content)+'\n\n'+doc.text(form),wholeNativePostHeader:structuredClone(header),nativePublishedDateModel:date,postingDate:null,closingDate:null,wholeNativeCriteria:structuredClone(content),wholeNativeApplicationForm:structuredClone(form),sourceNativeApplicationFields:structuredClone(fields),programmeDeclarations:model.programmeDeclarations,wholeOriginalHTML:model.wholeOriginalHTML,nativeRoleCriteriaRetained:true,publicApplicationEligibilityQualified:false,inlineFormRoleIDBindingVerified:true}
}
export async function runCurrentRsSoftware(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native cohort cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&ownDetail(url)});let opening,closing
 async function authority(){const home=readCurrentRsSoftware((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),career=readCurrentRsSoftware((await reader.read(CAREERS_URL)).body,CAREERS_URL),listing=readCurrentRsSoftwareListing(career),roles=[]
  for(const card of listing.cards){reader.allow(card.detailUrl,'html');roles.push(readCurrentRsSoftwareDetail(readCurrentRsSoftware((await reader.read(card.detailUrl)).body,card.detailUrl),card))}
  return {home:{title:home.title,canonical:home.canonical,careers:home.careers,wholeOriginalHTML:home.wholeOriginalHTML,programmeDeclarations:home.programmeDeclarations},career:{wholeOriginalHTML:career.wholeOriginalHTML,programmeDeclarations:career.programmeDeclarations},listing,roles}}
 const semantic=model=>({home:{title:model.home.title,canonical:model.home.canonical,careers:model.home.careers},listing:model.listing,roles:model.roles.map(role=>{const semanticRole={...role};delete semanticRole.wholeOriginalHTML;delete semanticRole.programmeDeclarations;return semanticRole})})
 try{opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing whole native role criteria/application/listing changed');reader.check()
  const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.roles.length,observedVacancyCount:opening.roles.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:opening.roles,wholeObservedRoleModelsClosingMatch:true,currentMigrationRedirectChainQualified:false,wholeClientProgrammeClosingQualified:false,publicApplicationEligibilityQualified:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,applicationInteractions:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['current-native-role-work-country-not-qualified','corporate-India-market-copy-and-bare-city-title-not-work-country','full-client-submit-semantics-and-pagination-unqualified','company-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=12*1024*1024,'Native observation output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-role-details-and-application-models-reconciled;work-country-client-and-company-inventory-unqualified'})
  reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}finally{reader.close()}
}
