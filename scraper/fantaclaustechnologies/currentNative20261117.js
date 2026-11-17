import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeLines,authoredNativeLines,comparable} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOwnedCurrentDocument} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const profile=JSON.parse(readFileSync(new URL('./reviewedNative20261117.json',import.meta.url)))
const LEGAL='https://fantaclaus.com/',HOME='https://inteligenai.com/',CAREERS='https://inteligenai.com/careers/'
const fail=message=>firstPartyFailure('fantaclaustechnologies','Fantaclaus native '+message,{nativeAuthorityFailure:true}),need=(ok,message)=>{if(!ok)throw fail(message)}

export function extractCurrentFantaclaus(html){
 const owned=readOwnedCurrentDocument(html,{failure:fail,title:'Careers - inteligenai',canonical:CAREERS}),raw=owned.raw,visible=readVisibleNativeDocument(html,{strict:true})
 const pages=raw.nodes(n=>n.attrs['data-elementor-id']===profile.wordpressNativePageId)
 need(pages.length===1,'publisher WordPress page identity changed')
 const allHeadings=raw.nodes(n=>n.tag==='h3',pages[0]).map(n=>raw.text(n))
 need(isDeepStrictEqual(allHeadings,['Know more about InteligenAI',...profile.sections.map(s=>s.title)]),'complete current authored entry cohort changed')
 const models=profile.sections.map(expected=>{
  const nodes=raw.nodes(n=>n.attrs['data-id']===expected.containerNativeId,pages[0]),shown=visible.nodes(n=>n.attrs['data-id']===expected.containerNativeId)
  need(nodes.length===1&&shown.length===1,'own native role is unavailable or hidden')
  const node=nodes[0],headings=raw.nodes(n=>n.tag==='h3',node)
  need(headings.length===1&&raw.text(headings[0])===expected.title,'own native heading identity changed')
  const criteria=nativeLines(shown[0]).join('\n')
  need(criteria.length>=300&&comparable(criteria)===comparable(authoredNativeLines(node).join('\n')),'full own criteria are hidden or incomplete')
  need(isDeepStrictEqual(node,expected.nativeModel)&&criteria===expected.criteria,'complete reviewed native role model changed')
  const qualificationHolds=expected.recordKind==='vacancy-rows'
   ?['work-country-unpublished;bare-city-not-country-proof','declared-application-last-observed-login-required-401;full-application-criteria-unqualified']
   :expected.recordKind==='hiring-signals'
    ?['campus-recruitment-programme;not-a-job-vacancy','declared-application-last-observed-native-closedform;not-accepting-responses','work-country-unpublished']
    :['publisher-explicitly-marks-hiring-closed;excluded-from-current-vacancies','work-country-unpublished']
  return {...expected,nativeModel:structuredClone(node),criteria,applicationQualificationComplete:false,applicationReviewObservedAt:profile.reviewedAt,sourceCountryScopeUnresolved:true,publicationQualified:false,lifecycleCleanupAllowed:false,qualificationHolds}
 })
 const rows=models.filter(m=>m.recordKind==='vacancy-rows').map(m=>({
  source:'fantaclaustechnologies',company:'Fantaclaus Technologies',companyName:'Fantaclaus Technologies',companyDomain:'inteligenai.com',companyCareerPage:CAREERS,atsPlatform:'official-company-careers',
  title:m.title,jobId:'inteligenai-3055-'+m.containerNativeId,requisitionId:null,country:null,city:null,location:null,
  sourceUrl:CAREERS,applyUrl:m.applyURL,link:m.applyURL,postingDate:null,closingDate:null,
  jobDescription:m.criteria,sourceDescription:m.criteria,sourceDescriptionLines:m.criteria.split('\n'),sourceDetailComplete:true,sourceNativeRoleModel:m.nativeModel,
  sourceCountryScopeUnresolved:true,sourceApplicationQualificationComplete:false,sourceRenderedCriteriaComplete:false,activationVerified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  sourceQualificationHolds:['country-unpublished;bare-Gurugram-does-not-prove-work-country','declared-application-last-observed-login-required;application-criteria-not-qualified','broader-company-scope-unproved'],
 }))
 return {rows,models}
}
export async function runCurrentFantaclaus(options,signals){
 options.signal?.throwIfAborted();need(!options.fetchPage,'Original HTTP metadata required; legacy body-only callback cannot qualify current careers')
 const maxJobs=options.maxJobs??100;need(Number.isSafeInteger(maxJobs)&&maxJobs>=1&&maxJobs<=100,'invalid caller output cap')
 const reader=createCurrentNativeReader(options,{source:'fantaclaustechnologies',admitted:[[LEGAL,'html'],[HOME,'html'],[CAREERS,'html']]}),phases=[]
 try{
  for(const phase of ['opening','closing']){
   const legal=(await reader.read(LEGAL)).body;need(signals.legal(legal),'legal redirect authority changed')
   const homepage=(await reader.read(HOME)).body;readOwnedCurrentDocument(homepage,{failure:fail,title:'Custom AI Development for Enterprise | InteligenAI',canonical:HOME});need(signals.home(homepage),'legal/branded employer handoff changed')
   const original=await reader.read(CAREERS);need(signals.careers(original.body),'current employer careers authority changed')
   const extracted=extractCurrentFantaclaus(original.body);phases.push({...extracted,completeOriginalCareersSHA256:original.sha256})
  }
  need(isDeepStrictEqual(phases[0],phases[1]),'complete current authored models changed at closing')
  const observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
  const rows=phases[0].rows.slice(0,maxJobs).map(row=>({...row,scrapedAt:observedAt,sourceNativeClosingRoleModel:structuredClone(phases[1].models.find(m=>m.containerNativeId===row.sourceNativeRoleModel.attrs['data-id']).nativeModel)}))
  const audit={source:'fantaclaustechnologies',recordKind:'mixed',observedRecordCount:phases[0].models.length,observedVacancyCount:phases[0].models.filter(m=>m.recordKind==='vacancy-rows').length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,nativeModelsClosingReconciled:true,
   currentAuthoredEntries:phases[0].models.filter(m=>m.recordKind!=='closed-native-role'),archivedEntries:phases[0].models.filter(m=>m.recordKind==='closed-native-role'),opening:phases[0],closing:phases[1],reader:reader.stats(),
   applicationReview:{observedAt:profile.reviewedAt,vacancyForms:'both-declared-public-forms-redirected-to-Google-login-required-401',campusProgramme:'declared-form-redirected-to-native-closedform;not-a-vacancy',currentApplicationCriteriaVerified:false}}
  attachSourceObservationEvidence(rows,audit);Object.defineProperty(rows,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(rows,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-three-authored-entries-and-six-closed-role-models-reconciled;two-vacancies-country/application-unresolved;campus-programme-not-vacancy;no-company-scope-proof'})
  reader.check();return rows
 }finally{reader.close()}
}
