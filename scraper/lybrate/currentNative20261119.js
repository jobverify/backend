import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {createCurrentReader} from './currentRead20261119.js'

const SOURCE='lybrate',HOME='https://www.lybrate.com/',ABOUT=HOME+'about',JOBS=HOME+'jobs',API='https://api.lever.co/v0/postings/lybrate?group=team&mode=json'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const cap=(value,label)=>{if(value===undefined)return Infinity;need(Number.isSafeInteger(value)&&value>=0,'invalid '+label);return value}
const pageModel=(html,url)=>{
 const d=readNativeDocument(html),text=n=>d.text(n),headings=d.nodes(n=>/^h[1-6]$/.test(n.tag)).map(text),links=d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({text:text(n),url:new URL(n.attrs.href,url).href})),hiringLinks=links.filter(n=>/job|career|hiring|work with|partner/i.test(n.text+' '+n.url))
 return {d,headings,hiringLinks}
}
export async function runCurrentLybrate(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap'),io=createCurrentReader(options,(url,kind)=>kind==='json'?url===API:kind==='html'&&[HOME,ABOUT,JOBS].includes(url))
 let audit={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,fullPublicModelsClosingReconciled:false,nonEmployerPartnerJobsPromoted:0,medicalArticlesPromoted:0,applicationInteractions:0,publisherProgramsExecuted:false}
 const finish=()=>{const jobs=[];attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOBS,firstParty:io.stats().requests>0,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:typeof options.now==='function'?options.now():new Date().toISOString(),reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'declared-native-inventory-endpoint-unavailable-not-company-zero'});attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...audit,transport:io.stats()},configurable:true});return jobs}
 try{
  if(maxJobs===0||maxPages===0)return finish()
  const phase=async name=>{
   const home=pageModel((await io.read(HOME,{phase:name})).text,HOME)
   need(home.headings.some(t=>t.includes('Lybrate:')),'own homepage publisher changed')
   const about=pageModel((await io.read(ABOUT,{phase:name})).text,ABOUT)
   need(about.headings.some(t=>t.includes('Be a part of Lybrate.'))&&about.hiringLinks.some(a=>a.url===JOBS&&/Hiring|Careers/.test(a.text)),'own careers delegation changed')
   const jobs=await io.read(JOBS,{phase:name}),listing=pageModel(jobs.text,JOBS)
   need(listing.headings.includes('Come work with us!')&&listing.headings.includes('CURRENT OPENINGS'),'own native jobs page changed')
   const programs=listing.d.nodes(n=>n.tag==='script'&&!n.attrs.src).map(n=>n.raw).filter(t=>t.includes('api.lever.co/v0/postings/'))
   need(programs.length===1,'native declared endpoint programme changed')
   // This is the current literal assignment in the own inline renderer. It is
   // read as data; the downloaded program and its AJAX code are never run.
   const declaration=programs[0].match(/\burl\s*=\s*('[^'\r\n]+'|"[^"\r\n]+")/)
   // The current URL contains no JavaScript escapes. An escaped or computed
   // replacement requires a reviewed contract rather than string evaluation.
   const value=declaration&&!declaration[1].includes('\\')?declaration[1].slice(1,-1):null
   need(value===API,'native declared endpoint declaration changed')
   const endpoint=await io.read(value,{phase:name,kind:'json',allowedStatuses:[404]}),payload=JSON.parse(endpoint.text)
   need(payload&&payload.ok===false&&payload.error==='Document not found'&&Object.keys(payload).length===2,'current native endpoint model changed and requires review')
   return {homeHiringLinks:home.hiringLinks,aboutHiringLinks:about.hiringLinks,aboutHeadings:about.headings,listingHeadings:listing.headings,listingHiringLinks:listing.hiringLinks,inlineRenderer:programs[0],nativeEndpoint:{url:value,status:endpoint.status,payload}}
  }
  const opening=await phase('opening'),closing=await phase('closing')
  need(isDeepStrictEqual(opening,closing),'full public careers declaration and native endpoint changed at closing')
  audit={...audit,observedRecordCount:1,fullPublicModelsClosingReconciled:true,...opening,holdReason:'native-inventory-unavailable',wholeCorporateHTMLClosingReconciled:false,declaredInventoryKnownEmpty:false}
  return finish()
 }catch(error){io.check();if(error&&typeof error==='object'&&Object.isExtensible(error))error.sourceAudit={...audit,transport:io.stats()};throw error}finally{io.close()}
}
