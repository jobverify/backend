import {setTimeout as delay} from 'node:timers/promises'
import {readCurrentHpclDocument,isOwnHpclDocument} from './currentDocuments20261117.js'
import {isDeepStrictEqual} from 'node:util'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)},one=(nodes,label)=>{need(nodes.length===1,'Expected one current native '+label);return nodes[0]},has=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const jobType=value=>Array.isArray(value)?value.some(jobType):typeof value==='string'&&/(?:^|[/#:])JobPosting$/i.test(value)
const hasJob=value=>!!value&&typeof value==='object'&&(jobType(value['@type'])||Object.values(value).some(hasJob))
export const SOURCE='hpcl',COMPANY='HPCL',HOMEPAGE_URL='https://www.hindustanpetroleum.com/',CAREERS_URL=HOMEPAGE_URL+'careers',JOB_OPENINGS_URL=HOMEPAGE_URL+'job-openings'
export function readCurrentHpcl(html,url){
 const doc=readNativeDocument(html),title=one(activeHead(html).titles,'document title'),root=one(doc.nodes(n=>n.tag==='html'),'whole own document'),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs.href)
 need(title===(url===HOMEPAGE_URL?'Hindustan Petroleum Corporation Ltd. | Oil and Gas Company in India | HPCL':'Job Opening | HPCL Careers | Oil Gas Industry Jobs')&&!doc.nodes(n=>n.tag==='base').length&&canonical.every(value=>value===url),'Current own HPCL title/canonical/base changed')
 need(doc.text(root).includes('Hindustan Petroleum Corporation Limited'),'Current native HPCL employer identity changed')
 const handoffs=doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/job-openings'&&doc.text(n)==='Job Openings').map(n=>({href:n.attrs.href,text:doc.text(n)}));need(handoffs.length>0,'Current corporate own Job Openings declaration changed')
 const structured=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>readLiteralModel(n.raw).value);need(!structured.some(hasJob),'Current native JobPosting requires individual vacancy acquisition review')
 return {doc,title,canonical,handoffs,structured,wholeOriginalHTML:html,programmeDeclarations:doc.nodes(n=>n.tag==='script').map(n=>({attrs:structuredClone(n.attrs),body:n.raw??''}))}
}
export function readCurrentHpclAnnouncements(model){
 const {doc}=model;need(doc.nodes(n=>n.tag==='h4'&&doc.text(n)==='Our Current Openings').length===1,'Current whole own opening-announcement context changed')
 const accordion=one(doc.nodes(n=>n.attrs.id==='accordion'),'whole native notification accordion'),cards=doc.nodes(n=>has(n,'card'),accordion);need(cards.length>0,'Current native notification inventory unavailable')
 const observations=cards.map(card=>{const heading=one(doc.nodes(n=>has(n,'card-header'),card),'notification heading'),body=one(doc.nodes(n=>has(n,'card-body'),card),'complete notification body'),title=doc.text(heading)
  return {recordKind:'recruitment-notification',title,nativeText:doc.text(body),wholeNativeCard:structuredClone(card),nativeDeclarations:doc.nodes(n=>n.tag==='a',body).map(n=>({attrs:structuredClone(n.attrs),text:doc.text(n),resolvedURL:n.attrs.href?new URL(n.attrs.href,JOB_OPENINGS_URL).href:null})),country:null,jobId:null,postingDate:null,closingDate:null,criteria:null,individualVacancyQualified:false,documentCriteriaQualified:false,activeApplicationWindowQualified:false,loginIsVacancyAuthority:false,applicationInteractions:0}}).filter(r=>!['Job Updates Form','Documents'].includes(r.title))
 need(observations.length>0&&new Set(observations.map(r=>r.title)).size===observations.length,'Native recruitment notifications unavailable or ambiguous')
 return {observations,wholeNativeAccordion:structuredClone(accordion),browserAccordionActivationQualified:false}
}
export async function runCurrentHpcl(options={}){
 options.signal?.throwIfAborted();need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'Invalid output limit; notifications cannot be truncated')
 const controller=new AbortController(),sourceTimeoutMs=options.sourceTimeoutMs??180000,started=performance.now(),timeoutReason=new DOMException('hpcl source deadline exceeded','TimeoutError'),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const reader=createCurrentNativeReader({...options,signal},{source:SOURCE,admitted:[[HOMEPAGE_URL,'html'],[JOB_OPENINGS_URL,'html']]});let opening,closing,pdfBytes=0;const pdfReceipts=[]
 const timer=setTimeout(()=>controller.abort(timeoutReason),sourceTimeoutMs),check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(timeoutReason);signal.throwIfAborted();reader.check()},bytesRead=bytes=>{pdfBytes+=bytes;need(pdfBytes+reader.stats().decodedBytes<=32*1024*1024,'Aggregate native HTML/PDF32MiB byte ceiling exceeded')}
 const receipts=()=>[...reader.stats().receipts,...pdfReceipts].sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt)),requestCount=()=>reader.stats().requests+pdfReceipts.length
 async function authority(phase){const home=readCurrentHpcl((await reader.read(HOMEPAGE_URL)).body,HOMEPAGE_URL),openings=readCurrentHpcl((await reader.read(JOB_OPENINGS_URL)).body,JOB_OPENINGS_URL),notifications=readCurrentHpclAnnouncements(openings),model={home:{title:home.title,canonical:home.canonical,handoffs:home.handoffs,structured:home.structured,programmeDeclarations:home.programmeDeclarations,wholeOriginalHTML:home.wholeOriginalHTML},openings:{title:openings.title,canonical:openings.canonical,structured:openings.structured,programmeDeclarations:openings.programmeDeclarations,wholeOriginalHTML:openings.wholeOriginalHTML},notifications,documents:[]}
  if(phase==='opening')opening=model;else closing=model
  const urls=[...new Set(notifications.observations.flatMap(n=>n.nativeDeclarations).filter(a=>!/Hindi/i.test(a.text)&&/Detailed Advertisement|View Window Advertisement|English Advt|Corrigendum|Addendum/i.test(a.text)).map(a=>a.resolvedURL))]
  need(urls.length>0&&urls.length<=16&&urls.every(isOwnHpclDocument),'Current native public advertisement declarations require review')
  for(const url of urls){check();model.documents.push(await readCurrentHpclDocument(url,{options,signal,check,receipts:pdfReceipts,bytesRead}))}
  return model}

 const semantic=model=>({home:{title:model.home.title,canonical:model.home.canonical,handoffs:model.home.handoffs,structured:model.home.structured},openings:{title:model.openings.title,canonical:model.openings.canonical,structured:model.openings.structured},notifications:model.notifications,documents:model.documents.map(d=>({url:d.url,sha256:d.sha256,bytes:d.bytes}))})
 try{opening=await authority('opening');try{await delay(500,undefined,{signal})}catch(error){options.signal?.throwIfAborted();check();throw error}check();closing=await authority('closing');need(isDeepStrictEqual(semantic(opening),semantic(closing)),'Closing whole native notification/advertisement declaration model changed');check()
  const jobs=[],observations=opening.notifications.observations,summary={source:SOURCE,recordKind:'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null};attachSourceObservationEvidence(jobs,summary)
  const audit={...summary,nativeOpening:opening,nativeClosing:closing,observations,wholeObservedAnnouncementModelsClosingMatch:true,nativeAdvertisementDocumentsRead:true,selectedNativePublicDocumentCount:opening.documents.length,nativeTextCompletenessQualified:false,advertisementCriteriaQualified:false,individualVacancyCohortQualified:false,browserAccordionActivationQualified:false,loginIsVacancyAuthority:false,publicApplicationEligibilityQualified:false,nativeInventoryQualified:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,applicationInteractions:0,sourceNativeRequests:requestCount(),originalResponses:receipts(),holds:['notification-and-grouped-programme-not-individual-vacancy-records','native-advertisement-document-criteria-and-individual-work-country-unqualified','historical-Officers-July-window-retained-not-reopened-by-login-link','complete-selected-public-PDF-bodies-retained-but-glyph-text-and-full-criteria-unqualified','other-linked-application-annexes-and-full-client-semantics-unqualified','company-inventory-unknown']}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOB_OPENINGS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:requestCount(),reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'current-own-recruitment-announcement-models-reconciled;individual-vacancy-country-document-criteria-and-company-inventory-unqualified'})
  check();return result
 }catch(error){options.signal?.throwIfAborted();try{if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,nativeOpening:opening,nativeClosing:closing,originalResponses:receipts(),sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null},configurable:true})}catch{}throw error}finally{clearTimeout(timer);controller.abort();reader.close()}
}
