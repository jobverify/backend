import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='fabhotels',HOME='https://www.fabhotels.com/',CAREERS=HOME+'careers/'
const ROUTE_SHA='a908978abbfbe07e24583ed57df1fece301619a31cb5dc61c809b9de66fddd77',VISIBLE_SHA='36c8ebff4789c88d87f345149ca7c5d32e5810bee26b08542eb748b5a669ebc5',PROGRAMS_SHA='4eb092363fe40a1b9544732192d11cbb3b33ff0583e1d34638d3ae956b9a7c75'
const CONTACT='mailto:jobs@fabhotels.com?subject=FabHotels%20Careers%20Application:%20Executive/Senior%20Executive%20%E2%80%93%20Travel%20Agent%20Sales'
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
export async function runCurrentFabHotels(options={}){
 options.signal?.throwIfAborted()
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(now)),'Invalid native observation clock')
 const reader=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREERS,'html']]})
 async function authority(){
  const homepage=await reader.read(HOME),home=readNativeDocument(homepage.body),careers=await reader.read(CAREERS),doc=readNativeDocument(careers.body)
  need(activeHead(homepage.body).titles.length===1&&activeHead(homepage.body).titles[0]==="FabHotels: India's Best Budget Hotels | Online Hotel Booking",'Current native corporate employer identity changed')
  need(home.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers'&&home.text(n)==='Careers').length===1,'Current native corporate careers handoff changed')
  const corporateText=home.nodes(n=>n.tag==='root').map(n=>home.text(n)).join(' ');need(corporateText.includes('Travelstack Tech Limited'),'Current native corporate employer authority changed')
  // The complete literal Careers route, visible document and actual program
  // declarations are reviewed as a contact-only profile. Native Flight26 is
  // unrelated homepage SEO/hotel pricing/review data; retain it in originals,
  // but never certify it as recruitment input or company inventory authority.
  const records=readLiteralFlightRecords(careers.body);need(records?.size>0,'Missing whole native careers Flight input')
  const route=records.get('0'),visibleText=doc.nodes(n=>n.tag==='root').map(n=>doc.text(n)).join(' ')
  const programs=doc.nodes(n=>n.tag==='script').filter(n=>!n.raw?.trim().startsWith('self.__next_f.push(')).map(n=>({attributes:n.attrs,bodySHA256:sha(n.raw??'')}))
  need(route?.raw&&sha(route.raw)===ROUTE_SHA&&sha(visibleText)===VISIBLE_SHA&&sha(JSON.stringify(programs))===PROGRAMS_SHA&&!doc.nodes(n=>['iframe','form','object','embed'].includes(n.tag)).length&&!careers.body.includes('JobPosting'),'Whole current native career HTML/route/visible criteria/program changed; inventory remains unknown')
  const headings=doc.nodes(n=>n.tag==='h1').map(n=>doc.text(n)),contacts=doc.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith('mailto:'))
  need(JSON.stringify(headings)==='["Hi, Guest","Careers"]'&&contacts.length===1&&contacts[0].attrs.href===CONTACT&&doc.text(contacts[0])==='jobs@fabhotels.com','Current native employer careers contact changed')
  const careerAuthority={officialHome:HOME,officialCareers:CAREERS,nativeContactURL:CONTACT,headings,wholeCareerOwnedRoute:structuredClone(route),wholeVisibleDocumentText:visibleText,programDeclarations:programs,nativeCorporateAuthority:{title:activeHead(homepage.body).titles[0],careersHref:'/careers',legalFooter:'Travelstack Tech Limited'},nativeRoleModels:[],mailSubjectTreatedAsVacancy:false}
  return {...careerAuthority,careerAuthority,nativeCareerHTML:careers.body,nativeCareerModel:[...records].map(([id,value])=>({id,...value})),careersHTMLSHA256:sha(careers.body)}
 }
 try{
  const opening=await authority(),closing=await authority();need(JSON.stringify(opening.careerAuthority)===JSON.stringify(closing.careerAuthority),'Opening/closing whole native career-owned input changed');reader.check()
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-whole-native-careers-contact-model-reconciled-no-vacancy-cohort-company-inventory-unknown'})
  const summary={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null};attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,originalResponses:reader.stats().receipts,observations:[],wholeObservedNativeInputClosingReconciled:false,wholeCareerOwnedModelClosingReconciled:true,entireDocumentReconciled:false,nonCareerPublisherDataChanged:opening.nativeCareerHTML!==closing.nativeCareerHTML,unqualifiedNonCareerModel:'Flight26 homepage SEO/hotel pricing/review data; retained in original models, excluded from recruitment scope',companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,applicationInteractions:0,legacyCityCountryInferenceUsed:false},configurable:true});return jobs
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,originalResponses:reader.stats().receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},configurable:true,enumerable:true})}catch{};throw error}finally{reader.close()}
}
