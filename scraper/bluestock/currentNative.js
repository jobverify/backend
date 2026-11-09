import {publicRead,stable,need} from '../alohatechnology/publicRead.js'
import {readHighlights,readCategories,bindApplication} from './native.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='bluestock',COMPANY='Bluestock Fintech',CAREERS='https://bluestock.in/careers/',CATEGORIES=CAREERS+'jobs/'
export const runCurrentBluestock=options=>publicRead({source:SOURCE,company:COMPANY},options,async({read,stamp,audit,publicPages})=>{
 const verifiedAt=stamp(),snapshot=async phase=>{
  const highlights=readHighlights(await read(CAREERS,{phase})),categories=readCategories(await read(CATEGORIES,{phase})),promotions=[]
  need(highlights.length>0||categories.length>0,COMPANY,'native public promotion/category observations disappeared')
  for(const row of highlights){const publicLanding=await read(row.applyUrl,{phase});promotions.push(bindApplication(row,publicLanding))}
  return{promotions,categories}
 },first=await snapshot('initial'),closing=await snapshot('closing')
 need(stable(first)===stable(closing),COMPANY,'closing native promotions, category signals or public application title bindings changed')
 const observations=[...first.promotions.map(row=>({...row,kind:'native-promoted-role',sourceDetailComplete:false,fullNativeCriteriaAvailable:false,country:null,jobId:null,requisitionId:null,currentVacancyState:null,reason:'native-promotion-has-no-published-full-role-criteria-or-work-country'})),...first.categories.map(row=>({...row,kind:'native-category-count',vacancyCountQualified:false}))]
 const evidence={status:'coverage-gap',surface:CAREERS,firstParty:publicPages.every(p=>p.status===200&&p.responseIdentity==='validated-public-response'),listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'native-promotions-and-generic-category-counts;full-role-criteria-work-countries-and-unique-inventory-unpublished'}
 await audit({verifiedAt,observations,identityConflictCount:first.promotions.filter(p=>p.rawNativeRoleEvidence.applicationRoleConflict).length,observedCategories:first.categories,promotedRoleCount:first.promotions.length,fullNativeDescriptionRecords:0,closingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,inventoryEvidence:evidence,publicApplicationReview:'Only published public landing titles are role binding evidence; application questions, private steps and full-form hashes are not inventory prerequisites.'})
 // Original promotions survive as source observations; no description or
 // workplace is invented to turn an application label into a persistence row.
 const jobs=attachInventoryEvidence([],evidence)
 return attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:first.promotions.length&&first.categories.length?'mixed':first.promotions.length?'vacancy-rows':'categories',observedRecordCount:observations.length,observedVacancyCount:first.promotions.length,sourceScopeComplete:false})
})
