import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { readNativeDocument, activeHead, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createCurrentReader, need } from './currentRead20261119.js'

const SOURCE='tanishasystems',CAREERS='https://www.tanishasystems.com/currentopenings.html',JOIN='https://www.tanishasystems.com/joinus.html',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261119.json',import.meta.url)))
const one=(nodes,label)=>{need(nodes.length===1,'expected one native '+label);return nodes[0]}
const normalize=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()
const ownLines=node=>{
 if(typeof node==='string')return node
 if(node.inert||node.tag==='script'||node.tag==='a')return ''
 if(node.tag==='br')return '\n'
 return node.children.map(ownLines).join(' ')+(/^(?:p|div|li|h[1-6])$/.test(node.tag)?'\n':'')
}
const locations=new Map([
 ['99 Wood Avenue S., Suite 308, Iselin, NJ 08830',{country:'United States',city:'Iselin'}],
 ['Iselin, NJ, but relocation possible',{country:'United States',city:'Iselin'}],
 ['New York, NY, but relocation possible',{country:'United States',city:'New York'}],
 ['Iselin, NJ or client sites across the U.S.',{country:'United States',city:null,anchorCity:'Iselin'}],
 ['Iselin, NJ or client sites across the U.S. Must be available to travel and relocate to client sites',{country:'United States',city:null,anchorCity:'Iselin'}],
 ['NYC or client sites across the U.S.',{country:'United States',city:null,anchorCity:'New York'}],
 ['Iselin, NJ or unanticipated client sites within the U.S.',{country:'United States',city:null,anchorCity:'Iselin'}],
 ['Iselin, NJ or any unanticipated client sites within the U.S.',{country:'United States',city:null,anchorCity:'Iselin'}],
 ['Iselin, NJ, but relocation possible.',{country:'United States',city:'Iselin'}],
])
const simplifiedTitle=value=>value.replace(/^Job Opening for\s+/i,'').replace(/\s*\(\d+ Openings?\)\s*$/i,'').trim()
const wholeNativeModel=snapshot=>({records:snapshot.records,documents:snapshot.documents.map(page=>({url:page.url,kind:page.kind,text:page.text,sha256:page.sha256,status:page.original.status,finalURL:page.original.url,contentType:page.original.headers['content-type'],bodyBase64:page.original.bodyBase64}))})

function nativeModels(html,joinHTML){
 const doc=readNativeDocument(html),main=one(doc.nodes(n=>n.tag==='main'&&n.attrs.id==='main'),'main'),joinDoc=readNativeDocument(joinHTML)
 need(isDeepStrictEqual(activeHead(html).titles,['Current Openings - Tanisha Systems Inc.']),'publisher title changed')
 need(doc.text(main).includes('You can view our most current openings below on this page.')&&!doc.nodes(n=>n.tag==='base').length,'configured native listing authority changed')
 need(joinDoc.nodes(n=>n.tag==='a'&&n.attrs.href==='mailto:jobs@tanishasystems.com').length>0&&joinDoc.nodes(n=>n.tag==='body').some(n=>joinDoc.text(n).includes('Candidates applying for a particular opening or advertisement from Tanisha Systems than please include the position detail and source.')),'own particular-opening email instructions changed')
 const cards=doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'box'),main),popups=doc.nodes(n=>/^popup-container\d+$/.test(n.attrs.id??''),main)
 need(cards.length===15&&popups.length===15,'current native card/popup inventory changed')
 const bound=new Set()
 const records=cards.map((card,index)=>{
  const title=doc.text(one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'name'),card),'card title')),link=one(doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'button'),card),'card own-popup link'),nativeId=link.attrs.href?.slice(1)
  need(nativeId===`popup-container${index+1}`&&!bound.has(nativeId),'native card/detail identity changed');bound.add(nativeId)
  const popup=one(popups.filter(n=>n.attrs.id===nativeId),'own popup'),container=one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'popup-container'),popup),'full own detail'),headings=doc.nodes(n=>/^h[1-6]$/.test(n.tag),container)
  const lines=ownLines(container).split(/\r?\n/).map(normalize).filter(Boolean),description=lines.join('\n')
  need(headings.length===1&&simplifiedTitle(doc.text(headings[0]))===title||nativeId==='popup-container8'&&headings.length===0&&/^Job Description:\s*Scrum Master\s+is needed to perform the following duties:/i.test(description),'native card/detail title binding changed')
  need(description.length>400&&/(?:Field of study|Education(?:\/Experience)?(?: Requirements)?):/i.test(description)&&!/(?:position (?:is )?closed|no longer accepting applications|job closed|vacancy closed)/i.test(description),'native full criteria/status changed')
  const summaryLocation=doc.text(one(card.children.filter(n=>typeof n==='object'&&n.tag==='div'&&doc.nodes(x=>x.tag==='i'&&doc.hasClass(x,'bi-geo-alt'),n).length===1),'own role summary location'))
  const detailLineIndex=lines.findIndex(line=>/^Job Locations?:/i.test(line)),inlineDetail=detailLineIndex<0?null:lines[detailLineIndex].replace(/^Job Locations?:\s*/i,''),detailLocation=detailLineIndex<0?null:(inlineDetail||lines[detailLineIndex+1]),summary=locations.get(summaryLocation),detail=detailLocation?locations.get(detailLocation):null
  need(summary&&(!detailLocation||detail),'whole native role location changed or contains unresolved country')
  need(!detail||detail.country===summary.country,'native role summary/detail country conflict')
  const apply=one(doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'apply'),container),'own role application mailto')
  need(apply.attrs.href==='mailto:jobs@tanishasystems.com'&&doc.text(apply)==='Apply Now'&&!Object.hasOwn(apply.attrs,'disabled')&&apply.attrs['aria-disabled']!=='true','native own role application changed')
  const count=doc.text(one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'openings'),card),'native openings count')),displayDate=doc.text(one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'date'),card),'native display date'))
  need(/^\d+ Openings?(?: \(F\/T\))?$/.test(count),'native position count changed')
  const cityConflict=Boolean(detail&&(summary.city??summary.anchorCity)!==(detail.city??detail.anchorCity)),sourceUrl=CAREERS+'#'+nativeId
  return {title,company:'Tanisha Systems',source:SOURCE,nativeId,nativeIdKind:'publisher-dom-popup-id',jobId:nativeId,requisitionId:null,sourceUrl,applyUrl:sourceUrl,link:sourceUrl,sourceApplicationEmail:'jobs@tanishasystems.com',sourceApplicationHandoff:'native-own-popup-email-link-with-particular-opening-instructions',backendSubmissionVerified:false,country:summary.country,city:cityConflict?null:(detail??summary).city,location:detailLocation??summaryLocation,sourceSummaryLocation:summaryLocation,sourceDetailLocation:detailLocation,sourceLocationConflict:cityConflict,sourceRoleCountryEvidence:{kind:'exact-whole-native-role-location',summaryLocation,detailLocation,references:profile.geographyReferences},sourceRelocationScopeUnknown:/relocation possible/i.test(summaryLocation+' '+(detailLocation??'')),jobDescription:description,sourceDescription:description,sourceDetailComplete:true,sourceOriginalModel:{card:structuredClone(card),popup:structuredClone(popup)},sourceDisplayDate:displayDate,sourceDateSemantics:'unqualified-native-date-or-start-date-not-assumed-posting-or-closing',postingDate:null,closingDate:null,openingsCount:Number.parseInt(count,10),companyCareerPage:CAREERS,companyDomain:'tanishasystems.com',atsPlatform:'first-party-static-openings-page',sourceListingComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceVacancyStatus:'public-notice-date-and-vacancy-freshness-unqualified',legalEmployer:null}
 })
 need(bound.size===popups.length,'unbound native detail popup')
 return records
}

export async function runCurrentTanisha(options={}){
 const io=createCurrentReader(options,profile)
 try{
  const acquire=async()=>{
   const documents=[]
   for(const row of profile.documents){const page=await io.read(row.url);documents.push({url:row.url,kind:row.kind,...page})}
   const records=nativeModels(documents.find(row=>row.url===CAREERS).text,documents.find(row=>row.url===JOIN).text)
   return {documents,records}
  }
  const opening=await acquire(),closing=await acquire()
  need(isDeepStrictEqual(wholeNativeModel(opening),wholeNativeModel(closing)),'whole native records/programs/HTML closing changed')
  io.check()
  const jobs=opening.records.map(record=>({...record,scrapedAt:typeof options.now==='function'?options.now():new Date().toISOString()})),counts={source:SOURCE,recordKind:'public-job-notices',observedRecordCount:15,observedVacancyCount:15,configuredSurfaceComplete:true,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  attachInventoryEvidence(jobs,{status:'complete-inventory',surface:CAREERS,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:io.stats().requests,reportedTotal:15,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'Complete current configured static notice page: all 15 own card/popup/mailto models and every declared program/stylesheet acquired twice unchanged. Every authored role location is US; source date semantics and company-wide inventory remain unqualified; cleanup held.'})
  attachSourceObservationEvidence(jobs,counts)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...counts,companyZeroProven:false,lifecycleCleanupAllowed:false,fullNativeClosingEqual:true,applicationInteractions:0,backendSubmissionVerified:false,originalModels:{opening,closing},holds:['company-wide-vacancy-and-India-inventory-unqualified','native-notice-dates-and-current-vacancy-freshness-unqualified','no-application-or-email-submitted','legal-employer-unqualified'],acquisition:io.stats()}})
  io.check();return jobs
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'nativeCollectionEvidence',{configurable:true,value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,failedAcquisition:true,acquisition:io.stats()}});options.signal?.throwIfAborted();if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check();throw error}finally{io.close();options.signal?.throwIfAborted()}
}
