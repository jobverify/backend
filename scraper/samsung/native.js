import {createTransport} from './transport.js'
import {document} from './html.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {workdayListingIdentityDiagnostic} from '../../scraper-support/myworkday/listingIdentityDiagnostics.js'

export const CAREERS='https://www.samsung.com/in/about-us/careers/'
export const BOARD='https://sec.wd3.myworkdayjobs.com/Samsung_Careers'
export const API='https://sec.wd3.myworkdayjobs.com/wday/cxs/sec/Samsung_Careers'
export const INDIA='c4f78be1a8f14da0ab49ce1162348a5e'
export const RESEARCH_FACETS={Location_Country:[INDIA],hiringCompany:['189767dd6c9201554f3e5312a7290a85'],locations:['189767dd6c9201b802603c83a5292c78']}
const check=(condition,message)=>{if(!condition)throw Error('Samsung native incomplete: '+message)}
const envelope=value=>{
 check(value&&typeof value==='object'&&!Array.isArray(value),'invalid response envelope')
 for(const [key,v] of Object.entries(value)){
  if(/^(?:error|errors|errorCode|errorMessage|fault|exception)$/i.test(key))check(false,'upstream error envelope')
  if(/^success$/i.test(key))check(v===true,'unsuccessful response')
  if(/^(?:status|statusCode)$/i.test(key))check([200,'200','ok','OK','success'].includes(v),'failure status')
 }
 return value
}
const requisitionOnly=row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===1&&Object.hasOwn(row,'bulletFields')&&Array.isArray(row.bulletFields)&&row.bulletFields.length===1&&typeof row.bulletFields[0]==='string'&&/^R\d+$/.test(row.bulletFields[0])
const rowID=(row,rowIndex=null)=>{
 const rejectIdentity=(message,reason)=>{
  const diagnostic=workdayListingIdentityDiagnostic({reason,board:BOARD,rowIndex,externalPath:row?.externalPath})
  throw Object.assign(Error('Samsung native incomplete: '+message+' '+JSON.stringify(diagnostic)),{listingIdentity:diagnostic})
 }
 // The native API can retain only the requisition identity. This exact shape
 // may be counted and held, but cannot supply a title, URL or work country.
 if(requisitionOnly(row))return row.bulletFields[0]
 if(!row||typeof row.title!=='string'||!row.title.trim())rejectIdentity('invalid listing identity','missing-title')
 if(typeof row.externalPath!=='string'||!/^\/job\/[^?#\\]+_R\d+(?:-\d+)?$/.test(row.externalPath))rejectIdentity('invalid listing identity','invalid-external-path')
 if(!Array.isArray(row.bulletFields)||row.bulletFields.length!==1||!/^R\d+$/.test(row.bulletFields[0])||row.externalPath.match(/_(R\d+)(?:-\d+)?$/)?.[1]!==row.bulletFields[0])rejectIdentity('listing requisition mismatch','listing-requisition-mismatch')
 return row.bulletFields[0]
}
const body=(facets,offset)=>({appliedFacets:facets,limit:20,offset,searchText:''})
const facet=(page,name)=>page.facets?.find(f=>f.facetParameter===name)?.values
const requestPage=async(transport,facets,offset,expectedTotal)=>{
 const page=envelope(await transport.read(API+'/jobs',body(facets,offset)))
 check(Number.isSafeInteger(page.total)&&page.total>=0&&Array.isArray(page.jobPostings)&&Array.isArray(page.facets),'invalid listing shape/count')
 // The captured continuation response uses total:0 with nonempty rows.
 // Only page zero establishes the count; continuation rows are bounded by it.
 const total=offset>0?expectedTotal:page.total
 check(offset===0||page.total===0||page.total===expectedTotal,'total changed during pagination')
 check(page.jobPostings.length===Math.min(20,Math.max(0,total-offset)),'short/oversized native page')
 page.jobPostings.forEach((row,index)=>rowID(row,offset+index))
 return page
}
async function enumerate(transport,facets,first){
 const page=first??await requestPage(transport,facets,0),rows=[...page.jobPostings],seen=new Set(rows.map(rowID)),pages=[{offset:0,page}]
 check(seen.size===rows.length,'duplicate first page')
 check(page.total<=10000,'inventory bound')
 for(let offset=rows.length;offset<page.total;){
  const next=await requestPage(transport,facets,offset,page.total)
  pages.push({offset,page:next})
  for(const row of next.jobPostings){const id=rowID(row);check(!seen.has(id),'duplicate native page');seen.add(id);rows.push(row)}
  offset=rows.length
 }
 return {page,rows,pages}
}
function description(html,title){
 if(typeof html!=='string')return null
 const doc=document(html),text=doc.text(doc.root)
 const prose=node=>node.inactive||/^(?:script|h[1-6]|strong|b|title)$/.test(node.tag)?'':node.children.map(c=>typeof c==='string'?c:prose(c)).join(' ')
 const meaningful=prose(doc.root).replace(/\s+/g,' ').trim()
 if(meaningful.length<80||text===title||/^(?:job description|position summary|skills and qualifications|role and responsibilities)[\s:.-]*$/i.test(meaningful))return null
 return {html,text}
}
function locationCountry(country){
 if(typeof country==='string')return nativeCountryName(country)
 check(country&&typeof country==='object','missing typed location country')
 const values=[country.descriptor,country.alpha2Code].filter(v=>v!=null).map(nativeCountryName)
 check(values.length>0&&values.every(Boolean)&&new Set(values).size===1,'conflicting country fields')
 if(country.id===INDIA)check(values[0]==='India','country ID disagreement')
 if(values[0]==='India'&&country.id!=null)check(country.id===INDIA,'India country ID disagreement')
 return values[0]
}
function parseDetail(payload,row,now){
 envelope(payload)
 const info=payload.jobPostingInfo,id=rowID(row),sourceUrl=BOARD+row.externalPath
 check(info&&info.jobReqId===id&&info.title===row.title&&info.jobPostingSiteId==='Samsung_Careers'&&info.externalUrl===sourceUrl&&info.jobPostingId===row.externalPath.split('/').at(-1),'detail identity mismatch')
 const employer=payload.hiringOrganization?.name
 check(typeof employer==='string'&&/^Samsung\b/i.test(employer),'native employer unavailable/mismatch')
 const primary=info.jobRequisitionLocation
 // Some global postings omit both posting country and display location but
 // retain vacancy-specific typed requisition evidence. Never use employer HQ.
 const absentLocation=value=>value==null||value===''
 const requisitionFallback=info.country==null&&absentLocation(info.location)&&absentLocation(row.locationsText)
 const country=locationCountry(requisitionFallback?primary?.country:info.country)
 check(primary&&locationCountry(primary.country)===country,'primary country disagreement')
 const primaryLabel=requisitionFallback?primary.descriptor:info.location
 check(typeof primaryLabel==='string'&&primaryLabel.trim()&&(requisitionFallback||primaryLabel===primary.descriptor&&primaryLabel===row.locationsText),'primary location mismatch')
 const foreignState=label=>/\b(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Ontario|British Columbia|New South Wales)\b|,\s*(?:TX|CA|NY|WA|MA|FL|NJ|VA|BC|ON|NSW)\s*(?:,|$)/i.test(label)
 const validIndia=label=>typeof label==='string'&&!foreignState(label)&&isJobInPublicLocationScope({country:'India',location:label})
 if(info.additionalLocations!=null)check(Array.isArray(info.additionalLocations),'invalid secondary locations')
 const secondary=(info.additionalLocations??[]).map(location=>{
  // Native typed secondary locations must carry independent country evidence;
  // a bare city never certifies India on its own.
  if(typeof location==='string')return {label:location,country:null}
  check(location&&typeof location.descriptor==='string','invalid secondary location')
  return {label:location.descriptor,country:locationCountry(location.country)}
 })
 for(const location of [{label:primaryLabel,country},...secondary]){
  const explicit=nativeLocationCountryName(location.label)
  check(!explicit||!location.country||explicit===location.country,'typed/label location country conflict')
  const explicitParts=location.label.split(/[,/()]/).map(part=>nativeCountryName(part.trim())).filter(Boolean)
  check(!location.country||explicitParts.every(value=>value===location.country),'embedded location country conflict')
 }
 const indiaLocations=[{label:primaryLabel,country},...secondary].filter(l=>l.country==='India'&&validIndia(l.label)).map(l=>l.label)
 const geography=indiaLocations.length>0&&secondary.every(l=>l.country!==null&&(l.country!=='India'||validIndia(l.label)))&&(country!=='India'||validIndia(primaryLabel))
 const publication=info.startDate==null?{raw:null,iso:null,precision:null}:nativeDate(info.startDate)
 check(!publication.iso||+new Date(publication.iso)<=+now,'future publication')
 const closing=nativeDate(info.endDate)
 check(!closing.iso||!publication.iso||closing.iso>=publication.iso,'closing precedes publication')
 const deadlinePassed=closing.iso&&(closing.exact?+new Date(closing.iso)<=+now:closing.iso.slice(0,10)<now.toISOString().slice(0,10))
 const closed=info.canApply!==true||info.posted!==true||deadlinePassed
 const content=description(info.jobDescription,info.title)
 const nativeText=typeof info.jobDescription==='string'?document(info.jobDescription).text(document(info.jobDescription).root):''
 const legalLabel=nativeText.match(/a division of (Samsung R&D India - Bangalore Pvt\. Ltd)/i)?.[1]??null
 return {id,title:row.title,sourceUrl,employer,legalEmployer:legalLabel,businessUnit:/Samsung Semiconductor India Research \(SSIR\)/.test(nativeText)?'Samsung Semiconductor India Research (SSIR)':null,
  info,payload,publication,closing,content,country,countryEvidenceField:requisitionFallback?'jobPostingInfo.jobRequisitionLocation.country':'jobPostingInfo.country',secondary,indiaLocations,geography,closed}
}

export async function runNative(options={}) {
 const transport=createTransport(options)
 try {
  const now=new Date(options.now?options.now():Date.now())
  check(Number.isFinite(+now),'invalid reference time')
  const corporate=document(await transport.read(CAREERS))
  check(corporate.text(corporate.root).includes('Samsung Electronics Careers')&&corporate.nodes(n=>n.tag==='a'&&[BOARD,'//sec.wd3.myworkdayjobs.com/Samsung_Careers'].includes(n.attrs.href)&&/search jobs/i.test(corporate.text(n))).length===1,'official careers handoff missing')
  const researchOfficial=document(await transport.read('https://research.samsung.com/careers'))
  const researchLinks=researchOfficial.nodes(n=>{
   if(n.tag!=='a'||!n.attrs.href)return false
   try{const url=new URL(n.attrs.href);return url.origin===new URL(BOARD).origin&&url.pathname==='/en-US/Samsung_Careers'&&url.searchParams.size===3&&Object.entries(RESEARCH_FACETS).every(([key,values])=>url.searchParams.getAll(key).length===1&&url.searchParams.get(key)===values[0])}catch{return false}
  })
  check(researchLinks.length===1,'Research delegation changed; overlap cannot be assumed')
  const global=await requestPage(transport,{},0),indiaFacet=facet(global,'Location_Country')?.filter(f=>f.id===INDIA&&f.descriptor==='India')
  check(indiaFacet?.length===1&&Number.isSafeInteger(indiaFacet[0].count),'India native facet unavailable')
  const globalInventory=await enumerate(transport,{},global)
  const india=await enumerate(transport,{Location_Country:[INDIA]})
  check(india.page.total===indiaFacet[0].count,'global/India count conflict')
  const globalByID=new Map(globalInventory.rows.map(row=>[rowID(row),row]))
  check(india.rows.every(row=>{const globalRow=globalByID.get(rowID(row));return globalRow&&(requisitionOnly(row)||requisitionOnly(globalRow)||globalRow.externalPath===row.externalPath&&globalRow.title===row.title&&globalRow.locationsText===row.locationsText)}),'global/India identity conflict')
  const research=await enumerate(transport,RESEARCH_FACETS),researchIDs=new Set(research.rows.map(rowID)),indiaIDs=new Set(india.rows.map(rowID))
  check(research.rows.every(r=>indiaIDs.has(rowID(r))&&india.rows.some(i=>rowID(i)===rowID(r)&&(requisitionOnly(r)||requisitionOnly(i)||i.externalPath===r.externalPath&&i.title===r.title))),'Research overlap inconsistent')
  const affectedPages=[],heldRequisitionOnlyRows=[]
  for(const [cohort,facets,inventory]of [['global',{},globalInventory],['india',{Location_Country:[INDIA]},india],['research',RESEARCH_FACETS,research]])for(const entry of inventory.pages){
   const held=[]
   entry.page.jobPostings.forEach((record,index)=>{if(requisitionOnly(record)){const hold={id:rowID(record),reason:'native-requisition-only-row',cohort,facets:structuredClone(facets),pageOffset:entry.offset,pageRowIndex:index,rowIndex:entry.offset+index,record:structuredClone(record),openingPage:structuredClone(entry.page),closingPage:null,closingReconciled:false,country:null,title:null,detailURL:null,description:null,postingDate:null,closingDate:null};held.push(hold);heldRequisitionOnlyRows.push(hold)}})
   if(held.length)affectedPages.push({cohort,facets,offset:entry.offset,opening:entry.page,expectedTotal:inventory.page.total,held})
  }
  const heldIDs=new Set(heldRequisitionOnlyRows.map(row=>row.id))
  const unlocatedGlobalRows=globalInventory.rows.filter(row=>!heldIDs.has(rowID(row))&&(row.locationsText==null||row.locationsText==='')&&!indiaIDs.has(rowID(row)))
  const evidence={source:'samsung',globalReportedTotal:global.total,globalEnumerated:true,globalRows:globalInventory.rows,unlocatedGlobalRows,indiaReportedTotal:india.page.total,indiaRows:india.rows,researchOverlapIDs:[...researchIDs],heldRequisitionOnlyRows,heldRequisitionOnlyIDs:[...heldIDs],details:[],failures:[],cleanupAllowed:false,wholeCompanyScope:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,sourceScope:'official Samsung_Careers India facet and unlocated global requisitions with typed India country, minus registered Research Phoenix subset',retainedResponses:transport.retainedResponses}
  const jobs=[]
  for(const row of [...india.rows,...unlocatedGlobalRows].filter(row=>!heldIDs.has(rowID(row)))){
   transport.signal.throwIfAborted()
   const payload=await transport.read(API+row.externalPath)
   let fact
   try{fact=parseDetail(payload,row,now)}catch(error){evidence.failures.push({id:rowID(row),message:error.message,nativeDetail:payload});evidence.details.push({id:rowID(row),incomplete:true,nativeDetail:payload});continue}
   evidence.details.push(fact)
   if(researchIDs.has(fact.id)||!fact.geography||fact.closed)continue
   jobs.push({id:fact.id,jobId:fact.id,requisitionId:fact.id,source:'samsung',company:'Samsung',title:fact.title,sourceUrl:fact.sourceUrl,applyUrl:fact.sourceUrl,link:fact.sourceUrl,
    location:fact.indiaLocations.join(' / '),locations:fact.indiaLocations,country:'India',nativeEmployer:fact.employer,legalEmployer:fact.legalEmployer,nativeBusinessUnit:fact.businessUnit,
    postingDate:fact.publication.raw,postedAt:fact.publication.raw,nativePublicationDate:fact.publication.raw,nativePublicationPrecision:fact.publication.precision,firstEverPublication:null,
    sourceNativePublicationEvidence:{field:'jobPostingInfo.startDate',meaning:'native posting start; earliest known, not first-ever publication',raw:fact.publication.raw},closingDate:fact.closing.raw,sourceClosingDateIsExact:fact.closing.exact,
    sourceDescription:fact.content?.html??null,jobDescription:fact.content?.html??null,sourceDetailComplete:Boolean(fact.content),sourceDetailStatus:fact.content?'complete':'partial',
    sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,publicEligibility:null,nativeFacts:fact})
  }
  const closing=await requestPage(transport,{Location_Country:[INDIA]},0)
  check(closing.total===india.page.total&&JSON.stringify(closing.jobPostings)===JSON.stringify(india.page.jobPostings),'inventory changed during details')
  const globalClosing=await requestPage(transport,{},0)
  check(globalClosing.total===global.total&&JSON.stringify(globalClosing.jobPostings)===JSON.stringify(global.jobPostings),'global inventory changed during details')
  // Normal page-zero guards remain unchanged. Only pages carrying exact
  // requisition-only holds require this additional whole-page reconciliation.
  for(const page of affectedPages){
   try{
    const final=page.offset===0&&page.cohort==='global'?globalClosing:page.offset===0&&page.cohort==='india'?closing:await requestPage(transport,page.facets,page.offset,page.expectedTotal)
    for(const held of page.held)held.closingPage=structuredClone(final)
    check(JSON.stringify(final)===JSON.stringify(page.opening),'requisition-only native page changed during details')
    for(const held of page.held)held.closingReconciled=true
   }catch(error){if(error&&typeof error==='object'&&Object.isExtensible(error))Object.assign(error,{nativeEvidence:evidence});throw error}
  }
  if(!jobs.length&&evidence.failures.length)throw Object.assign(Error('Samsung all native candidates unresolved'),{nativeEvidence:evidence})
  const compact={globalReportedTotal:evidence.globalReportedTotal,globalEnumerated:true,unlocatedGlobalCount:unlocatedGlobalRows.length,indiaReportedTotal:evidence.indiaReportedTotal,researchOverlapIDs:evidence.researchOverlapIDs,heldRequisitionOnlyIDs:[...heldIDs],detailCount:evidence.details.length,failures:evidence.failures,cleanupAllowed:false,wholeCompanyScope:false}
  jobs.forEach((job,index)=>job.nativeCollectionEvidence=index===0?evidence:compact)
  Object.defineProperty(jobs,Symbol.for('jobverify.samsung-native-evidence'),{value:evidence})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:transport.retainedResponses.length,reportedTotal:global.total,indiaFacetCount:india.page.total,verifiedAt:now.toISOString(),reason:'Global listing and India facet fully paginated; unlocated global requisitions inspected using vacancy-specific typed country; exact registered Research Phoenix scope excluded; unresolved work locations and whole-company scope remain unproven; cleanup forbidden'})
 } finally {transport.close()}
}
