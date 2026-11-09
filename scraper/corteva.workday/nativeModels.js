import {isDeepStrictEqual} from 'node:util'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {need,roleURL} from './nativeDeclarations.js'

const text=v=>typeof v==='string'&&v.trim().length>0
const exactKeys=(o,keys,label)=>need(o&&typeof o==='object'&&!Array.isArray(o)&&isDeepStrictEqual(Object.keys(o).sort(),[...keys].sort()),label+' fields changed')
const listingKeys=['id','displayJobId','name','locations','standardizedLocations','postedTs','solrScore','stars','department','creationTs','isHot','workLocationOption','locationFlexibility','atsJobId','positionUrl']
const roleKeys=listingKeys.filter(k=>k!=='solrScore').concat(['jobDescription','location','publicUrl','efcustomTextLocation','efcustomTextWorkArrangement','efcustomTextAdditionalLocation','jdHighlight','positionExtraDetails','positionUserActions'])
const envelope=model=>{
 exactKeys(model,['status','error','data','metadata'],'response envelope')
 need(model.status===200&&isDeepStrictEqual(model.error,{message:'',body:''})&&model.metadata===null,'error or fallback response metadata')
}
function listing(row){
 exactKeys(row,listingKeys,'listing')
 need(Number.isSafeInteger(row.id)&&row.id>0&&text(row.name)&&text(row.atsJobId)&&row.atsJobId===row.displayJobId,'listing native identity differs')
 need(row.positionUrl==='/careers/job/'+row.id,'listing role path differs')
 need(Array.isArray(row.locations)&&row.locations.length>0&&row.locations.every(text)&&Array.isArray(row.standardizedLocations)&&row.standardizedLocations.length===row.locations.length&&row.standardizedLocations.every(text),'missing own worksite country aliases')
 return row
}
export function indiaCandidate(row){
 listing(row)
 const named=row.locations.some(l=>l.endsWith(', India')),coded=row.standardizedLocations.some(l=>l.endsWith(', IN'))
 if(!named&&!coded)return false
 need(row.locations.every(l=>l.endsWith(', India'))&&row.standardizedLocations.every(l=>l.endsWith(', IN')),'conflicting or unresolved native work-country aliases')
 return true
}
export function readSearch(model,start,total){
 envelope(model);exactKeys(model.data,['positions','filterDef','count','sortBy','appliedFilters','debug','savedSearchMetadata','resultsMetaData'],'search')
 const d=model.data
 need(Number.isSafeInteger(d.count)&&d.count>0&&d.count<=1000&&(total===undefined||d.count===total),'invalid or changed native search count')
 need(Number.isSafeInteger(start)&&start>=0&&start%10===0&&start<d.count,'invalid native search offset')
 need(Array.isArray(d.positions)&&d.positions.length===Math.min(10,d.count-start),'incomplete native pagination')
 for(const row of d.positions)listing(row)
 need(isDeepStrictEqual(d.appliedFilters,{}),'unexpected native applied filters')
 return{rows:d.positions,total:d.count}
}
const walk=node=>typeof node==='string'?[]:[node,...node.children.flatMap(walk)]
const flow=(node,bullets=false)=>typeof node==='string'?decodeNativeEntities(node):(['p','li','ul','ol','br'].includes(node.tag)?'\n':'')+(bullets&&node.tag==='li'?'* ':'')+node.children.map(n=>flow(n,bullets)).join('')+(['p','li','ul','ol'].includes(node.tag)?'\n':'')
export function readRole(model,row,now){
 envelope(model);const d=model.data;exactKeys(d,roleKeys,'role')
 need(indiaCandidate(row),'role does not have own India work-country proof')
 for(const k of listingKeys.filter(k=>k!=='solrScore'))need(isDeepStrictEqual(d[k],row[k]),'role '+k+' differs from listing')
 need(d.publicUrl===roleURL(row.id)&&d.positionUrl==='/careers/job/'+row.id,'role canonical identity differs')
 need(d.locations.length===1&&d.location===d.locations[0]&&isDeepStrictEqual(d.efcustomTextLocation,d.locations)&&isDeepStrictEqual(d.efcustomTextAdditionalLocation,[]),'additional or conflicting native placement aliases')
 need(isDeepStrictEqual(d.positionUserActions,{isSaved:false,applyAction:{status:'allowed'}}),'closed or unreviewed public role action status')
 need(isDeepStrictEqual(d.positionExtraDetails,{videos:[],blogs:[],perks:[],pymww:{people:[],count:0},customContent:[]})&&isDeepStrictEqual(d.jdHighlight,[]),'unreviewed supplemental role content')
 need(!/\b(?:expression of interest|talent (?:pool|community)|future opportunities)\b/i.test(d.name),'prospective hiring record')
 for(const k of ['postedTs','creationTs'])need(Number.isSafeInteger(d[k])&&d[k]>0&&d[k]*1000<=now,'invalid or future '+k)
 need(text(d.jobDescription)&&d.jobDescription.length<=100000,'missing or oversized full criteria')
 const doc=readVisibleNativeDocument(d.jobDescription,{strict:true}),root=doc.nodes(n=>n.tag==='root')[0],nodes=walk(root),tags=new Set(['root','p','b','br','li','ul','span','strong','ol','em'])
 need(nodes.every(n=>!n.inert&&!n.nativeTagUnqualified&&tags.has(n.tag)&&Object.entries(n.attrs||{}).every(([k,v])=>n.tag==='span'&&k==='style'&&v==='color:#222222')),'unsupported or inactive whole role criteria')
 const raw=flow(root),description=raw.replace(/\s+/g,' ').trim()
 need(description.length>=200&&/Education\s*&\s*Experience|Skills\/Experience Required/i.test(description),'missing whole role requirements')
 for(const block of raw.split(/\n+/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean)){
  const match=block.match(/^(country|work(?:site|place) country|mandatory work assignment|employer|legal employer|hiring (?:company|organization))\s*:\s*(.*)$/i)
  if(match)need(/country|assignment/i.test(match[1])?/^(?:India|IN|IND)[.!]?$/.test(match[2]):/^Corteva(?: Agriscience)?[.!]?$/.test(match[2]),'criteria employer or work-country conflicts or is unresolved')
 }
 need(!/\b(?:this is not (?:a |an )?(?:current |open )?(?:vacancy|position)|no (?:current |open )?vacanc(?:y|ies))\b/i.test(description),'non-vacancy criteria')
 return{model,description,structuredDescription:flow(root,true).replace(/\s+/g,' ').trim()}
}
export const reconcile=(a,b,label)=>need(isDeepStrictEqual(a,b),'closing '+label+' model changed')
export function mapRole(row,opening,closing,canonical,declaration,at){
 const d=opening.model.data
 return{source:'corteva',companyName:'Corteva',company:'Corteva',companyCareerPage:declaration.corporate.careersURL,jobId:String(d.id),requisitionId:d.atsJobId,title:d.name,location:d.location,country:'India',city:null,state:null,
  jobDescription:opening.description,sourceDescription:d.jobDescription,sourceUrl:d.publicUrl,jobUrl:d.publicUrl,applyUrl:d.publicUrl,canonicalRoleURL:d.publicUrl,
  postingDate:new Date(d.postedTs*1000).toISOString(),publicationTimezone:'UTC',sourceDatePrecision:'second',legalEmployer:null,firstEverPublication:null,applicationVisited:false,activeApplyVerified:false,
  nativeSourceRecord:{publisher:declaration,listing:row,detail:opening.model,canonical},nativeClosingRecord:{listing:row,detail:closing.model,canonical},
  nativeCriteriaComplete:true,nativeGeographyQualified:true,nativeEmployerReconciled:true,sourceDetailComplete:true,nativeRoleClosingReconciled:true,sourceCountryScopeUnresolved:false,
  nativeHiringOrganization:canonical.jobPosting.hiringOrganization,
  nativeEmployerEvidence:{kind:'official-corporate-delegation-and-own-structured-employer',tenantDomain:'corteva.com',literalRoleEmployer:canonical.jobPosting.hiringOrganization.name,legalEmployer:null},
  nativeValidThroughCalendar:canonical.jobPosting.validThrough,nativeValidThroughTimezone:null,closingDate:null,employmentType:null,nativeStructuredEmploymentType:canonical.jobPosting.employmentType,
  sourceWorksiteCountryProof:{kind:'own-native-locations-and-standardized-country-code',locations:[...d.locations],standardizedLocations:[...d.standardizedLocations],requestCountryUsed:false,cityDictionaryUsed:false},
  nativePublicationEvidence:{openingListed:true,closingListed:true,fallback:false,publicRolePageRead:true,openingActionStatus:'allowed',closingActionStatus:'allowed',applicationOpened:false,firstEverPublication:null,verifiedAt:at},
  sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,sourceCapturedAt:at}
}
