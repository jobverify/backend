import{isDeepStrictEqual}from'node:util'
import{readNativeDocument,activeHead,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import{nativeCountryName,nativeLocationCountryName,nativeDate}from'../../scraper-support/shared/nativeJobPosting.js'
import{findExplicitNativeClosure}from'../../scraper-support/utils/sourceAvailability.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{currentRapid7Transport}from'./currentTransport20261117.js'
import{extractJobCardsFromSearchPage}from'./script.js'
const source='rapid7india',origin='https://careers.rapid7.com',search=origin+'/jobs/search',norm=x=>String(x??'').replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Rapid7 current publication: '+message),{abortRetries:true})},one=(xs,label)=>{need(xs.length===1,'unique '+label+' unavailable');return xs[0]}
const cls=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c),disabled=n=>Object.hasOwn(n.attrs,'disabled')||n.attrs['aria-disabled']==='true'
function listing(html,pageNumber){
 const d=readNativeDocument(html),form=one(d.nodes(n=>n.tag==='form'&&cls(n,'job-search-results-form')),'native search form'),parsed=extractJobCardsFromSearchPage(html)
 need(isDeepStrictEqual(activeHead(html).titles,['Search Page'])&&form.attrs.action===search&&form.attrs.method==='get'&&form.attrs['data-action']==='jobs--search#submitForm','native own search form identity differs')
 const rows=d.nodes(n=>n.tag==='tr'&&n.attrs['data-job-url']);need(rows.length>0&&rows.length<=30&&rows.length===parsed.length,'complete active native row accounting unavailable')
 const cards=rows.map(row=>{const url=row.attrs['data-job-url'],a=one(d.nodes(n=>n.tag==='a',row),'native row title'),card=one(parsed.filter(r=>r.sourceUrl===url),'native parsed row')
  need(row.attrs.role==='link'&&row.attrs['data-action']==='click->jobs--table-results#navigate'&&new URL(url).origin===origin&&url.startsWith(origin+'/jobs/')&&!/[?#]/.test(url)&&a.attrs.href===url&&d.text(a)===card.title&&/^R\d+$/.test(card.requisitionId),'native row identity/authority differs')
  return{...card,nativeRowModel:structuredClone(row)}
 })
 const next=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.rel==='next').map(n=>new URL(n.attrs.href,origin).href))];need(next.length<=1&&(!next.length||next[0]===search+'?page='+(pageNumber+1)),'native forward pagination differs')
 return{cards,next:next[0]??null}
}
function authoredBlocks(html){const d=readNativeDocument(typeof html==='string'?html:'');return[extractActiveDescription(html??'')??'',...d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag)).map(d.text)]}
function availability(schema,blocks,observedAt){
 const now=new Date(observedAt),dates=[],authoredDates=[];need(Number.isFinite(+now),'invalid observation clock')
 if(schema.status!=null)need(!/^(?:closed|filled|expired|inactive|removed|archived|draft)$/i.test(norm(schema.status)),'native publication explicitly closed')
 for(const field of['canApply','isActive','isPublished'])if(schema[field]!=null)need(schema[field]===true,'native availability conflict')
 for(const field of['isClosed','closed','isArchived','archived','expired','isExpired'])if(schema[field]!=null)need(schema[field]===false,'native availability explicitly closed')
 for(const field of['country','countryCode','workCountry'])if(schema[field]!=null)need(nativeCountryName(schema[field])==='India','native country conflict')
 for(const field of['employer','legalEmployer'])if(schema[field]!=null){const name=typeof schema[field]==='string'?schema[field]:schema[field].name;need(name==='Rapid7','native authored employer conflict')}
 if(schema.applicantLocationRequirements!=null){const places=Array.isArray(schema.applicantLocationRequirements)?schema.applicantLocationRequirements:[schema.applicantLocationRequirements];need(places.length>0&&places.every(p=>nativeCountryName(typeof p==='string'?p:p.name??p.addressCountry)==='India'),'native applicant workplace/country eligibility conflict')}
 for(const field of['validThrough','closingDate','applicationDeadline','dateExpires'])if(schema[field]!=null&&schema[field]!==''){const date=nativeDate(schema[field],{required:true});need(date.exact?Date.parse(date.iso)>=+now:date.iso.slice(0,10)>=now.toISOString().slice(0,10),'native publication expired');dates.push({field,value:date.raw})}
 need(!findExplicitNativeClosure(blocks),'native role or application explicitly closed')
 for(const block of blocks){const country=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block);if(country)need(nativeCountryName(country[1])==='India','native authored country conflict');const place=/^(?:(?:job|work)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(block);if(place){const c=nativeLocationCountryName(place[1]);need(!c||c==='India','native authored workplace conflict')}const employer=/^(?:company(?: name)?|employer|legal employer|hiring organization)\s*:\s*(.+)$/i.exec(block);if(employer)need(norm(employer[1])==='Rapid7','native authored employer conflict')
  const closing=/^(Closing Date|Application Deadline|Applications Close|Valid Through|Expiry Date)\s*:\s*(.+)$/i.exec(block),posted=/^(Date Posted|Posted Date|Posting Date|Publication Date)\s*:\s*(.+)$/i.exec(block),match=closing??posted
  if(match){const date=nativeDate(norm(match[2]),{required:true}),entry={kind:closing?'closing':'posted',label:match[1],value:date.raw};if(closing){need(date.exact?Date.parse(date.iso)>=+now:date.iso.slice(0,10)>=now.toISOString().slice(0,10),'native authored publication expired');if(!dates.some(d=>d.field===entry.label&&d.value===entry.value))dates.push({field:entry.label,value:entry.value})}else need(date.exact?Date.parse(date.iso)<=+now:date.iso.slice(0,10)<=now.toISOString().slice(0,10),'native authored publication date in future');if(!authoredDates.some(d=>isDeepStrictEqual(d,entry)))authoredDates.push(entry)}
 }
 return{expiry:dates,authoredDates}
}
export function readRapidPublishedDetail(html,card){
 const d=readNativeDocument(html),title=one(d.nodes(n=>n.tag==='h3'&&n.attrs.class==='job-title'),'native role title'),canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical')
 const schema=one(d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw)).filter(s=>s['@type']==='JobPosting'),'native JobPosting'),nativeId=schema.identifier?.value
 need(canonical.attrs.href===card.sourceUrl&&d.text(title)===card.title&&schema.title===card.title&&schema.identifier?.name==='Rapid7'&&/^[a-f0-9]{32}$/.test(nativeId??'')&&schema.hiringOrganization?.name==='Rapid7','native role/title/publisher/identifier differs')
 const requisition=one(d.nodes(n=>n.attrs.id?.startsWith('requisition_identifier_icon_text_'+nativeId+'_')),'native requisition'),locations=d.nodes(n=>cls(n,'job-component-location'))
 need(d.text(requisition)===card.requisitionId&&locations.length>0&&locations.every(n=>d.text(n)===card.location),'native listing/detail requisition or workplace differs')
 const addresses=Array.isArray(schema.jobLocation)?schema.jobLocation:[schema.jobLocation],city=card.location.split(',').map(norm)
 need(city.length===2&&city[1]==='India'&&addresses.length>0&&addresses.every(p=>p?.['@type']==='Place'&&nativeCountryName(p.address?.addressCountry)==='India'&&p.address?.addressLocality===city[0]),'native full explicit India workplace unavailable')
 const descriptions=d.nodes(n=>cls(n,'job-description'));need(descriptions.length<=1,'native criteria scope ambiguous')
 const visible=descriptions[0]??null,frames=d.nodes(n=>n.attrs['data-controller']==='call-to-action--form'&&n.attrs['data-call-to-action--form-kind-value']==='apply_url').map(n=>{
  const frame=one(d.nodes(n=>n.tag==='turbo-frame'&&n.attrs.src,n),'declared application frame'),url=new URL(frame.attrs.src,origin),parts=/^\/pages\/([a-f0-9]{32})\/blocks\/([a-f0-9]{32})$/.exec(url.pathname),uid=n.attrs['data-call-to-action--form-uid-value']
  need(url.origin===origin&&parts&&url.searchParams.get('job_uid')===nativeId&&/^[a-f0-9]{32}$/.test(uid??'')&&!disabled(n),'native same-role declared application frame differs')
  return{url:url.href,formUid:uid,pageId:parts[1],blockId:parts[2],controllerAttrs:n.attrs,frameAttrs:frame.attrs}
 })
 need(frames.length>=1&&frames.length<=3&&frames.every(f=>f.formUid===frames[0].formUid),'native own application declaration unavailable')
 return{schema,nativeId,city:city[0],visibleDescription:visible?d.text(visible):null,visibleModel:visible?structuredClone(visible):null,frames,roleStatusBlocks:[...authoredBlocks(schema.description),...(visible?[d.text(visible),...d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag),visible).map(d.text)]:[])]}
}
function normalizedForm(node){if(typeof node==='string')return node;const attrs={...node.attrs};if(node.tag==='input'&&attrs.name==='authenticity_token')attrs.value='[per-read-native-CSRF-token]';return{...node,attrs,children:cls(node,'ada-unique-content')?['[per-read-native-ADA-label-token]']:node.children.map(normalizedForm)}}
function application(html,detail){
 const d=readNativeDocument(html),declared=detail.frames[0],frame=one(d.nodes(n=>n.tag==='turbo-frame'&&n.attrs.id==='turbo_frame_page_block_'+declared.blockId),'native returned application frame'),form=one(d.nodes(n=>n.tag==='form',frame),'native declared application form'),action=new URL(form.attrs.action,origin)
 need(form.attrs.method==='post'&&action.origin===origin&&action.pathname==='/call_to_actions/'+declared.formUid+'/form_submissions'&&action.searchParams.get('job_id')===detail.nativeId&&action.searchParams.get('page_id')===declared.pageId&&!disabled(form)&&!disabled(frame),'native same-role application action unavailable')
 const fields=d.nodes(n=>['input','textarea','select','button'].includes(n.tag),form),submit=fields.filter(n=>n.tag==='button'&&n.attrs.type==='submit'&&!disabled(n))
 need(submit.length===1&&d.text(submit[0]).startsWith('Apply')&&!d.nodes(n=>n.tag==='fieldset'&&disabled(n),form).length,'native application enabled submit unavailable')
 for(const name of['candidate_first_name','candidate_last_name','candidate_email']){const field=one(fields.filter(n=>n.attrs['data-candidate-field']===name),'native application '+name);need(Object.hasOwn(field.attrs,'required')&&!disabled(field),'native required application field unavailable')}
 const blocks=d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag),frame).map(d.text);blocks.push(d.text(frame));need(!findExplicitNativeClosure(blocks),'native application explicitly closed')
 return{url:declared.url,method:form.attrs.method,action:action.href,originalModel:structuredClone(form),originalFrameModel:structuredClone(frame),controls:fields.map(n=>({tag:n.tag,attrs:n.attrs})),closingComparisonModel:normalizedForm(form),blocks}
}
export function rapidPublishedObservedDetail(html,card,{observedAt=new Date().toISOString()}={}){
 const detail=readRapidPublishedDetail(html,card),dates=availability(detail.schema,detail.roleStatusBlocks,observedAt),description=extractActiveDescription(detail.schema.description??'')||detail.visibleDescription||null
 const posted=detail.schema.datePosted==null?null:nativeDate(detail.schema.datePosted,{required:true}).raw;need(!posted||Date.parse(posted)<=Date.parse(observedAt),'native posting date in future')
 return{source,company:'Rapid7',sourceConfiguredCompany:'Rapid7 India',sourceNativePublisher:'Rapid7',nativeEmployer:'Rapid7',nativeLegalEmployer:null,sourceRegionalLegalEntityUnverified:true,
  title:card.title,jobId:card.requisitionId,requisitionId:card.requisitionId,sourceUrl:card.sourceUrl,applyUrl:card.sourceUrl,link:card.sourceUrl,location:card.location,city:detail.city,country:'India',sourceCountryScopeUnresolved:false,
  sourceNativeRecord:card,sourceNativeSchemaIdentifier:detail.nativeId,sourceNativeJobPosting:detail.schema,sourceNativeVisibleDescription:detail.visibleDescription,sourceNativeVisibleDescriptionModel:detail.visibleModel,sourceNativeDescription:detail.schema.description??null,sourceDescription:description,jobDescription:description,
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'published-native-criteria-and-preapplication-capture-form-only-delegated-ATS-and-all-controls-unverified',sourceCriteriaConflict:Boolean(detail.schema.description&&detail.visibleDescription&&extractActiveDescription(detail.schema.description)!==detail.visibleDescription),
  sourceNativeApplication:{url:card.sourceUrl,declaredFrames:detail.frames,kind:'native-own-published-role-link-with-declared-preapplication-frame',submitted:false,activationVerified:false,delegatedATSQualified:false,allControlsQualified:false,closingQualified:false},
  sourceNativeAvailability:{publishedNativeJobPosting:true,sameRoleNativeApplicationForm:false,backendCanApplyVerified:false},postingDate:posted,closingDate:dates.expiry[0]?.value??null,sourceNativeDates:{datePosted:detail.schema.datePosted??null,recognizedExpiryFields:dates.expiry,authoredDates:dates.authoredDates},
  department:card.department,remoteStatus:card.workplaceType,employmentType:detail.schema.employmentType??null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceCompanyScopeUnresolved:false}
}
export function rapidPublishedRole(html,applicationHTML,card,{observedAt=new Date().toISOString()}={}){
 const job=rapidPublishedObservedDetail(html,card,{observedAt}),detail=readRapidPublishedDetail(html,card),form=application(applicationHTML,detail),dates=availability(detail.schema,[...detail.roleStatusBlocks,...form.blocks],observedAt)
 return{...job,sourceNativeApplication:{...form,declaredFrames:detail.frames,kind:'same-job-declared-native-preapplication-form',submitted:false,activationVerified:false,delegatedATSQualified:false,allControlsQualified:false,closingQualified:false},sourceNativeAvailability:{...job.sourceNativeAvailability,sameRoleNativeApplicationForm:true},closingDate:dates.expiry[0]?.value??null,sourceNativeDates:{...job.sourceNativeDates,recognizedExpiryFields:dates.expiry,authoredDates:dates.authoredDates}}
}
export function rapidPublishedListingRole(card,{observedAt=new Date().toISOString()}={}){
 const d=readNativeDocument(''),row=card.nativeRowModel,anchor=one(d.nodes(n=>n.tag==='a',row),'published row role link'),parts=card.location.split(',').map(norm)
 need(row?.tag==='tr'&&row.attrs.role==='link'&&row.attrs['data-job-url']===card.sourceUrl&&anchor.attrs.href===card.sourceUrl&&d.text(anchor)===card.title&&/^R\d+$/.test(card.requisitionId)&&new URL(card.sourceUrl).origin===origin&&card.sourceUrl.startsWith(origin+'/jobs/'),'native published row identity differs')
 need(parts.length===2&&parts[1]==='India'&&nativeLocationCountryName(card.location)==='India','native exact whole published India workplace unavailable')
 need(!disabled(row),'native published row unavailable')
 for(const key of['data-status','data-job-status'])if(row.attrs[key]!=null)need(!/^(?:closed|filled|archived|expired|inactive|removed|draft)$/i.test(row.attrs[key]),'native published row explicitly closed')
 for(const key of['data-is-closed','data-closed','data-is-archived','data-archived'])if(row.attrs[key]!=null)need(row.attrs[key]==='false','native published row explicitly closed')
 for(const key of['data-country','data-country-code'])if(row.attrs[key]!=null)need(nativeCountryName(row.attrs[key])==='India','native published row country conflict')
 const blocks=[d.text(row),...d.nodes(n=>['p','li','td','span','div','strong','b'].includes(n.tag),row).map(d.text)],dates=availability({},blocks,observedAt)
 return{source,company:'Rapid7',sourceConfiguredCompany:'Rapid7 India',sourceNativePublisher:'Rapid7',nativeEmployer:'Rapid7',nativeLegalEmployer:null,sourceRegionalLegalEntityUnverified:true,
  title:card.title,jobId:card.requisitionId,requisitionId:card.requisitionId,sourceUrl:card.sourceUrl,applyUrl:card.sourceUrl,link:card.sourceUrl,location:card.location,city:parts[0],country:'India',sourceCountryScopeUnresolved:false,
  sourceNativeRecord:card,sourceNativeSchemaIdentifier:null,sourceNativeJobPosting:null,sourceNativeVisibleDescription:null,sourceNativeVisibleDescriptionModel:null,sourceNativeDescription:null,sourceDescription:null,jobDescription:null,
  sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'current-native-search-publication-only-full-role-criteria-and-application-controls-unavailable',sourceCriteriaConflict:false,
  sourceNativeApplication:{url:card.sourceUrl,kind:'native-own-published-role-link',requisitionId:card.requisitionId,nativeSchemaIdentifier:null,allControlsQualified:false,activationVerified:false,delegatedATSQualified:false,submitted:false,closingQualified:false},
  sourceNativeAvailability:{publishedNativeSearchRow:true,wholeOpeningClosingNativeRowQualified:true,backendCanApplyVerified:false},postingDate:dates.authoredDates.find(v=>v.kind==='posted')?.value??null,closingDate:dates.expiry[0]?.value??null,sourceNativeDates:{datePosted:null,recognizedExpiryFields:dates.expiry,authoredDates:dates.authoredDates},
  department:card.department,remoteStatus:card.workplaceType,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceCompanyScopeUnresolved:false}
}
const comparison=job=>({schema:job.sourceNativeJobPosting,visible:job.sourceNativeVisibleDescriptionModel,application:job.sourceNativeApplication.closingComparisonModel,frames:job.sourceNativeApplication.declaredFrames})
function observedPartial(job,previous,phase){
 let app=job.sourceNativeApplication
 if(!app.originalModel&&previous.sourceNativeApplication.originalModel&&isDeepStrictEqual(app.declaredFrames,previous.sourceNativeApplication.declaredFrames))app=previous.sourceNativeApplication
 const observations=[...(previous.sourceNativeDetailObservations??[])]
 if(phase)observations.push({phase,nativeJobPosting:job.sourceNativeJobPosting,nativeVisibleDescriptionModel:job.sourceNativeVisibleDescriptionModel,nativeDescription:job.sourceNativeDescription,sourceDescription:job.sourceDescription,postingDate:job.postingDate,closingDate:job.closingDate,nativeDates:job.sourceNativeDates})
 return{...job,sourceClosingQualified:true,publicationClosingQualified:true,sourcePublicationClosingQualified:true,detailClosingQualified:false,sourceDetailClosingQualified:false,sourceNativeDetailObservations:observations,sourceNativeApplication:{...app,closingQualified:false},sourceDetailComplete:false,sourceDetailStatus:'partial',scrapedAt:previous.scrapedAt}
}
export async function runRapidPublished(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free callback transport unqualified')
 const allowed=new Set([search]),raw=[],io=currentRapid7Transport({...options,requestIntervalMs:options.requestIntervalMs??2000,allowedURL:u=>allowed.has(u)})
 let pages=0,requests=0,accessStopped=false,paginationComplete=false;const held=[],details=[],opening=[],closing=[],qualified=new Map(),optionalEnrichmentUnavailable=[]
 const read=async url=>{if(++requests>40)throw Object.assign(Error('Rapid7 optional native read budget exhausted'),{failureKind:'native_read_budget_exhausted'});allowed.add(url);const response=await io.read(url);raw.push({...response,originalHTML:response.text});return response.text}
 const denied=error=>error.failureKind==='blocked_or_access_denied'||[202,401,403,429,451].includes(error.status??error.httpStatus)
 const unavailable=error=>denied(error)||['network_or_timeout','native_read_budget_exhausted'].includes(error.failureKind)||[500,502,503,504].includes(error.status??error.httpStatus)||error.name==='TimeoutError'||error instanceof TypeError&&error.message==='fetch failed'||/^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_\w+)$/.test(error.cause?.code??'')
 const observedAt=(options.now||(()=>new Date().toISOString()))()
 try{
  let url=search
  for(let page=1;url&&page<=10;page++){
   let current,last
   try{current=listing(await read(url),page);pages++;opening.push(...current.cards);need(opening.length<=300&&new Set(opening.map(c=>c.requisitionId)).size===opening.length,'native inventory identity or bound differs');last=listing(await read(url),page);closing.push(...last.cards)}
   catch(error){options.signal?.throwIfAborted();io.signal.throwIfAborted();if(!unavailable(error))throw error;held.push({stage:'optional-pagination',url,reason:error.message,httpStatus:error.status??error.httpStatus??null});accessStopped=denied(error);break}
   const closeById=new Map(last.cards.map(c=>[c.requisitionId,c]))
   for(const card of current.cards.filter(c=>nativeLocationCountryName(c.location)==='India')){try{
    need(isDeepStrictEqual(card,closeById.get(card.requisitionId)),'native closing whole publication row changed');const job=rapidPublishedListingRole(card,{observedAt});rapidPublishedListingRole(closeById.get(card.requisitionId),{observedAt:(options.now||(()=>new Date().toISOString()))()});job.sourceClosingQualified=true;job.publicationClosingQualified=true;job.sourcePublicationClosingQualified=true;job.detailClosingQualified=false;job.sourceDetailClosingQualified=false;job.sourceNativeDetailObservations=[];job.scrapedAt=observedAt;qualified.set(card.requisitionId,job)
   }catch(error){held.push({id:card.requisitionId,stage:'native-publication',reason:error.message,originalRecord:card,closingRecord:closeById.get(card.requisitionId)??null})}}
   if(current.next!==last.next){held.push({stage:'optional-pagination',reason:'native closing pagination declaration changed'});break}url=current.next;if(!url)paginationComplete=true
  }
  const india=[...qualified.values()].map(job=>job.sourceNativeRecord)
  for(let index=0;index<india.length;index++){const card=india[index];if(accessStopped){optionalEnrichmentUnavailable.push({id:card.requisitionId,reason:'not-read-after-native-access-denial'});continue}try{
   const openHTML=await read(card.sourceUrl),openObserved=rapidPublishedObservedDetail(openHTML,card,{observedAt:(options.now||(()=>new Date().toISOString()))()});details.push({id:card.requisitionId,phase:'opening',originalNativeRecord:openObserved});qualified.set(card.requisitionId,observedPartial(openObserved,qualified.get(card.requisitionId),'opening'))
   const openApplication=await read(openObserved.sourceNativeApplication.declaredFrames[0].url),job=rapidPublishedRole(openHTML,openApplication,card,{observedAt:(options.now||(()=>new Date().toISOString()))()});qualified.set(card.requisitionId,observedPartial(job,qualified.get(card.requisitionId)))
   const closeHTML=await read(card.sourceUrl),closeObserved=rapidPublishedObservedDetail(closeHTML,card,{observedAt:(options.now||(()=>new Date().toISOString()))()});details.push({id:card.requisitionId,phase:'closing',originalNativeRecord:closeObserved});qualified.set(card.requisitionId,observedPartial(closeObserved,qualified.get(card.requisitionId),'closing'))
   const closeApplication=await read(closeObserved.sourceNativeApplication.declaredFrames[0].url),current=rapidPublishedRole(closeHTML,closeApplication,card,{observedAt:(options.now||(()=>new Date().toISOString()))()});qualified.set(card.requisitionId,observedPartial(current,qualified.get(card.requisitionId)))
   details.push({id:card.requisitionId,openingNativeRecord:job,closingNativeRecord:current})
   if(!isDeepStrictEqual(comparison(job),comparison(current))){const reason='native closing optional role criteria/application model changed';qualified.get(card.requisitionId).sourceOptionalEnrichmentUnavailable=reason;optionalEnrichmentUnavailable.push({id:card.requisitionId,reason});continue}
   const complete=qualified.get(card.requisitionId);complete.detailClosingQualified=true;complete.sourceDetailClosingQualified=true;complete.sourceNativeApplication.closingQualified=true;complete.sourceListingClosingQualified=true
  }catch(error){options.signal?.throwIfAborted();io.signal.throwIfAborted();const row={id:card.requisitionId,reason:error.message,httpStatus:error.status??error.httpStatus??null,originalRecord:card}
   if(unavailable(error)){optionalEnrichmentUnavailable.push(row);qualified.get(card.requisitionId).sourceOptionalEnrichmentUnavailable=error.message;if(denied(error))accessStopped=true}
   else{qualified.delete(card.requisitionId);held.push(row)}
  }}
  const jobs=[...qualified.values()],audit={source,nativeOpeningInventory:opening,nativeClosingInventory:closing,nativeRoleModels:details,held,optionalEnrichmentUnavailable,originalResponses:raw,retainedResponses:io.receipts,listingPagesFetched:pages,listingOpeningPaginationComplete:paginationComplete,closingInventoryMatches:paginationComplete&&isDeepStrictEqual(opening,closing),companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendActivationVerified:false,applicationSubmitted:false}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit){let listener;try{await Promise.race([Promise.resolve().then(()=>options.onAudit(structuredClone(audit))),new Promise((_,reject)=>{listener=()=>reject(io.signal.reason);io.signal.addEventListener('abort',listener,{once:true});if(io.signal.aborted)listener()})])}finally{if(listener)io.signal.removeEventListener('abort',listener)}}io.signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:search,firstParty:true,pagesFetched:raw.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-own-India-publication-rows-opening-closing-qualified;observed-native-criteria-dates-and-form-models-retained-with-phase-limits;optional-access-full-ATS-legal-employer-company-inventory-and-cleanup-held'})
 }finally{io.close()}
}
