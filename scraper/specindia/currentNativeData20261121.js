import {readFileSync} from 'node:fs'
import {isDeepStrictEqual as same} from 'node:util'
import {readCurrentDataCarrier} from './nativeDataCarrier20261121.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {COMPANY,SOURCE,sha,need} from './nativeModels.js'

// A finite original-data observation contract. This profile does not qualify
// the new site's rendering, CSS, client execution, application or company scope.
const profile=JSON.parse(readFileSync(new URL('./reviewedNativeData20261121.json',import.meta.url),'utf8'))
export const CURRENT_DATA_URLS=Object.freeze([profile.homeURL,profile.careerURL,profile.boardURL])
function pin(page,url){
 const declaredTypes=Object.entries(page.headers??{}).filter(([name])=>name.toLowerCase()==='content-type')
 need(declaredTypes.length<=1&&declaredTypes.every(([,value])=>typeof value==='string'&&value===page.contentType),'current original Content-Type metadata contradicts response headers')
 const expected=profile.originals.find(row=>row.url===url)
 need(expected&&page.status===expected.status,'reviewed current native-data response changed: '+url)
 const rawPin=Buffer.byteLength(page.html)===expected.bytes&&sha(page.html)===expected.sha256
 if(page.status!==200){need(rawPin,'reviewed current native-data carrier changed: '+url);return null}
 const carrier=readCurrentDataCarrier(page.html)
 const deliveryPin=typeof expected.nativeDataDeliveryProjectionSHA256==='string'&&expected.nativeDataDeliveryProjectionSHA256===carrier.nativeDataDeliveryProjectionSHA256
 need(rawPin||[expected.nativeDataProjectionSHA256,...(expected.additionalNativeDataProjectionSHA256s??[])].includes(carrier.projectionSHA256)||deliveryPin,'reviewed current native-data carrier changed: '+url)
 return{...carrier,rawOriginalPinMatched:rawPin}
}

function ownJobData(records){
 const selected=id=>{const rows=records.get(id);need(rows?.length===1,'missing or ambiguous selected current native record '+id);return rows[0]}
 const literal=id=>{const row=selected(id);if(row.kind==='text')return row.raw;try{return JSON.parse(row.raw)}catch{need(false,'nonliteral selected native model '+id)}}
 const reference=value=>{const match=typeof value==='string'&&/^\$([0-9a-f]+)$/i.exec(value);return match?literal(match[1]):value}
 // The conflicting b:X/b:C stream controls are retained in the original HTML.
 // They are not interpreted, merged or used as a selected model reference.
 const owner=profile.jobOwner,root=literal(owner.record)
 need(sha(JSON.stringify(root))===profile.rootModelSHA256,'whole current native owner model changed')
 let element=root
 for(const part of owner.path){need(element!==null&&typeof element==='object'&&Object.hasOwn(element,part),'current native owner path changed');element=element[part]}
 need(Array.isArray(element)&&element.length===4&&element[0]==='$'&&element[1]===owner.reference,'current job model lost its owning component')
 const imported=selected(owner.reference.slice(2)).raw;need(imported.startsWith('I['),'current native client import changed')
 let model;try{model=JSON.parse(imported.slice(1))}catch{need(false,'current native import is nonliteral')}
 need(model.length===3&&model[0]===owner.moduleId&&reference(model[2])===owner.exportName&&same(model[1].map(reference),owner.chunks),'current native job owner/module declarations changed')
 need(same(element[3],profile.props),'whole current native departments, jobs or criteria changed')
 return structuredClone(element[3])
}
const textOf=node=>typeof node?.text==='string'?node.text:Array.isArray(node?.children)?node.children.map(textOf).join(node.type==='list'?'\n':''):''

export async function runCurrentSpecData({entry,read,receipts,originals,options,cap,now,started,abortable}){
 const signal=options.signal;signal?.throwIfAborted()
 need(entry.status===308&&entry.headers.location==='/career','unreviewed current native migration redirect')
 pin(entry,profile.entryURL)
 const snapshot=async()=>{
  const pages=[]
  for(const url of CURRENT_DATA_URLS){const page=await read(url);page.nativeDataCarrier=pin(page,url);pages.push(page);signal?.throwIfAborted()}
  // Full original DATA projections preserve every reviewed home/career byte
  // except exact decoded email keys and literal stream delivery positions.
  // The careers content is inside React's hidden S:2 boundary. We do not
  // promote it to active navigation or qualify the reveal/client programme.
  return{pages,props:ownJobData(pages[2].nativeDataCarrier.records)}
 }
 const opening=await snapshot(),closing=await snapshot();signal?.throwIfAborted()
 need(same(opening.props,closing.props),'closing whole current native role models changed')
 need(receipts.length===7,'current native seven-read boundary changed')
 const completed=Date.now();let prior=started
 const transport=receipts.every(row=>{const a=Date.parse(row.startedAt),b=Date.parse(row.completedAt),valid=row.requestedURL===row.url&&row.finalURL===row.url&&row.method==='GET'&&[200,308].includes(row.status)&&(row.status===308||row.responseContentTypePresent&&/^text\/html\b/i.test(row.contentType??''))&&Number.isFinite(a)&&Number.isFinite(b)&&a>=prior&&b>=a&&b<=completed;prior=b;return Boolean(valid)})
 const audit={source:SOURCE,scope:'finite-native-data-only',nativeDataRepresentations:[...opening.pages,...closing.pages].map((page,index)=>({url:CURRENT_DATA_URLS[index%CURRENT_DATA_URLS.length],rawOriginalPinMatched:page.nativeDataCarrier.rawOriginalPinMatched,projectionSHA256:page.nativeDataCarrier.projectionSHA256,projection:page.nativeDataCarrier.projection,carrierPositions:page.nativeDataCarrier.carrierPositions,frameCount:page.nativeDataCarrier.frameCount})),streamDeliveryAndRenderingQualified:false,originalResponses:receipts,rawNativeOriginals:originals,openingWholeNativeProps:opening.props,closingWholeNativeProps:closing.props,wholeNativeRoleModelsClosingReconciled:true,transportEvidenceWithinRun:transport,sourceRenderedDetailComplete:false,sourceClientQualified:false,sourceCSSQualified:false,applicationQualified:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0}
 const observations=opening.props.jobs.map(row=>{
  need(Object.keys(row).length===12&&row.jobLocation==='Ahmedabad, India','unreviewed current role identity, fields or explicit country')
  const closingRole=closing.props.jobs.find(value=>value.documentId===row.documentId)
  need(closingRole&&same(row,closingRole),'closing native full role/criteria mismatch')
  const criteria=row.responsibilities.map(textOf).join('\n'),description=[row.title,'Experience: '+row.experience,'Openings: '+row.openings,'Job Type: '+row.jobType,'Job Location: '+row.jobLocation,'Skills: '+row.skills.map(skill=>skill.title).join(', '),criteria].join('\n\n')
  need(criteria.length>=150,'complete native criteria missing')
  return{title:row.title,company:COMPANY,source:SOURCE,sourceUrl:profile.boardURL,link:null,applyUrl:null,jobId:String(row.id),requisitionId:null,nativePostingID:null,nativeCMSContentID:String(row.id),sourceNativeCMSPostId:String(row.id),nativeDocumentID:row.documentId,nativeObservationKey:SOURCE+':native-document:'+row.documentId,nativeObservationKeyIsNotPostingID:true,nativePublishedRoleURL:null,nativeCanonicalRoleURL:null,nativeApplicationURL:null,location:row.jobLocation,city:null,state:null,country:'India',department:row.category.map(value=>value.title).join(', '),employmentType:row.jobType,experienceRequired:row.experience,numberOfOpenings:row.openings,requiredSkills:row.skills.map(value=>value.title),minimumQualification:null,preferredQualification:null,postingDate:null,postedAt:null,nativePostingDate:null,closingDate:null,sourcePublicationDateUnavailable:true,remoteStatus:null,sourceRemoteStatusUnresolved:true,jobDescription:description,sourceDescription:description,nativeWholeCriteriaText:criteria,nativeSourceRecord:{role:structuredClone(row),departments:structuredClone(opening.props.departments),activeDepartment:opening.props.active},nativeClosingRecord:{role:structuredClone(closingRole),departments:structuredClone(closing.props.departments),activeDepartment:closing.props.active},sourceRawNativeRole:opening.pages[2].html,sourceRawNativeRoleSHA256:sha(opening.pages[2].html),sourceRawClosingNativeRole:closing.pages[2].html,sourceRawClosingNativeRoleSHA256:sha(closing.pages[2].html),sourceDetailComplete:transport,sourceDetailCompletenessScope:'native-data-only',sourceNativeDataOnly:true,sourceRenderedDetailComplete:false,sourceClientQualified:false,sourceCSSQualified:false,nativeRoleCriteriaReconciled:true,nativeRoleClosingReconciled:true,sourceCorporateBindingQualified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,nativeCollectionAudit:audit}
 })
 if(options.onAudit)await abortable(()=>options.onAudit(structuredClone({...audit,observations})),signal)
 const jobs=observations.slice(0,cap).map(row=>{let scrapedAt;try{scrapedAt=now()}catch(error){signal?.throwIfAborted();throw error}signal?.throwIfAborted();return{...row,companyCareerPage:profile.careerURL,companyDomain:'spec-india.com',scrapedAt}})
 Object.defineProperty(jobs,'sourceAudit',{value:audit});signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.boardURL,firstParty:false,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,reason:'Finite native-data observations only; rendering, client, CSS, applications, complete company inventory and lifecycle cleanup remain unqualified'})
}
