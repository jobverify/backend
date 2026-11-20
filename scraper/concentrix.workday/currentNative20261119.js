import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nodeText,countryName,readJobPosting,geography} from '../../scraper-support/native-sources/jobPostingData.js'
import {nativeLines,comparable} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createNativeReader,mapOriginalRoles} from './currentTransport20261119.js'
import PROFILE from './currentProfile20261119.json' with {type:'json'}
export const SOURCE='concentrix',COMPANY='Concentrix',HOMEPAGE='https://jobs.concentrix.com/',INDEX='https://jobs.concentrix.com/job-search/?country=India'
const fail=message=>Object.assign(Error('Concentrix current own publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const norm=value=>decodeHTML(String(value??'')).replace(/\s+/g,' ').trim()
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const all=node=>[node,...node.children.filter(c=>typeof c!=='string').flatMap(all)]
const sha=value=>createHash('sha256').update(value).digest('hex')
const roleURL=id=>'https://jobs.concentrix.com/job/?id='+encodeURIComponent(id)
function documentFor(html){
 const doc=readNativeDocument(html),root=one(doc.nodes(n=>n.tag==='root'),'native document'),raw=all(root)
 need(!raw.some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'Unreviewed native navigation')
 return {doc,raw,visible:readVisibleNativeDocument(html,{strict:true})}
}
function clientDeclaration(html){
 const {doc}=documentFor(html),script=one(doc.nodes(n=>n.tag==='script'&&n.attrs.src?.includes('/jdq-elementor-widgets/assets/js/jdq-widget.js')),'current own renderer')
 const url=new URL(script.attrs.src)
 need(url.origin==='https://jobs.concentrix.com'&&/^\/wp-content\/(?:cache\/min\/1\/wp-content\/)?plugins\/jdq-elementor-widgets\/assets\/js\/jdq-widget\.js$/.test(url.pathname)&&/^\?ver=[a-zA-Z0-9]+$/.test(url.search)&&!url.hash,'Foreign or unreviewed renderer URL')
 return url.href
}
export function parseCurrentIndex(html){
 const {doc,raw,visible}=documentFor(html),model=one(raw.filter(n=>n.tag==='script'&&n.attrs.id==='jobsData'&&n.attrs.type==='application/json'),'original renderer JSON')
 need(!raw.some(n=>n.tag==='template'&&all(n).includes(model)),'Native data is delegated to inert template')
 const widget=one(visible.nodes(n=>cls(n,'jdq-widget-container')),'active current job renderer')
 need(widget.attrs['data-query-type']==='get_search','Native country renderer query changed')
 const grid=one(visible.nodes(n=>cls(n,'jdq-jobs-container')),'active current result owner')
 need(grid.attrs['data-results-per-page']==='10'&&grid.attrs['data-job-detail-url']==='','Unreviewed native result routing')
 const parsed=readLiteralModel(model.raw),data=parsed.value
 need(parsed.validJSON&&parsed.rawControlCharacters.length===0&&data.ok===true&&Array.isArray(data.data)&&data.data.length>0&&data.data.length<=120,'Native index data or bounded country cohort changed')
 const excluded=(grid.attrs['data-exclude-keyword']??'').trim().toLowerCase(),rows=[]
 for(const record of data.data){
  need(record&&typeof record==='object'&&!Array.isArray(record)&&typeof record.ats_external_id==='string'&&/^R\d+$/.test(record.ats_external_id),'Malformed native requisition row')
  if(excluded&&(record.long_description??'').toLowerCase().includes(excluded))continue
  rows.push({sourceUrl:roleURL(record.ats_external_id),title:norm(record.job_title),nativeRecord:record})
 }
 need(new Set(rows.map(r=>r.nativeRecord.ats_external_id)).size===rows.length,'Duplicate native requisition identity')
 clientDeclaration(html);return rows
}
function date(raw,label){
 need(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)&&Number.isFinite(Date.parse(raw))
  &&new Date(raw.slice(0,10)).toISOString().slice(0,10)===raw.slice(0,10),'Malformed native '+label)
 return {raw,ms:Date.parse(raw),lastMs:Date.parse(raw)+(raw.length===10?86399999:0)}
}
function qualifyRecord(listing,observedAt){
 const r=listing.nativeRecord,w=r.workday_job_requisition_data,id=r.ats_external_id,now=Date.parse(observedAt)
 need(Number.isFinite(now)&&listing.sourceUrl===roleURL(id)&&listing.title===norm(r.job_title)&&listing.title,'Native listing identity changed')
 need(r.campaign_type==='job_application'&&r.allow_applications==='1'&&r.publish_on_job_listing==='1'&&r.is_template==='0'
  &&r.locale==='en'&&r.source==='Talkpush'&&['cnxglobalnonadvsory','concentrixglobaladvisor'].includes(r.source_domain),'Native role is unpublished, unavailable or another campaign')
 need(w&&w.status?.id==='OPEN'&&w.status?.descriptor==='Open'&&w.job_requisition?.id===id
  &&(w.workday_job_type==null||w.workday_job_type==='External'||/^RECRUITING_INSTRUCTION-\d+-\d+$/.test(w.workday_job_type)),
 'Native own requisition is not current Open or carries an internal publication contradiction')
 need(r.country==='India'&&norm(r.city)&&!/[;|/\r\n]/.test(r.city)&&w.location?.city===r.city&&w.location?.state===r.state
  &&w.location.country?.iso2==='IN'&&w.location.country?.iso3==='IND'&&w.location.country?.descriptor==='India'
  &&w.location.primary_location?.descriptor===r.address,'Native country, city or own worksite carriers disagree')
 const company=w.company,legal=Array.isArray(company)&&company.length===0?null:company?.descriptor
 need(legal===null||typeof legal==='string'&&/^Concentrix\b/.test(legal),'Foreign native legal employer')
 for(const key of ['countryCode','country_code','addressCountry'])if(r[key]!=null&&r[key]!=='')need(countryName(r[key])==='India','Additional native country contradicts India')
 for(const key of ['status','jobStatus','publication_status'])if(r[key]!=null&&r[key]!=='')need(/^(?:open|active|published)$/i.test(r[key]),'Additional native publication is not current')
 for(const key of ['isClosed','closed','expired','is_expired','disabled','archived'])if(r[key]!=null)need(r[key]===false||r[key]==='0'||r[key]===0,'Additional native application unavailable')
 for(const key of ['isActive','isPublished','canApply'])if(r[key]!=null)need(r[key]===true||r[key]==='1'||r[key]===1,'Additional native application disabled')
 const expiries=[],publications=[]
 for(const key of ['validThrough','application_deadline','applicationDeadline','closingDate','expiryDate'])if(r[key]!=null&&r[key]!==''){const value=date(r[key],'deadline');need(value.lastMs>=now,'Native deadline expired');expiries.push({field:key,...value})}
 for(const key of ['datePosted','postingDate','published_at'])if(r[key]!=null&&r[key]!==''){const value=date(r[key],'publication');need(value.ms<=now,'Native publication is future');publications.push({field:key,...value})}
 const created=date(r.created_at,'source record creation'),updated=date(r.updated_at,'source record update')
 need(created.ms<=now&&updated.ms<=now,'Native source record is future')
 let app;try{app=new URL(r.apply_url)}catch{throw fail('Native own application absent')}
 need(app.origin==='https://cnx.wd1.myworkdayjobs.com'&&!app.search&&!app.hash&&!app.username&&!app.password
  &&new RegExp('^/external_global/job/[^/]+/[^/]+_'+id+'(?:-\\d+)?/apply$').test(app.pathname),'Foreign or wrong-requisition own application')
 need(Array.isArray(w.job_postings)&&w.job_postings.length>0&&w.job_postings.every(p=>p.job_requisition_id===id&&p.external_apply_url===app.href&&p.external_job_path===app.href.replace(/\/apply$/,'')),'Native external posting and application identities disagree')
 return {jobId:SOURCE+'-'+id,requisitionId:id,title:listing.title,sourceUrl:listing.sourceUrl,applyUrl:app.href,
  nativeEmployerDisplayName:COMPANY,sourceLegalEmployer:legal,country:'India',city:r.city,state:r.state,location:[r.city,r.state,'India'].filter(Boolean).join(', '),
  sourceCountryScopeUnresolved:false,sourceNativeWorkplace:w.location,sourceNativeRecord:r,sourceNativeEvergreen:w.is_evergreen??null,
  sourceNativeRequisitionType:w.requisition_type??null,sourceNativeRecruitingInstruction:w.workday_job_type??null,sourceNativeHeadCount:r.head_count??null,
  postingDate:publications.sort((a,b)=>a.ms-b.ms)[0]?.raw??null,closingDate:expiries.sort((a,b)=>a.lastMs-b.lastMs)[0]?.raw??null,
  sourceNativePublicationDates:publications,sourceNativeExpiryDates:expiries,sourceNativeRecordCreatedAt:r.created_at,sourceNativeRecordUpdatedAt:r.updated_at,
  sourcePublicationDatePolicy:'source-campaign-created-updated-times-retained;not-promoted-to-first-publication',
  employmentType:r.job_type??null,department:r.job_category??null,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false}
}
export function inspectNativePresentation(html){
 const {visible}=documentFor(html),root=one(visible.nodes(n=>n.tag==='root'),'visible root'),parents=new Map()
 for(const node of all(root))for(const c of node.children)if(typeof c!=='string')parents.set(c,node)
 const primary=visible.nodes(n=>cls(n,'jdq-job-title')||cls(n,'jdq-meta')||n.tag==='a'&&n.attrs['data-jdq-apply-url']),body=visible.nodes(n=>cls(n,'jdq-body'))
 const paths=nodes=>{const result=new Set();for(let node of nodes)while(node){result.add(node);node=parents.get(node)}return result}
 const signatures=nodes=>[...new Set([...nodes].flatMap(n=>Object.entries(n.attrs).filter(([k])=>['class','style','id'].includes(k)).map(([k,v])=>JSON.stringify([n.tag,k,v]))))].sort().map(s=>JSON.parse(s))
 return {primary:signatures(paths(primary)),criteria:signatures(new Set([...paths(body),...body.flatMap(all)]))}
}
const approved=(rows,known)=>{const set=new Set(known.map(r=>JSON.stringify(r)));return rows.every(r=>set.has(JSON.stringify(r)))}
export function parseCurrentRole(html,listing,observedAt){
 const base=qualifyRecord(listing,observedAt),{doc,raw,visible}=documentFor(html)
 const additionalSchema=readJobPosting(html)
 need(additionalSchema.errors.length===0&&additionalSchema.candidates.length===1,'Missing or ambiguous native JobPosting authority')
 const model=additionalSchema.candidate.model,fields=new Set(['@context','@type','title','description','identifier','datePosted','industry','hiringOrganization','jobLocation','employmentType','validThrough'])
 need(Object.keys(model).every(key=>fields.has(key))&&model['@context']==='https://schema.org/'&&model['@type']==='JobPosting'
  &&model.title===listing.title&&model.identifier?.name===COMPANY&&model.identifier?.value===base.requisitionId
  &&model.hiringOrganization?.name===COMPANY&&model.hiringOrganization?.sameAs==='https://www.concentrix.com','Native JobPosting identity or employer disagrees')
 const geo=geography(model)
 need(!geo.unresolved&&geo.country==='India'&&geo.city===base.city&&geo.state===base.state,'Native own JobPosting geography disagrees')
 if(model.datePosted!=null&&model.datePosted!==''){
  const posted=date(model.datePosted,'own JobPosting publication');need(posted.ms<=Date.parse(observedAt),'Native own JobPosting publication is future')
  base.postingDate=model.datePosted;base.sourceNativePublicationDates.push({origin:'own-role-JobPosting.datePosted',raw:model.datePosted})
 }
 if(model.validThrough!=null&&model.validThrough!==''){
  const expiry=date(model.validThrough,'own JobPosting deadline');need(expiry.lastMs>=Date.parse(observedAt),'Native own JobPosting expired')
  base.closingDate=model.validThrough;base.sourceNativeExpiryDates.push({origin:'own-role-JobPosting.validThrough',raw:model.validThrough})
 }
 const canonical=one(doc.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')),'own canonical')
 need(canonical.attrs.href===listing.sourceUrl,'Foreign or wrong-requisition native role canonical')
 const owner=one(visible.nodes(n=>cls(n,'jdq-single-job-container')),'own active role'),heading=one(visible.nodes(n=>n.tag==='h1'&&cls(n,'jdq-job-title')),'native title')
 need(all(owner).includes(heading)&&norm(nodeText(heading))===listing.title,'Native own role title disagrees')
 const location=visible.nodes(n=>cls(n,'jdq-meta-item')&&n.children.some(c=>typeof c!=='string'&&cls(c,'jdq-label')&&nodeText(c)==='Location'))
 need(location.length===1&&location[0].children.some(c=>typeof c!=='string'&&cls(c,'jdq-value')&&nodeText(c)===base.city+', India'),'Native role location disagrees')
 const apps=all(owner).filter(n=>n.tag==='a'&&n.attrs['data-jdq-apply-url'])
 need(apps.length===2&&apps.every(n=>!n.inert&&!Object.hasOwn(n.attrs,'disabled')&&!['true','1'].includes(n.attrs['aria-disabled'])
  &&!Object.keys(n.attrs).some(k=>/^on[a-z]/.test(k))&&nodeText(n)==='Apply'&&n.attrs.href===base.applyUrl+'?source=concentrixCareerWebSite'
  &&n.attrs['data-jdq-apply-url']===n.attrs.href),'Native role application is disabled, foreign or wrong-requisition')
 need(!raw.some(n=>['addressCountry','validThrough','datePosted','jobStatus','hiringOrganization'].includes(n.attrs.itemprop)),'Unreviewed additional role authority')
 need(!/\b(?:this|the)\s+(?:job|role|vacancy|position)\s+(?:is\s+(?:closed|no longer available)|has\s+been\s+(?:closed|filled))\b/i.test(nodeText(owner)),'Native role explicitly closed')
 const presentation=inspectNativePresentation(html);need(approved(presentation.primary,PROFILE.approvedPrimaryPresentation),'Unreviewed primary role presentation')
 const body=visible.nodes(n=>cls(n,'jdq-body')),native=body.length===1?{...body[0],children:body[0].children.filter(n=>typeof n==='string'||!cls(n,'jdq-apply-link'))}:null
 const visibleCriteria=native?nativeLines(native).join('\n'):'',r=listing.nativeRecord,original=r.long_description||r.short_description||''
 const criteria=readOriginalNativeCriteria(original,fail),additional=r.workday_job_requisition_data.additional_job_description
 const presentationQualified=approved(presentation.criteria,PROFILE.approvedCriteriaPresentation)
 const nativeBodyMatches=criteria.sourceDetailComplete&&comparable(decodeHTML(visibleCriteria))===comparable(decodeHTML(criteria.sourceDescription))
 const ownSchemaMatches=typeof model.description==='string'&&typeof criteria.sourceDescription==='string'
  &&comparable(decodeHTML(model.description))===comparable(decodeHTML(criteria.sourceDescription))
 const additionalReconciled=!norm(additional)||comparable(visibleCriteria).includes(comparable(norm(additional)))
 const missingCriteria=[]
 if(!presentationQualified)missingCriteria.push({kind:'presentation',reason:'native-criteria-presentation-requires-review'})
 if(!criteria.sourceDetailComplete)missingCriteria.push({kind:'index-criteria',reason:criteria.sourceDetailFailureKind??'native-index-full-criteria-unavailable'})
 if(!nativeBodyMatches)missingCriteria.push({kind:'index-vs-own-body',reason:'native-original-index-and-visible-body-criteria-do-not-reconcile'})
 if(!ownSchemaMatches)missingCriteria.push({kind:'own-JobPosting-description',reason:'native-JobPosting-description-and-original-index-criteria-do-not-reconcile'})
 if(!additionalReconciled)missingCriteria.push({kind:'additional-description',reason:'native-additional-description-not-fully-reconciled'})
 const complete=missingCriteria.length===0,partialText=presentationQualified&&norm(visibleCriteria)?visibleCriteria:null
 return {...base,sourceNativeRoleDetailObserved:true,sourceNativePublicationDateUnavailable:base.postingDate===null,
  nativeApplyLinks:apps.map(n=>({url:n.attrs.href,attrs:{...n.attrs},text:nodeText(n)})),
  jobDescription:complete?criteria.jobDescription:partialText,sourceDescription:complete?criteria.sourceDescription:partialText,sourceDescriptionHTML:original,
  sourceNativeJobPosting:model,sourceNativeVisibleCriteriaText:visibleCriteria,sourceNativeCriticalPresentation:presentation,sourceDetailComplete:complete,
  sourceMissingCriteria:missingCriteria,sourceKnownPartialCriteria:!complete&&partialText!==null,
  sourceDetailFailureKind:complete?null:missingCriteria[0]?.reason??'native-visible-criteria-incomplete-or-unreviewed'}
}
function indexPartialRecord(listing,observedAt){
 const base=qualifyRecord(listing,observedAt)
 return {...base,sourceNativeRoleDetailObserved:false,sourceNativePublicationDateUnavailable:base.postingDate===null,
  nativeApplyLinks:[],jobDescription:null,sourceDescription:null,sourceDescriptionHTML:null,sourceNativeJobPosting:null,
  sourceNativeVisibleCriteriaText:null,sourceDetailComplete:false,sourceKnownPartialCriteria:false,
  sourceMissingCriteria:[{kind:'own-role-description',reason:'native-role-detail-outside-first-result-page-enrichment'}],
  sourceDetailFailureKind:'native-role-detail-outside-first-result-page-enrichment'}
}
function ownPublicationHold(error,listing,html=null){
 if(!error?.softFailure||!error.message.startsWith('Concentrix current own publication:'))throw error
 return {sourceHeld:true,sourceUrl:listing.sourceUrl,requisitionId:listing.nativeRecord.ats_external_id,
  reason:error.message,sourceNativeRecord:listing.nativeRecord,
  observedJobPostings:html===null?null:readJobPosting(html),lifecycleCleanupAllowed:false}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated native observations unsupported')
 const reader=createNativeReader(SOURCE,[HOMEPAGE,INDEX],options)
 try{
  const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString()
  const home=async()=>{const {visible}=documentFor((await reader.read(HOMEPAGE)).body);need(visible.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>n.attrs.href==='https://jobs.concentrix.com/job-search/'&&nodeText(n)==='Search & Apply'),'Own current Search & Apply handoff absent')}
  await home();const opening=await reader.read(INDEX),listings=parseCurrentIndex(opening.body),clientURL=clientDeclaration(opening.body)
  reader.allow(clientURL);const client=await reader.read(clientURL,'javascript')
  need(PROFILE.approvedRendererSHA256.includes(sha(client.body)),'Current native country/detail renderer changed')
  const facts=listings.map(row=>{try{return indexPartialRecord(row,observedAt)}catch(error){return ownPublicationHold(error,row)}})
  // The reviewed ordinary renderer displays ten records per result page. Keep all
  // independently current index publications, but bound expensive detail enrichment
  // to that first native page rather than repeatedly loading the entire country.
  const selected=listings.slice(0,10).map((row,index)=>({row,index})).filter(({index})=>!facts[index].sourceHeld)
  for(const {row} of selected)reader.allow(row.sourceUrl)
  const readRole=async({row})=>{const {body}=await reader.read(row.sourceUrl);try{return parseCurrentRole(body,row,observedAt)}catch(error){return ownPublicationHold(error,row,body)}}
  const openingDetails=await mapOriginalRoles(selected,readRole),closingDetails=await mapOriginalRoles(selected,readRole)
  for(const [offset,{index}] of selected.entries()){
   const openingFact=openingDetails[offset],closingFact=closingDetails[offset]
   if(openingFact.sourceHeld||closingFact.sourceHeld){facts[index]={sourceHeld:true,requisitionId:listings[index].nativeRecord.ats_external_id,
    sourceUrl:listings[index].sourceUrl,opening:openingFact,closing:closingFact,lifecycleCleanupAllowed:false};continue}
   need(JSON.stringify(openingFact)===JSON.stringify(closingFact),'Closing native role criteria, identity, geography, application or original models changed')
   facts[index]={...openingFact,sourceDetailClosingReconciled:true}
  }
  const final=await reader.read(INDEX)
  const closingListings=parseCurrentIndex(final.body)
  need(JSON.stringify(closingListings)===JSON.stringify(listings)&&clientDeclaration(final.body)===clientURL,'Closing native published country cohort or renderer declaration changed')
  need(sha((await reader.read(clientURL,'javascript')).body)===sha(client.body),'Closing native renderer changed');await home()
  const closedByID=new Map(closingListings.map(r=>[r.nativeRecord.ats_external_id,r.nativeRecord]))
  const jobs=facts.filter(r=>!r.sourceHeld).map(r=>({...r,source:SOURCE,company:COMPANY,link:r.applyUrl,scrapedAt:observedAt,sourceNativeClosingRecord:closedByID.get(r.requisitionId),
   sourceClosingReconciled:true,companyCareerPage:HOMEPAGE,companyDomain:'concentrix.com',atsPlatform:'official-company-careers'}))
  const audit={source:SOURCE,recoveryKind:'current-native-published-country-cohort-company-scope-held',recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,
   observedNativeRecords:listings.map(r=>r.nativeRecord),closingNativeRecords:closingListings.map(r=>r.nativeRecord),returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,
   heldNativeRoles:facts.filter(r=>r.sourceHeld),nativeRoleDetailEnrichmentScope:'first-native-ten-result-page',
   nativeRoleDetailsObserved:selected.length,nativeIndexOnlyPartialRecords:jobs.filter(r=>!r.sourceNativeRoleDetailObserved).length,
   nativeOpeningClosingObservedDetailFactsMatch:true,nativeOpeningClosingCriteriaMatch:jobs.every(r=>r.sourceNativeRoleDetailObserved),
   nativeOpeningClosingRecordsMatch:true,currentRendererURL:clientURL,currentRendererSHA256:sha(client.body),fullCriteriaRecovered:jobs.every(r=>r.sourceDetailComplete),
   fullCriteriaIndiaJobs:jobs.filter(r=>r.sourceDetailComplete).length,missingCriteriaJobs:jobs.filter(r=>!r.sourceDetailComplete).length,backendApplicationActivationVerified:false,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,sourcePaginationHold:'current-ordinary-native-country-query-cohort;additional-source-surfaces-and-company-exhaustiveness-unproven',...reader.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  need(Buffer.byteLength(JSON.stringify(jobs))<=16*1024*1024,'Native publication output exceeds bound');reader.check();return jobs
 }finally{reader.close()}
}
