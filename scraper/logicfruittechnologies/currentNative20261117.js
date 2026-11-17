import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='logicfruittechnologies',HOME='https://www.logic-fruit.com/'
const MAIN=HOME+'assets/index-CAHOli87.js',LIST='https://api.logic-fruit.com/api/jobs?status=published',DETAIL='https://api.logic-fruit.com/api/jobs/'
// This finite reviewed public client declares getJobs({status:`published`})
// and getJobBySlug. Its optional CMS/static fallback, generated SEO sentence,
// corporate IN address and admin routes grant no vacancy/country authority.
const HOME_SHA='d65b26f8c2d60767c52191428cc5eeb42cb151741f2a0d697a856e8b2e5d962c'
const CLIENT_SHA='18bf558ab0c30409114ff20cd11c4bfeaa1ba76601276a660045f1cd4c613320'
const fail=message=>{throw firstPartyFailure(SOURCE,message)}
const need=(ok,message)=>{if(!ok)fail(message)}
const sha=value=>createHash('sha256').update(value).digest('hex')
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const clone=value=>structuredClone(value)
const clean=value=>typeof value==='string'&&value.trim().length>0
const literal=body=>{try{return readLiteralModel(body).value}catch(error){fail('Invalid or duplicate native JSON envelope: '+error.message)}}
const keys=(value,expected)=>object(value)&&same(Object.keys(value).sort(),expected.slice().sort())
function validateRow(row){
 need(object(row)&&row.status==='published'&&row.entityType==='job','Unbound or unpublished native vacancy record')
 need(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)&&row.slug.length<180,'Invalid native vacancy ID/slug')
 need(clean(row.title)&&clean(row.location),'Missing native vacancy identity/location label')
 // Retain the entire model, including unknown fields and absent values. No
 // country, date, application URL or complete rendered criteria is inferred.
 return row
}
function inventory(body){
 const value=literal(body)
 need(keys(value,['success','count','data'])&&value.success===true&&Array.isArray(value.data)&&Number.isSafeInteger(value.count)&&value.count===value.data.length&&value.count<=100,'Native published inventory envelope/count is incomplete')
 value.data.forEach(validateRow)
 need(new Set(value.data.map(row=>row.id)).size===value.count&&new Set(value.data.map(row=>row.slug)).size===value.count,'Duplicate native vacancy ID/slug')
 return value
}
function ownDetail(body,row){
 const value=literal(body)
 need(keys(value,['success','data'])&&value.success===true,'Invalid own native detail envelope')
 validateRow(value.data)
 need(same(value.data,row),'Whole native list/detail record or criteria disagreement')
 return value
}
function homeAuthority(page){
 const doc=readNativeDocument(page.body)
 need(!doc.nodes(node=>node.tag==='base').length,'Unreviewed native base authority')
 const roots=doc.nodes(node=>node.tag==='div'&&node.attrs.id==='root'),modules=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='module'),structured=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 need(roots.length===1&&modules.length===1&&new URL(modules[0].attrs.src,HOME).href===MAIN&&structured.length===1,'Current native root/module identity changed')
 const model=literal(structured[0].raw),employers=model?.['@graph']?.filter(item=>item?.['@type']==='Organization')
 need(employers?.length===1&&employers[0].name==='Logic Fruit Technologies'&&employers[0].url==='https://www.logic-fruit.com'&&employers[0]['@id']===HOME+'#organization','Current corporate employer identity changed')
 need(sha(page.body)===HOME_SHA,'Whole reviewed native HTML identity/authority changed')
 return {url:HOME,homepageHTML:page.body,corporateStructuredData:model,main:MAIN,homepageSHA256:page.sha256}
}

export async function runCurrentLogicFruit(options={}){
 options.signal?.throwIfAborted()
 need(options.maxJobs==null,'A read cap cannot certify the observed native cohort')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(Number.isFinite(Date.parse(now)),'Invalid observation clock')
 const reader=createCurrentNativeReader({...options,sourceTimeoutMs:options.sourceTimeoutMs??90000},{source:SOURCE,admitted:[[HOME,'html'],[MAIN,'javascript'],[LIST,'json']],learnedURL:(url,kind)=>kind==='json'&&url.startsWith(DETAIL)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.slice(DETAIL.length))})
 const observations=[]
 async function authority(){
  const home=homeAuthority(await reader.read(HOME)),program=await reader.read(MAIN)
  need(sha(program.body)===CLIENT_SHA,'Whole reviewed current public client changed')
  const nativeInventory=inventory((await reader.read(LIST)).body)
  return {...home,client:{url:MAIN,sha256:program.sha256,bytes:Buffer.byteLength(program.body)},nativeInventory}
 }
 try{
  const opening=await authority()
  for(const row of opening.nativeInventory.data){
   const url=DETAIL+row.slug;reader.allow(url,'json')
   const observed={id:row.id,nativeSlug:row.slug,nativeDetailAPI:url,nativeOpeningRecord:clone(row),country:null,publicationDate:null,applicationURL:null,legalHiringOrganization:null,activeApplyVerified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    qualificationIssues:['native-role-country-unpublished','whole-rendered-criteria-and-intake-unverified','active-own-application-url-unverified','company-inventory-scope-unverified']}
   observations.push(observed);observed.ownOpeningModel=clone(ownDetail((await reader.read(url)).body,row))
  }
  const closing=await authority()
  need(same(opening,closing),'Opening/closing whole native employer/client/inventory changed')
  for(const observed of observations){
   const row=closing.nativeInventory.data.find(item=>item.id===observed.id)
   observed.nativeClosingRecord=clone(row);observed.ownClosingModel=clone(ownDetail((await reader.read(observed.nativeDetailAPI)).body,row))
   need(same(observed.ownOpeningModel,observed.ownClosingModel),'Opening/closing whole native own detail changed')
  }
  reader.check()
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LIST,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'bound-current-published-api-cohort-reconciled-role-country-rendered-criteria-application-and-company-scope-unqualified'})
  const summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,heldNativeRows:observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,wholeObservedNativeBoardClosingReconciled:true,observedNativeBoardTotal:observations.length,originalResponses:reader.stats().receipts,unknownCountryVacancies:observations.length,companyScopeComplete:false,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,renderedInventoryBindingVerified:false,activeApplyVerified:false,applicationInteractions:0,legacyCityCountryInferenceUsed:false,staticFallbackUsed:false,readLimits:reader.stats()},configurable:true})
  return jobs
 }catch(error){
  options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,observations,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},configurable:true,enumerable:true})}catch{}
  throw error
 }finally{reader.close()}
}
