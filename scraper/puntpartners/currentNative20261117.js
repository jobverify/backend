import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const SOURCE='puntpartners',HOMEPAGE_URL='https://punt.partners/',TEAM_URL=HOMEPAGE_URL+'team/',PARTNERS_URL=HOMEPAGE_URL+'partners/',CAREERS_URL=HOMEPAGE_URL

const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(rows,label)=>{need(rows.length===1,'Expected one native '+label);return rows[0]}
const jobType=v=>Array.isArray(v)?v.some(jobType):typeof v==='string'&&/(?:^|[/#:])JobPosting$/i.test(v),hasJob=v=>!!v&&typeof v==='object'&&(jobType(v['@type'])||Object.values(v).some(hasJob))
function documentModel(page){
 const doc=readNativeDocument(page.body),title=one(activeHead(page.body).titles,'title'),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href,body=one(doc.nodes(n=>n.tag==='body'),'whole body')
 need(canonical===page.url&&!doc.nodes(n=>n.tag==='base').length,'Current own canonical/base changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'New authoritative JobPosting requires vacancy review')
 return {url:page.url,title,canonical,structured,wholeAuthoredBody:structuredClone(body),wholeAuthoredText:doc.text(body),links:doc.nodes(n=>n.tag==='a').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''})),nativeDates:doc.nodes(n=>n.tag==='time').map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n)})),wholeOriginalHTML:page.body}
}
const semantic=m=>({url:m.url,title:m.title,canonical:m.canonical,structured:m.structured,wholeAuthoredText:m.wholeAuthoredText,links:m.links,nativeDates:m.nativeDates})

const titles=new Map([[HOMEPAGE_URL,'Punt Partners'],[TEAM_URL,'Team – Punt Partners'],[PARTNERS_URL,'Investors – Punt Partners']])
export function readCurrentPunt(page){const m=documentModel(page);need(m.title===titles.get(page.url),'Current Punt publisher title changed');need(m.links.some(n=>n.attrs.href===TEAM_URL)&&m.links.some(n=>n.attrs.href===PARTNERS_URL),'Current own team/investor declarations changed');need(!m.links.some(n=>{try{return /\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacancies)(?:\/|$)/i.test(new URL(n.attrs.href??'',page.url).pathname)||/\b(?:careers?|current openings?|open positions?|apply now|send (?:your )?(?:CV|resume))\b/i.test(n.text)}catch{return false}}),'New authored hiring declaration requires acquisition review');return m}
export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; native inventory is unknown')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[...titles.keys()].map(url=>[url,'html'])});let opening,closing
 async function authority(){const result={};for(const [key,url] of [['home',HOMEPAGE_URL],['team',TEAM_URL],['investors',PARTNERS_URL]])result[key]=readCurrentPunt(await reader.read(url));return result}
 try{
  opening=await authority();closing=await authority();need(isDeepStrictEqual(Object.values(opening).map(semantic),Object.values(closing).map(semantic)),'Closing whole observed corporate model changed');reader.check()
  const observations=[],holds=['current-home-team-and-investors-corporate-content-is-not-a-vacancy-inventory','no-authored-native-hiring-record-in-observed-corporate-cohort;unexecuted-programmes-and-other-company-inventory-remain-unknown','no-guessed-missing-career-routes-or-company-zero-proof']

  const jobs=[],summary={source:SOURCE,recordKind:SOURCE==='storeking'?'vacancy-rows':'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:SOURCE==='storeking'?observations.length:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,companyGlobalZeroProven:false,corporateCountryIsRoleCountry:false,publicApplicationEligibilityQualified:false,sourceNativeApplicationCriteriaVerified:false,activeApplyVerified:false,applicationInteractions:0,programmesExecuted:false,wholeCompanyScopeProven:false,sourceNativeRequests:reader.stats().requests,originalResponses:reader.stats().receipts,holds}
  need(Buffer.byteLength(JSON.stringify(audit))<=24*1024*1024,'Native output evidence byte ceiling exceeded');Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:holds.join(';')});reader.check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object'){Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true});Object.defineProperty(error,'abortRetries',{value:true,configurable:true})}}catch{}options.signal?.throwIfAborted();throw error}
 finally{reader.close();options.signal?.throwIfAborted()}
}
