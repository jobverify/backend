import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]},has=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const all=(root,predicate)=>{const found=[];function visit(node){if(!node||typeof node!=='object')return;if(predicate(node))found.push(node);for(const c of node.children??[])visit(c)}visit(root);return found}
const textModel=html=>{const doc=readNativeDocument('<html><body>'+html+'</body></html>');return doc.text(one(doc.nodes(n=>n.tag==='body'),'literal description body'))}
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export const SOURCE='sastraroboticssgbiinc',COMPANY='Sastra Robotics-SGBI INC',HOMEPAGE_URL='https://sgbi.us/',CAREERS_URL=HOMEPAGE_URL+'career/'
const ownDetail=url=>typeof url==='string'&&/^https:\/\/sgbi\.us\/blog\/careers\/[a-z0-9-]+\/$/.test(url)
export function readCurrentSgbi(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'document title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href
 need(canonical===url&&!doc.nodes(n=>n.tag==='base').length,'Current SGBI own canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value)
 const careers=doc.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS_URL&&doc.text(n)==='Career').map(n=>structuredClone(n));need(careers.length>0,'Current own SGBI career declaration changed')
 let nativeSastraRelationship=null
 if(url===HOMEPAGE_URL||url===CAREERS_URL){
  need(title===(url===HOMEPAGE_URL?'Robotic Testing Solutions for Real Devices | SGBI':'Robotic Test Automation Careers | AI Robotics Jobs at SGBI'),'Current SGBI own document identity changed')
  const orgs=structured.flatMap(v=>v?.['@graph']??[v]).filter(v=>v?.legalName==='SGBI Inc');need(orgs.length===1&&orgs[0].name==='SGBI'&&orgs[0].url==='https://sgbi.us','Current SGBI employer identity changed')
  const copyright=doc.nodes(n=>n.tag==='p'&&doc.text(n).includes('SGBI Inc | Sastra Robotics | All Right Reserved'))
  need(copyright.length===1&&typeof orgs[0].description==='string'&&orgs[0].description.includes('began in 2013 with Sastra Robotics.'),'Current own Sastra relationship requires review')
  nativeSastraRelationship={nativeLegalName:orgs[0].legalName,nativeOrganizationDescription:orgs[0].description,nativeCopyrightText:doc.text(copyright[0]),relationshipQualified:true}
 }
 return {doc,title,canonical,structured,careers,nativeSastraRelationship,wholeOriginalHTML:html,programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''}))}
}
export function readCurrentSgbiListing(model){
 const {doc}=model;need(!model.structured.some(hasJob),'Unreviewed listing-level native JobPosting requires review')
 const listing=one(doc.nodes(n=>has(n,'awsm-job-listings')),'whole current native listing'),items=doc.nodes(n=>has(n,'awsm-job-listing-item'),listing)
 need(items.length>0,'Current native listing has no qualified role cards; inventory remains unknown')
 const cards=items.map(item=>{const roleId=(item.attrs.id??'').match(/^awsm-list-item-([0-9]+)$/)?.[1],heading=one(doc.nodes(n=>n.tag==='h2'&&has(n,'awsm-job-post-title'),item),'role heading'),link=one(doc.nodes(n=>n.tag==='a',heading),'role detail anchor'),more=one(doc.nodes(n=>n.tag==='a'&&has(n,'awsm-job-more'),item),'More Details link'),detailUrl=link.attrs.href,title=doc.text(heading)
  need(roleId&&title&&ownDetail(detailUrl)&&more.attrs.href===detailUrl,'Current native card role identity/detail binding changed');return {roleId,title,detailUrl,wholeNativeCard:structuredClone(item)}})
 need(new Set(cards.map(c=>c.roleId)).size===cards.length&&new Set(cards.map(c=>c.detailUrl)).size===cards.length,'Duplicate native role identity')
 return {cards,wholeNativeListing:structuredClone(listing),paginationAndEntireSourceQualified:false}
}
export function readCurrentSgbiDetail(model,card){
 const {doc}=model,heading=one(doc.nodes(n=>n.tag==='h1'&&has(n,'awsm-jobs-single-title')),'role title'),container=one(doc.nodes(n=>has(n,'awsm-job-container')),'whole native job container'),description=one(doc.nodes(n=>has(n,'awsm-job-entry-content'),container),'complete native criteria'),form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='awsm-application-form',container),'role application form')
 const schemas=model.structured.filter(v=>jobType(v?.['@type'])),schema=one(schemas,'native JobPosting'),fields=all(form,n=>['input','select','textarea'].includes(n.tag)),jobField=one(fields.filter(n=>n.attrs.name==='awsm_job_id'),'native form job ID'),ref=one(fields.filter(n=>n.attrs.name==='_wp_http_referer'),'native form role referer')
 need(Object.keys(schema).sort().join('|')==='@context|@type|datePosted|description|employmentType|hiringOrganization|jobLocation|title','Unreviewed authoritative native JobPosting schema field; closing and applicant criteria require review')
 need(schema.jobLocation&&Object.keys(schema.jobLocation).sort().join('|')==='@type|address'&&schema.jobLocation['@type']==='Place'&&schema.hiringOrganization&&Object.keys(schema.hiringOrganization).sort().join('|')==='@type|name|sameAs'&&schema.hiringOrganization['@type']==='Organization','Unreviewed authoritative nested native JobPosting schema field')
 need(doc.text(heading)===card.title&&schema.title===card.title&&schema.hiringOrganization?.name==='SGBI'&&schema.hiringOrganization?.sameAs==='https://sgbi.us'&&jobField.attrs.value===card.roleId&&ref.attrs.value===new URL(card.detailUrl).pathname,'Current role title/employer/application identity changed')
 need(form.attrs.method==='post'&&form.attrs.enctype==='multipart/form-data'&&!form.attrs.action&&fields.some(n=>n.attrs.id==='awsm-application-file'&&n.attrs.accept==='.pdf, .doc, .docx'),'Current complete native role form contract changed')
 // WordPress smart punctuation renders apostrophes and range hyphens differently.
 // Preserve both complete originals and compare only those presentation changes.
 const criteriaText=value=>value.replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-')
 need(typeof schema.description==='string'&&schema.description.length>100&&criteriaText(textModel(schema.description))===criteriaText(doc.text(description)),'Whole rendered/structured native role criteria disagree')
 need(typeof schema.datePosted==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(schema.datePosted)&&Number.isFinite(Date.parse(schema.datePosted))&&Date.parse(schema.datePosted)<=Date.now(),'Native role posting date missing or future')
 const loc=one(doc.nodes(n=>has(n,'awsm-job-specification-job-location'),container),'native role location'),term=one(doc.nodes(n=>has(n,'awsm-job-specification-term'),loc),'native location term'),location=doc.text(term)
 need(schema.jobLocation?.address===location,'Native structured/visible role locations disagree')
 const publicScript=one(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='awsm-job-scripts-js-extra'),'native public job configuration'),assignment=publicScript.raw.match(/^\s*var awsmJobsPublic = (\{[^]*\});\s*(?:\/\/[^]*)?$/),publicConfig=assignment?readLiteralModel(assignment[1]).value:null
 need(publicConfig?.job_id===card.roleId&&publicConfig.ajaxurl==='https://sgbi.us/wp-admin/admin-ajax.php','Native current client role ID/employer changed')
 return {roleId:card.roleId,title:card.title,sourceUrl:card.detailUrl,applyUrl:card.detailUrl,location,country:location==='India'?'India':null,nativePostingDate:schema.datePosted,postingDate:schema.datePosted,closingDate:null,
  jobDescription:doc.text(description)+'\n\n'+doc.text(form),wholeNativeDescription:structuredClone(description),wholeNativeApplicationForm:structuredClone(form),sourceNativeApplicationFields:structuredClone(fields),wholeNativeContainer:structuredClone(container),wholeNativeJobPosting:structuredClone(schema),wholeNativePublicConfiguration:structuredClone(publicConfig),wholeNativePublicConfigurationScript:structuredClone(publicScript),wholeOriginalHTML:model.wholeOriginalHTML,
  nativeRoleCriteriaRetained:true,publicApplicationEligibilityQualified:false,inlineFormRoleIDBindingVerified:true,workCountryQualified:location==='India',corporateOrCityCountryInferred:false,closingDatePublished:false}
}
export async function runCurrentSgbi(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native cohort cannot be truncated')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[CAREERS_URL,'html']],learnedURL:(url,kind)=>kind==='html'&&ownDetail(url)});let opening,closing
 async function authority(){const home=readCurrentSgbi((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),career=readCurrentSgbi((await reader.read(CAREERS_URL)).body,CAREERS_URL),listing=readCurrentSgbiListing(career),roles=[]
  for(const card of listing.cards){reader.allow(card.detailUrl,'html');roles.push(readCurrentSgbiDetail(readCurrentSgbi((await reader.read(card.detailUrl)).body,card.detailUrl),card))}
  return {home:{title:home.title,canonical:home.canonical,structured:home.structured,careers:home.careers,nativeSastraRelationship:home.nativeSastraRelationship,programmeDeclarations:home.programmeDeclarations,wholeOriginalHTML:home.wholeOriginalHTML},career:{title:career.title,canonical:career.canonical,structured:career.structured,nativeSastraRelationship:career.nativeSastraRelationship,programmeDeclarations:career.programmeDeclarations,wholeOriginalHTML:career.wholeOriginalHTML},listing,roles}}
 const semantic=model=>({home:{title:model.home.title,canonical:model.home.canonical,structured:model.home.structured,careers:model.home.careers,nativeSastraRelationship:model.home.nativeSastraRelationship},listing:model.listing,roles:model.roles.map(role=>{const semanticRole={...role};delete semanticRole.wholeOriginalHTML;return semanticRole})})
 try{opening=await authority();closing=await authority();need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing complete native role criteria/employer/application/listing changed');reader.check()
  const jobs=opening.roles.filter(r=>r.country==='India').map(r=>({title:r.title,company:COMPANY,country:r.country,location:r.location,jobId:SOURCE+'-'+r.roleId,requisitionId:r.roleId,sourceUrl:r.sourceUrl,applyUrl:r.applyUrl,link:r.applyUrl,jobDescription:r.jobDescription,postingDate:r.postingDate,closingDate:null,remoteStatus:null,source:SOURCE,companyCareerPage:CAREERS_URL,sourceNativeJobPosting:r.wholeNativeJobPosting,sourceNativeHiringOrganization:r.wholeNativeJobPosting.hiringOrganization,employmentType:r.wholeNativeJobPosting.employmentType,sourceNativeCriteria:r.wholeNativeDescription,sourceNativeApplicationForm:r.wholeNativeApplicationForm,sourceNativeApplicationFields:r.sourceNativeApplicationFields,sourceNativeApplicationCriteriaVerified:false,publicApplicationEligibilityQualified:false,sourceNativeRole:r,scrapedAt:new Date().toISOString()})),summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.roles.length,observedVacancyCount:opening.roles.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null}
  attachSourceObservationEvidence(jobs,summary);const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations:opening.roles,wholeObservedRoleModelsClosingMatch:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,nativeInventoryQualified:false,publicApplicationEligibilityQualified:false,applicationInteractions:0,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds:['Cochin-alone-is-not-explicit-work-country','native-old-posting-dates-preserved-not-refreshed','client-validation-and-submit-semantics-unqualified','pagination-and-whole-company-inventory-unknown']}
  need(Buffer.byteLength(JSON.stringify(audit))<=16*1024*1024,'Native observation output byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-native-role-cohort-reconciled;explicit-country-only;old-dates-preserved;application-and-company-inventory-unqualified'})
  reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}finally{reader.close()}
}
