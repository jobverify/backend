import {annotateFailure,errorValue} from './runtime20261107.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as rawDocument, norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate,nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {normalizeCity} from '../../scraper-support/utils/cityNormalizer.js'
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const EMPLOYER_URL='https://waymo.com/'
const ORIGIN='https://careers.withwaymo.com'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Waymo native proof: '+message),{code:'WAYMO_NATIVE_PROOF',abortRetries:true})}
const one=(nodes,label)=>{check(nodes.length===1,'missing/ambiguous '+label);return nodes[0]}
const children=node=>node.children.filter(n=>typeof n!=='string')
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(n=>within(n,predicate))]
const all=node=>[node,...children(node).flatMap(all)]
const visible=html=>readVisibleNativeDocument(html,{strict:true})
const plain=html=>{const d=visible(html);return d.text(one(d.nodes(n=>n.tag==='root'),'description root'))}
const key=value=>norm(value).replace(/\s/g,'')
const json=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const sourceInterruption=error=>[202,401,403,429,451].includes(error?.status)
const keysAre=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k))
const roleURL=value=>{
 let u;try{u=new URL(value,ORIGIN)}catch{check(false,'invalid role URL')}
 check(u.origin===ORIGIN&&/^\/jobs\/[a-z0-9-]+$/.test(u.pathname)&&u.pathname!=='/jobs/search'&&!u.search&&!u.hash&&!u.username&&!u.password,'unbound role URL')
 return u.href
}
const field=(doc,node,name,required=true)=>{
 const matches=within(node,n=>n.tag==='li'&&doc.hasClass(n,'job-component-'+name))
 if(!required&&!matches.length)return null
 const item=one(matches,'role '+name),span=one(within(item,n=>n.tag==='span'),'role '+name+' value')
 const value=doc.text(span);check(value,'empty role '+name);return value
}
const listing=html=>{
 const doc=visible(html),counts=doc.nodes(n=>doc.hasClass(n,'table-counts'))
 const match=counts.length===1&&doc.text(counts[0]).match(/^Displaying all (\d+) entries$/)
 const count=match?Number(match[1]):null
 check(Number.isSafeInteger(count)&&count>=0&&count<=100,'incomplete displayed India count')
 const selected=doc.nodes(n=>n.tag==='input'&&n.attrs.name==='country_codes[]'&&Object.hasOwn(n.attrs,'checked'))
 const declaredSelected=all(rawDocument(html).root).filter(n=>n.tag==='input'&&n.attrs.name==='country_codes[]'&&Object.hasOwn(n.attrs,'checked'))
 check(selected.length===1&&selected[0].attrs.type==='checkbox'&&selected[0].attrs.value==='IN'
  &&declaredSelected.length===1&&declaredSelected[0].attrs.value==='IN','native India country filter changed')
 const cards=doc.nodes(n=>n.tag==='article'&&doc.hasClass(n,'job-search-results-card-col'))
 check(cards.length===count,'incomplete visible India job-card count')
 const rows=cards.map(card=>{
  const title=one(within(card,n=>n.tag==='a'&&/^link_job_title_/.test(n.attrs.id||'')),'listing title')
  const component=one(within(card,n=>doc.hasClass(n,'job-component-details')),'listing native identity')
  const ids=(component.attrs.class||'').split(/\s+/).map(c=>c.match(/^job-component-details-([a-f0-9]{32})$/)?.[1]).filter(Boolean)
  check(ids.length===1,'missing/ambiguous listing native identity')
  const url=roleURL(title.attrs.href),label=doc.text(title);check(label,'missing listing title')
  return{url,title:label,nativeId:ids[0],location:field(doc,card,'location'),department:field(doc,card,'department'),
   employmentType:field(doc,card,'employment-type'),experienceRequired:field(doc,card,'dropdown-field-2',false)}
 })
 check(new Set(rows.map(r=>r.nativeId)).size===rows.length&&new Set(rows.map(r=>r.url)).size===rows.length,'duplicate native listing identity')
 return{count,rows}
}
const employer=html=>{
 const doc=visible(html)
 check(doc.nodes(n=>n.tag==='a'&&[ORIGIN,ORIGIN+'/'].includes(n.attrs.href)&&doc.text(n)).length>0,'visible official employer handoff missing')
}
const detail=(html,row,clock)=>{
 const doc=visible(html),raw=rawDocument(html),declared=all(raw.root).filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
 check(declared.length===1&&scripts.length===1,'hidden/duplicate native JobPosting')
 const posting=JSON.parse(scripts[0].raw)
 const allowed=['@context','@type','title','description','datePosted','employmentType','validThrough','hiringOrganization','identifier','directApply','jobLocation']
 check(posting&&posting['@type']==='JobPosting'&&Object.keys(posting).every(k=>allowed.includes(k)),'unreviewed native JobPosting criteria')
 check(typeof posting.title==='string'&&typeof posting.employmentType==='string'&&typeof posting.datePosted==='string'&&(posting.validThrough==null||typeof posting.validThrough==='string'),'unreviewed native scalar publication/role criteria')
 check(posting['@context']==='https://schema.org/'&&posting.directApply===true,'unreviewed native publication/direct application criteria')
 check(keysAre(posting.hiringOrganization,['@type','name','sameAs','logo'])&&posting.hiringOrganization['@type']==='Organization'&&typeof posting.hiringOrganization.logo==='string','unreviewed native employer scope')
 check(keysAre(posting.identifier,['@type','name','value'])&&posting.identifier['@type']==='PropertyValue','unreviewed native identifier scope')
 check(norm(posting.title)===row.title&&posting.identifier?.name==='Waymo'&&posting.identifier?.value===row.nativeId,'listing/detail native identity conflict')
 check(posting.hiringOrganization?.name==='Waymo'&&posting.hiringOrganization.sameAs===EMPLOYER_URL,'native employer conflict')
 check(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical role').attrs.href===row.url,'detail canonical role conflict')
 const block=one(doc.nodes(n=>doc.hasClass(n,'block-job-description')),'visible role block')
 check(doc.text(one(within(block,n=>doc.hasClass(n,'job-title')),'visible role title'))===row.title,'visible role title conflict')
 check(!/\b(?:this (?:job|position) is no longer (?:available|active)|no longer accepting applications|position (?:has been|is) filled)\b/i.test(doc.text(one(doc.nodes(n=>n.tag==='root'),'role page'))),'native role visibly closed')
 const component=one(within(block,n=>doc.hasClass(n,'job-component-details')),'detail native identity')
 check(doc.hasClass(component,'job-component-details-'+row.nativeId),'detail visible native identity conflict')
 const location=field(doc,block,'location')
 check(location===row.location,'visible listing/detail location conflict')
 check(field(doc,block,'department')===row.department&&field(doc,block,'employment-type')===row.employmentType,'visible listing/detail criteria conflict')
 const places=posting.jobLocation
 check(Array.isArray(places)&&places.length===1,'unreviewed primary/secondary location scope')
 check(keysAre(places[0],['@type','address'])&&places[0]['@type']==='Place','unreviewed native location scope')
 const address=places[0]?.address
 check(address&&['addressLocality','addressRegion','addressCountry'].every(key=>typeof address[key]==='string')&&(address.streetAddress===undefined||typeof address.streetAddress==='string'),'unreviewed native address scalar scope')
 check(address&&address['@type']==='PostalAddress'&&Object.keys(address).every(k=>['@type','streetAddress','addressLocality','addressRegion','addressCountry'].includes(k))
  &&nativeCountryName(address.addressCountry)==='India','missing or conflicting explicit native India country')
 check(norm(address.addressLocality)&&norm(address.addressRegion)&&[address.addressLocality,address.addressRegion].map(norm).join(', ')===location,'native city/region conflict')
 const description=doc.text(one(within(block,n=>doc.hasClass(n,'job-description')),'visible native description'))
 check(typeof posting.description==='string'&&description.length>=100&&key(description)===key(plain(posting.description)),'visible/native full description mismatch')
 const posted=nativeDate(posting.datePosted,{required:true}),closing=nativeDate(posting.validThrough)
 check(Date.parse(posted.iso)<=Date.parse(clock)&&(!closing.iso||Date.parse(closing.iso)>Date.parse(clock)&&closing.iso>=posted.iso),'future publication or expired native role')
 check(norm(posting.employmentType).replace(/[_-]/g,'').toLowerCase()===row.employmentType.replace(/[_-]/g,'').toLowerCase(),'native employment type conflict')
 const applyBlock=one(doc.nodes(n=>n.attrs['data-call-to-action--form-kind-value']==='apply_url'),'advertised application block')
 const frame=one(within(applyBlock,n=>n.tag==='turbo-frame'),'advertised application frame')
 const frameURL=new URL(frame.attrs.src,ORIGIN),route=frameURL.pathname.match(/^\/pages\/([a-f0-9]{32})\/blocks\/([a-f0-9]{32})$/)
 check(frameURL.origin===ORIGIN&&!frameURL.username&&!frameURL.password&&route&&frameURL.searchParams.get('job_uid')===row.nativeId
  &&[...frameURL.searchParams.keys()].sort().join(',')==='job_uid,postfix'&&!frameURL.hash
  &&frame.attrs.id==='turbo_frame_page_block_'+route[2]&&/^[a-f0-9]{32}$/.test(applyBlock.attrs['data-call-to-action--form-uid-value']||''),'unbound advertised application frame')
 return{posting,address,description,posted,closing,requisitionId:field(doc,block,'requisition-identifier'),
  workplace:field(doc,block,'workplace-type',false),application:{url:frameURL.href,frameId:frame.attrs.id,pageId:route[1],blockId:route[2],ctaId:applyBlock.attrs['data-call-to-action--form-uid-value']}}
}
const application=(html,row,proof)=>{
 const doc=visible(html),frame=one(doc.nodes(n=>n.tag==='turbo-frame'&&n.attrs.id===proof.frameId),'native application frame')
 const form=one(within(frame,n=>n.tag==='form'),'native application form'),action=new URL(form.attrs.action)
 check(form.attrs.method==='post'&&action.origin===ORIGIN&&!action.username&&!action.password&&action.pathname==='/call_to_actions/'+proof.ctaId+'/form_submissions'
  &&action.searchParams.get('job_id')===row.nativeId&&action.searchParams.get('page_id')===proof.pageId
  &&[...action.searchParams.keys()].sort().join(',')==='job_id,page_id'&&!action.hash,'native application role binding conflict')
 const fieldsets=within(form,n=>n.tag==='fieldset'&&Object.hasOwn(n.attrs,'disabled'))
 const inheritedDisabled=node=>fieldsets.some(fieldset=>{const legend=children(fieldset).find(n=>n.tag==='legend');return all(fieldset).includes(node)&&!(legend&&all(legend).includes(node))})
 const submits=within(form,n=>(n.tag==='button'&&(n.attrs.type||'submit')==='submit'||n.tag==='input'&&['submit','image'].includes(n.attrs.type))&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'&&!inheritedDisabled(n))
 const routing=['form','formaction','formmethod','formenctype','formtarget','formnovalidate']
 check(submits.every(node=>routing.every(key=>!Object.hasOwn(node.attrs,key))),'unreviewed native submit routing or method override')
 check(submits.length===1&&doc.text(submits[0]).includes('Submit your application'),'enabled native application submission control missing')
 // Native CSRF values and accessibility uniqueness markers are request-local.
 // Preserve the original packet; compare every public field/label below and
 // leave broader application-criteria qualification explicitly unresolved.
 const text=node=>node.inert||doc.hasClass(node,'ada-unique-content')?'':node.children.map(c=>typeof c==='string'?c:text(c)).join(' ')
 const fields=within(form,n=>['input','select','textarea','button','option'].includes(n.tag)&&n.attrs.name!=='authenticity_token').map(n=>({tag:n.tag,
  attrs:Object.fromEntries(['name','type','value','required','aria-required','disabled','readonly','multiple','pattern','min','max','step','maxlength','accept','form','formaction','formmethod','formenctype','formtarget','formnovalidate'].filter(k=>Object.hasOwn(n.attrs,k)).map(k=>[k,n.attrs[k]])),text:n.tag==='option'?doc.text(n):null}))
 return{action:action.href,method:form.attrs.method,submission:{action:action.href,method:form.attrs.method,submitter:submits[0].tag,inheritedDisabled:false},fields,text:norm(text(form)),rawBody:html}
}

const jobsFromFacts=(facts,clock,{partial=false}={})=>facts.map(({row,proof,application:app,applicationFailure,applicationVisited=false,roleClosingReconciled})=>({source:'waymo',company:'Waymo',jobId:new URL(row.url).pathname.split('/').at(-1),nativeJobId:row.nativeId,
 title:row.title,sourceUrl:row.url,applyUrl:row.url,link:row.url,requisitionId:proof.requisitionId,
 country:'India',city:normalizeCity(proof.address.addressLocality)||proof.address.addressLocality,location:[proof.address.addressLocality,proof.address.addressRegion,'India'].join(', '),
 department:row.department,employmentType:row.employmentType,experienceRequired:row.experienceRequired,
 jobDescription:proof.description,sourceDescription:proof.description,sourceDetailComplete:!partial,sourceDetailStatus:partial?'partial':'complete',sourceDetailFailureKind:partial?'waymo-native-reconciliation-incomplete':null,
 postingDate:proof.posted.iso,postedAt:proof.posted.iso,closingDate:proof.closing.iso,sourcePostedDateRaw:proof.posted.raw,sourceClosingDateRaw:proof.closing.raw,
 sourceDatePrecision:proof.posted.precision,sourceClosingDatePrecision:proof.closing.precision,originalPublicationDateQualified:true,
 nativeJobPosting:proof.posting,nativeCountryAddresses:[proof.address],nativeVisibleLocation:row.location,nativeWorkplace:proof.workplace,
 nativeSourceRecord:{nativeListing:row,nativeJobPosting:proof.posting},nativeHiringOrganization:proof.posting.hiringOrganization,
 nativeRoleClosingReconciled:roleClosingReconciled===true,
 activeApplyVerified:!partial&&Boolean(app)&&!applicationFailure,applicationAccessValidated:Boolean(app),applicationCriteriaQualified:false,nativeApplicationEvidence:app,nativeApplicationFailure:applicationFailure,
 applicationVisited:applicationVisited||Boolean(app)||Boolean(applicationFailure),applicationReadOnly:true,firstEverPublication:null,
 sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}))

export const runWaymoNative=async({read,searchUrl,now,signal,onEvidence,maxJobs=null})=>{
 const retained=[],facts=[];let surface=searchUrl
 let opening=null,closing=null,employerQualified=false
 const clock=new Date(typeof now==='function'?now():now).toISOString()
 const emit=()=>onEvidence?.({partialNativeJobs:jobsFromFacts(facts,clock,{partial:true}),firstParty:employerQualified,verifiedAt:clock,nativeCollectionEvidence:{targetCountry:'IN',openingIndiaCount:opening?.count??null,closingIndiaCount:closing?.count??null,openingRows:opening?.rows??null,closingRows:closing?.rows??null,retainedResponses:retained,worldwideInventoryComplete:false,applicationCriteriaQualified:false}})
 const get=async(url,init={})=>{signal?.throwIfAborted();surface=url;const body=await read(url,{...init,signal});signal?.throwIfAborted();check(typeof body==='string'&&Buffer.byteLength(body)<=4000000,'missing/oversized native document');retained.push({url,body});emit();return body}
 const failed=cause=>annotateFailure(cause,{partialNativeJobs:jobsFromFacts(facts,clock,{partial:true}),failureKind:errorValue(cause,'failureKind')||'incomplete_listing',source:'waymo',retainedNativeResponses:retained,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:employerQualified,listingComplete:false,pagesFetched:retained.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:employerQualified?clock:null,reason:typeof errorValue(cause,'message')==='string'?errorValue(cause,'message'):'Waymo native collection incomplete'})})

 const reconcileRole=async fact=>{
  const end=detail(await get(fact.row.url),fact.row,clock)
  check(json(fact.proof)===json(end),'opening/closing native role criteria changed')
  fact.roleClosingReconciled=true;emit()
  if(fact.application)try{
   const current=application(await get(end.application.url,{headers:{'Turbo-Frame':end.application.frameId}}),fact.row,end.application)
   const comparable=({rawBody,...proof})=>proof
   check(json(comparable(fact.application))===json(comparable(current)),'opening/closing native application criteria changed')
  }catch(error){
   if(sourceInterruption(error)){
    fact.applicationFailure={status:error.status,requestUrl:end.application.url,reason:error.message}
   }
   throw error
  }
 }
 try{
  opening=listing(await get(searchUrl));emit();employer(await get(EMPLOYER_URL));employerQualified=true;emit()
  for(const row of opening.rows){if(maxJobs!==null&&facts.length>=maxJobs)throw Object.assign(Error('Waymo job budget exhausted'),{code:'WAYMO_JOB_BUDGET',abortRetries:true});const proof=detail(await get(row.url),row,clock);facts.push({row,proof,application:null,applicationFailure:null,applicationVisited:false});emit()
   try{const fact=facts.at(-1);const html=await get(proof.application.url,{headers:{'Turbo-Frame':proof.application.frameId},onAdmitted:()=>{fact.applicationVisited=true;emit()}});facts.at(-1).application=application(html,row,proof.application);emit()}
   catch(error){if(sourceInterruption(error))facts.at(-1).applicationFailure={status:error.status,requestUrl:error.requestUrl||proof.application.url,reason:error.message};throw error}
  }
  closing=listing(await get(searchUrl));check(json(opening)===json(closing),'opening/closing native inventory changed')
  employer(await get(EMPLOYER_URL))
  for(const fact of facts)await reconcileRole(fact)
  const jobs=jobsFromFacts(facts,clock)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{targetCountry:'IN',openingIndiaCount:opening.count,closingIndiaCount:closing.count,
   openingRows:opening.rows,closingRows:closing.rows,retainedResponses:retained,worldwideInventoryComplete:false,applicationCriteriaQualified:false}})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:searchUrl,firstParty:true,listingComplete:false,pagesFetched:retained.length,
   reportedTotal:null,indiaFacetCount:opening.count,verifiedAt:clock,
   reason:'Official employer handoff, selected India filter, opening/closing cards and full native role criteria reconciled. Worldwide inventory and full application criteria remain unqualified; '+jobs.filter(j=>!j.applicationAccessValidated).length+' application frames unavailable.'})
 }catch(error){emit();signal?.throwIfAborted();
  if(sourceInterruption(error)&&error.code!=='WAYMO_NATIVE_PROOF'&&facts.length
   &&(error.requestUrl==null||error.requestUrl===surface)&&(error.finalUrl==null||error.finalUrl===surface)){
   const interruptedSurface=surface
   // An access interruption stops the whole source. Retain facts collected
   // before it without making recovery, closing or other-role requests.
   const complete=facts.filter(fact=>fact.roleClosingReconciled),qualified=complete.length>0
   const jobs=jobsFromFacts(qualified?complete:facts,clock,{partial:!qualified})
   const accepted=new Set(complete.map(fact=>fact.row.nativeId))
   const audit={targetCountry:'IN',openingIndiaCount:opening.count,closingIndiaCount:closing?.count??null,
    openingRows:opening.rows,closingRows:closing?.rows??null,retainedResponses:retained,worldwideInventoryComplete:false,applicationCriteriaQualified:false,
    openingClosingReconciled:Boolean(closing&&json(opening)===json(closing)),individuallyReconciledRoles:complete.length,
    heldNativeRows:opening.rows.filter(row=>!accepted.has(row.nativeId)),
    heldNativeFacts:jobsFromFacts(facts.filter(fact=>!accepted.has(fact.row.nativeId)),clock,{partial:true}),
    incompleteCollectionFailure:{status:error.status,requestUrl:error.requestUrl||interruptedSurface,reason:error.message}}
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
   if(jobs.length)jobs[0].sourceNativeCollectionAudit={...audit,retainedResponses:undefined}
   return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:searchUrl,firstParty:true,listingComplete:false,pagesFetched:retained.length,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:clock,
    reason:'HTTP '+error.status+' interrupted a later native read; individually reconciled earlier roles='+complete.length
     +'; unavailable/unreconciled advertised roles='+audit.heldNativeRows.length+'; company inventory and application criteria remain unqualified.'})
  }
  throw failed(error)}
}
