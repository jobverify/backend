import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='simplifyhealthcare',HOME='https://simplifyhealthcare.com/',CAREERS=HOME+'careers/current-openings/'
const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const one=(rows,label)=>{need(rows.length===1,'Expected one native '+label);return rows[0]}
const roleURL=value=>{try{const url=new URL(value);return url.origin===new URL(HOME).origin&&/^\/careers\/current-openings\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(url.pathname)&&!url.search&&!url.hash?url.href:null}catch{return null}}
export async function runCurrentSimplifyHealthcare(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs==null&&options.maxDetails==null,'A cap cannot certify the observed native cohort')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREERS,'html']],learnedURL:(url,kind)=>kind==='html'&&roleURL(url)===url}),observations=[]
 async function authority(){
  const home=await reader.read(HOME),homeDoc=readNativeDocument(home.body),careers=await reader.read(CAREERS),doc=readNativeDocument(careers.body)
  need(activeHead(home.body).titles.length===1&&activeHead(home.body).titles[0].includes('Simplify Healthcare')&&homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS&&homeDoc.text(node)==='Current Openings').length>0,'Current corporate employer/careers authority changed')
  need(same(activeHead(careers.body).titles,['Current Openings | Simplify Healthcare'])&&one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'careers canonical').attrs.href===CAREERS,'Current native careers identity changed')
  const main=one(doc.nodes(node=>node.tag==='main'&&node.attrs.id==='main'),'careers main'),cards=doc.nodes(node=>doc.hasClass(node,'vc_grid-item'),main),rows=[]
  need(cards.length<=32,'Observed native cohort exceeds complete own-model read budget')
  for(const card of cards){
   const anchors=doc.nodes(node=>node.tag==='a'&&node.attrs.href&&doc.text(node)==='Apply Now',card),anchor=one(anchors,'native role handoff'),url=roleURL(anchor.attrs.href)
   need(url&&anchor.attrs.title,'Current native role URL/title is unbound')
   rows.push({title:anchor.attrs.title,url,nativeCard:clone(card),nativeText:doc.text(card)})
  }
  need(new Set(rows.map(row=>row.url)).size===rows.length,'Duplicate native role identity')
  return {homepageHTML:home.body,nativeCareerHTML:careers.body,corporateHandoffs:homeDoc.nodes(node=>node.tag==='a'&&node.attrs.href===CAREERS).map(node=>({attrs:node.attrs,text:homeDoc.text(node)})),wholeCareerModel:clone(main),rows,nativeLazyGrids:doc.nodes(node=>node.attrs['data-vc-grid-settings'],main).map(node=>clone(node.attrs)),paginationQualified:false}
 }
 async function detail(row){
  reader.allow(row.url,'html');const page=await reader.read(row.url),doc=readNativeDocument(page.body)
  need(one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'own detail canonical').attrs.href===row.url,'Own native role canonical identity changed')
  need(doc.text(one(doc.nodes(node=>node.tag==='h1'&&doc.hasClass(node,'blog-single-title')),'own role title'))===row.title,'Own native role title disagrees')
  const content=one(doc.nodes(node=>doc.hasClass(node,'blog-single-content')),'whole published own role content')
  const categoryLabels=[...new Set(doc.nodes(node=>node.tag==='a'&&(node.attrs.rel??'').split(' ').includes('tag')&&node.attrs.href?.startsWith(HOME+'category/careers/current-openings/')).map(node=>doc.text(node)))]
  need(categoryLabels.length===1,'Own native country/category authority is ambiguous')
  return {url:row.url,html:page.body,title:row.title,nativeCategoryLabel:categoryLabels[0],explicitNonIndia:categoryLabels[0]==='Aurora, U.S.',wholePublishedContent:clone(content),wholePublishedText:doc.text(content),activeApplyVerified:false}
 }
 try{
  const opening=await authority()
  for(const row of opening.rows){const own=await detail(row);observations.push({nativeOpeningRecord:clone(row),ownOpeningModel:own,nativeDetailURL:row.url,country:null,nativeCountryLabel:own.nativeCategoryLabel,explicitNonIndia:own.explicitNonIndia,applicationURL:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,qualificationIssues:[own.explicitNonIndia?'explicit-native-non-india':'native-role-country-unqualified','complete-rendered-application-eligibility-unqualified','lazy-native-listing-pagination-and-company-scope-unqualified']})}
  const closing=await authority()
  need(same(opening.wholeCareerModel,closing.wholeCareerModel)&&same(opening.rows,closing.rows)&&same(opening.corporateHandoffs,closing.corporateHandoffs),'Opening/closing whole native careers cohort changed')
  for(let index=0;index<closing.rows.length;index++){const observation=observations[index];observation.nativeClosingRecord=clone(closing.rows[index]);observation.ownClosingModel=await detail(closing.rows[index]);need(same(observation.ownOpeningModel,observation.ownClosingModel),'Opening/closing full native own role/criteria changed')}
  reader.check();const jobs=[],summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-employer-native-role-cohort-and-whole-own-content-reconciled-no-qualified-india-role-lazy-pagination-and-company-scope-unknown'})
  attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,wholeCareerOwnedModelClosingReconciled:true,entireDocumentReconciled:false,originalResponses:reader.stats().receipts,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,legacyCityCountryInferenceUsed:false,applicationInteractions:0,nativePaginationQualified:false},configurable:true})
  return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,observations,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},configurable:true})}catch{}throw error}finally{reader.close()}
}
