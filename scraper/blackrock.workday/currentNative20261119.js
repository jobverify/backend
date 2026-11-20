import {decodeHTML} from 'entities'
import {readJobPosting,nodeText,geography} from '../../scraper-support/native-sources/jobPostingData.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {descendants,comparable,nativeLines} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createNativeReader,mapOriginalRoles} from './currentTransport20261119.js'
import PROFILE from './currentProfile20261119.json' with {type:'json'}
export const SOURCE='blackrock',COMPANY='BlackRock',HOMEPAGE='https://careers.blackrock.com/',INDEX='https://careers.blackrock.com/search-jobs'
const fail=message=>Object.assign(Error('BlackRock current own publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const norm=value=>decodeHTML(String(value??'')).replace(/\s+/g,' ').trim()
const all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const roleURL=url=>{try{const u=new URL(url);return u.origin==='https://careers.blackrock.com'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/job\/[^/]+\/[^/]+\/45831\/\d+$/.test(u.pathname)}catch{return false}}
const owned=(html,url)=>{
 const parsed=readJobPosting(html),document=parsed.document,root=one(document.nodes(n=>n.tag==='root'),'native document')
 need(!all(root).some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'Unreviewed native navigation')
 const canonicals=document.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical'))
 need(canonicals.length<=1&&(!roleURL(url)||canonicals.length===1)&&canonicals.every(n=>n.attrs.href===url),'Foreign, missing role or ambiguous native canonical')
 return {...parsed,root,visible:readVisibleNativeDocument(html,{strict:true})}
}
export function inspectNativePresentation(html){
 const {visible}=owned(html,readJobPosting(html).candidate?.model.url??INDEX),root=one(visible.nodes(n=>n.tag==='root'),'visible root'),parents=new Map()
 for(const node of all(root))for(const child of node.children)if(typeof child!=='string')parents.set(child,node)
 const nodes=visible.nodes(n=>n.attrs['data-selector-name']==='job-apply-link'||/^h[12]$/.test(n.tag)&&n.attrs.class?.includes('job')||n.attrs.class?.includes('__location'))
 const paths=new Set();for(let node of nodes)while(node){paths.add(node);node=parents.get(node)}
 const criteria=visible.nodes(n=>cls(n,'ats-description')),criterionPaths=new Set()
 for(let node of criteria)while(node){criterionPaths.add(node);node=parents.get(node)}
 const signatures=nodes=>[...new Set([...nodes].flatMap(n=>Object.entries(n.attrs).filter(([k])=>['class','style','id'].includes(k)).map(([k,v])=>JSON.stringify([n.tag,k,v]))))].sort().map(s=>JSON.parse(s))
 return {primary:signatures(paths),criteria:signatures(new Set([...criterionPaths,...criteria.flatMap(all)]))}
}
const approved=(rows,known)=>{const set=new Set(known.map(r=>JSON.stringify(r)));return rows.every(r=>set.has(JSON.stringify(r)))}
export function parseCurrentIndex(html){
 const {visible}=owned(html,INDEX),container=one(visible.nodes(n=>n.attrs.id==='search-results-list'),'native result cohort'),rows=[]
 for(const anchor of descendants(container,n=>n.tag==='a'&&n.attrs.href)){
  const url=new URL(anchor.attrs.href,INDEX).href;if(!roleURL(url))continue
  const heading=one(descendants(anchor,n=>/^h[1-6]$/.test(n.tag)),'native role card title')
  need(anchor.attrs['data-job-id']===new URL(url).pathname.split('/').at(-1),'Native card publisher ID disagrees')
  rows.push({sourceUrl:url,title:norm(nodeText(heading)),publisherJobId:anchor.attrs['data-job-id'],nativeCardText:nodeText(anchor)})
 }
 need(rows.length>0&&rows.length<=32&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'Missing or duplicate current native rows')
 return rows
}
const fields=new Set(['@context','@type','baseSalary','datePosted','description','identifier','title','url','directApply','hiringOrganization','jobLocation','validThrough'])
const calendar=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function parseCurrentRole(html,listing,observedAt){
 need(roleURL(listing.sourceUrl),'Unbound own role URL')
 const {candidate,errors,document,visible,root}=owned(html,listing.sourceUrl),now=new Date(observedAt)
 need(Number.isFinite(now.getTime())&&candidate&&errors.length===0,'Native role model unavailable')
 const model=candidate.model,meta=name=>one(document.nodes(n=>n.tag==='meta'&&n.attrs.name===name),'native '+name).attrs.content
 need(Object.keys(model).every(k=>fields.has(k))&&model['@type']==='JobPosting'&&['http://schema.org','https://schema.org'].includes(model['@context']),'Unreviewed native role state or model')
 need(model.hiringOrganization?.name===COMPANY&&model.hiringOrganization?.['@type']==='Organization'&&Object.keys(model.hiringOrganization).every(k=>['@type','name'].includes(k)),'Foreign native employer')
 const id=model.identifier?.value
 need(typeof id==='string'&&/^R\d+$/.test(id)&&model.identifier.name==='Job ID'&&meta('job-ats-req-id')===id,'Native requisition identity disagrees')
 need(model.url===listing.sourceUrl&&norm(model.title)===listing.title&&norm(meta('job-tbcn-job-title'))===listing.title,'Native title or URL disagrees')
 need(one(document.nodes(n=>n.tag==='title'),'role title').raw===listing.title+' at BlackRock'||norm(one(document.nodes(n=>n.tag==='title'),'role title').raw)===listing.title+' at BlackRock','Native page title disagrees')
 const headings=visible.nodes(n=>/^h[12]$/.test(n.tag)&&norm(nodeText(n))===listing.title)
 one(headings,'active own title')
 const sections=visible.nodes(n=>n.attrs['data-selector-name']==='jobdetails')
 need(sections.length>=1&&sections.every(n=>n.attrs['data-org-id']==='45831'&&n.attrs['data-job-id']===listing.publisherJobId),'Native role owner identity disagrees')
 const apps=visible.nodes(n=>n.tag==='a'&&n.attrs['data-selector-name']==='job-apply-link')
 need(apps.length>=1&&apps.length<=2,'Active own application missing')
 const applications=apps.map(n=>{
  const a=n.attrs,u=new URL(a.href,listing.sourceUrl)
  need(u.origin==='https://blackrock.wd1.myworkdayjobs.com'&&!u.search&&!u.hash&&!u.username&&!u.password
   &&new RegExp('^/BlackRock_Professional/job/[^/]+/[^/]+_'+id+'(?:-\\d+)?/apply$').test(u.pathname)
   &&a['data-apply-url']===u.href&&a['data-job-id']===listing.publisherJobId&&a['data-job-organization-id']==='45831'
   &&a['data-delay-url']==='False'&&a['data-override-candidate-card']==='False'&&!Object.hasOwn(a,'disabled')&&!['true','1'].includes(a['aria-disabled'])
   &&!Object.keys(a).some(k=>/^on[a-z]/.test(k))&&/^(?:Apply|Apply Now)$/.test(nodeText(n)),'Inactive, foreign or unbound application')
  return {url:u.href,attrs:{...a},text:nodeText(n)}
 })
 need(new Set(applications.map(r=>r.url)).size===1&&meta('search-job-apply-url')===applications[0].url,'Native application carriers disagree')
 const geo=geography(model);need(!geo.unresolved&&geo.country&&geo.countries.length===1,'Mixed or unresolved native countries')
 need(!all(root).some(n=>/^(?:addressCountry|datePosted|validThrough|hiringOrganization|jobLocation|identifier|jobStatus)$/i.test(n.attrs.itemprop??'')||/schema\.org\/JobPosting/i.test(n.attrs.itemtype??'')),'Unreviewed additional role authority')
 need(calendar(model.datePosted)&&model.datePosted<=now.toISOString().slice(0,10),'Invalid or future native posting date')
 if(model.validThrough!=null&&model.validThrough!=='')need(calendar(model.validThrough)&&model.validThrough>=now.toISOString().slice(0,10),'Native application deadline expired or malformed')
 const facetDeclarations=one(document.nodes(n=>n.tag==='html'),'native HTML').attrs['data-facet-id']??''
 const customDates=facetDeclarations.split(/\s+/).filter(value=>/^custom_fields\.Posting_(?:Start|End)_Date-/.test(value)).map(original=>{
  const match=/^custom_fields\.(Posting_(?:Start|End)_Date)-(\d{2})-(\d{2})-(\d{4})$/.exec(original)
  need(match,'Malformed native custom posting-date facet')
  const canonicalCalendar=match[4]+'-'+match[3]+'-'+match[2]
  need(calendar(canonicalCalendar),'Invalid native custom posting-date facet calendar')
  if(match[1]==='Posting_End_Date')need(canonicalCalendar>=now.toISOString().slice(0,10),'Native declared custom end date is past')
  return {original,field:match[1],raw:match[2]+'-'+match[3]+'-'+match[4],canonicalCalendar,semanticsUnresolved:true}
 })
 need(!sections.some(n=>/\b(?:this|the)\s+(?:job|role|vacancy|position)\s+(?:is\s+(?:closed|no longer available)|has\s+been\s+(?:closed|filled))\b/i.test(nodeText(n))),'Native role is closed')
 const presentation=inspectNativePresentation(html)
 need(approved(presentation.primary,PROFILE.approvedPrimaryPresentation),'Unreviewed primary role presentation')
 const criteria=readOriginalNativeCriteria(typeof model.description==='string'?model.description:'',fail),ats=visible.nodes(n=>cls(n,'ats-description'))
 const visibleCriteria=ats.length===1?nativeLines(ats[0]).join('\n'):''
 const complete=approved(presentation.criteria,PROFILE.approvedCriteriaPresentation)&&criteria.sourceDetailComplete&&comparable(decodeHTML(visibleCriteria))===comparable(decodeHTML(criteria.sourceDescription))
 return {jobId:SOURCE+'-'+id,requisitionId:id,title:listing.title,sourceUrl:listing.sourceUrl,applyUrl:applications[0].url,
  nativeApplyLinks:applications,nativeEmployerDisplayName:COMPANY,sourceLegalEmployer:null,country:geo.country,city:geo.city,state:geo.state,
  location:geo.location??geo.locations.join('; '),sourceNativeJobLocations:geo.originalJobLocations,sourceCountryScopeUnresolved:false,
  postingDate:model.datePosted,closingDate:model.validThrough??null,sourceNativePublicationDates:[{origin:'JobPosting.datePosted',raw:model.datePosted}],
  sourceNativeFacetDeclarations:facetDeclarations||null,sourceNativeCustomDateFacets:customDates,
  sourceNativePublicationDateConflict:customDates.some(row=>row.field==='Posting_Start_Date'&&row.canonicalCalendar!==model.datePosted),
  sourceNativeDateAmbiguity:customDates.length?'native-custom-start/end-facet-semantics-unresolved;future-start-does-not-replace-current-own-publication;past-declared-end-held':null,
  sourcePublicationDatePolicy:'original-JobPosting.datePosted;day-precision;native-timezone-and-first-ever-publication-unproven;all-custom-facets-preserved',
  jobDescription:complete?criteria.jobDescription:null,sourceDescription:complete?criteria.sourceDescription:null,sourceDescriptionHTML:model.description,
  sourceDetailComplete:complete,sourceDetailFailureKind:complete?null:criteria.sourceDetailFailureKind??'native-criteria-presentation-unavailable-or-disagreeing',
  sourceNativeJobPosting:model,sourceNativeCard:listing,sourceNativeCriticalPresentation:presentation,sourceNativeVisibleCriteriaText:visibleCriteria,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated native observations unsupported')
 const reader=createNativeReader(SOURCE,[HOMEPAGE,INDEX],options)
 try{
  const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString()
  const home=async()=>{const page=await reader.read(HOMEPAGE),{visible}=owned(page.body,HOMEPAGE);need(visible.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>new URL(n.attrs.href,HOMEPAGE).href===INDEX),'Own current search handoff absent')}
  await home();const opening=await reader.read(INDEX),listings=parseCurrentIndex(opening.body)
  for(const row of listings)reader.allow(row.sourceUrl)
  const readRole=async row=>{
   const page=await reader.read(row.sourceUrl)
   try{return parseCurrentRole(page.body,row,observedAt)}catch(error){
    reader.check();if(error.softFailure!==true)throw error
    const original=readJobPosting(page.body)
    return {sourceAdmissionHeld:true,sourceUrl:row.sourceUrl,title:row.title,reason:error.message,nativeOriginalJobPosting:original.candidate?.model??null,
     nativeOriginalFacetDeclarations:original.document.nodes(n=>n.tag==='html')[0]?.attrs['data-facet-id']??null}
   }
  }
  const facts=await mapOriginalRoles(listings,readRole)
  const closingFacts=await mapOriginalRoles(listings,readRole)
  need(JSON.stringify(facts)===JSON.stringify(closingFacts),'Closing native role criteria, identity, country, application or dates changed')
  need(JSON.stringify(parseCurrentIndex((await reader.read(INDEX)).body))===JSON.stringify(listings),'Closing native result cohort changed');await home()
  const jobs=facts.filter(r=>r.country==='India').map(r=>({...r,source:SOURCE,company:COMPANY,link:r.applyUrl,scrapedAt:observedAt,
   sourceNativeClosingJobPosting:closingFacts.find(c=>c.requisitionId===r.requisitionId).sourceNativeJobPosting,sourceClosingReconciled:true,companyCareerPage:HOMEPAGE,companyDomain:'blackrock.com',atsPlatform:'official-company-careers'}))
  const audit={source:SOURCE,recoveryKind:'current-native-publication-subset',recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,
   observedNativeRoleRecords:facts,heldNativeRows:facts.filter(r=>r.sourceAdmissionHeld),returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,explicitNonIndiaCount:facts.filter(r=>!r.sourceAdmissionHeld&&r.country!=='India').length,
   nativeOpeningClosingRecordsMatch:true,fullCriteriaRecovered:jobs.every(r=>r.sourceDetailComplete),fullCriteriaIndiaJobs:jobs.filter(r=>r.sourceDetailComplete).length,
   missingCriteriaJobs:jobs.filter(r=>!r.sourceDetailComplete).length,backendApplicationActivationVerified:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
   sourcePaginationHold:'current-native-first-result-page-only;additional-pages-and-early-career-inventory-unproven',lifecycleCleanupAllowed:false,...reader.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  reader.check();return jobs
 }finally{reader.close()}
}
