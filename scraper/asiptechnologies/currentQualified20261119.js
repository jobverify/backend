import{parse}from'acorn'
import{document}from'../../scraper-support/shared/rmkNativePairHtml.js'
import{readNativeDocument,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import{nativeCountryName,nativeLocationCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import{findExplicitNativeClosure}from'../../scraper-support/utils/sourceAvailability.js'
import{createBoundedPublicCareerTransport}from'../../scraper-support/utils/boundedPublicCareerTransport.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{readCurrentAsipListings}from'./currentNative.js'
const source='asiptechnologies',company='ASIP Technologies',origin='https://asip-tech.com',home=origin+'/careers/',ajax=origin+'/wp-admin/admin-ajax.php'
const norm=x=>String(x??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('ASIP qualified native: '+message),{abortRetries:true})}
const one=(rows,label)=>{need(rows.length===1,'unique '+label+' unavailable');return rows[0]}
async function observe(io,callback,value){
 let listener
 try{return await Promise.race([Promise.resolve().then(()=>callback(value)),new Promise((_,reject)=>{listener=()=>reject(io.signal.reason);io.signal.addEventListener('abort',listener,{once:true});if(io.signal.aborted)listener()})])}
 finally{if(listener)io.signal.removeEventListener('abort',listener)}
}
function date(value){
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)&&Number.isFinite(Date.parse(value)),'native date unavailable')
 const day=value.slice(0,10);need(new Date(day).toISOString().slice(0,10)===day,'native calendar date invalid');return value
}
function constraints(posting,html,observedAt){
 const now=new Date(observedAt);need(Number.isFinite(+now),'observation clock invalid')
 for(const key of['isActive','canApply','isPublished'])if(posting[key]!=null)need(posting[key]===true,'native availability conflict')
 for(const key of['isClosed','closed','isExpired','archived'])if(posting[key]!=null)need(posting[key]===false,'native role explicitly closed')
 for(const key of['status','jobStatus','postingStatus'])if(posting[key]!=null)need(/^(?:open|active|published)$/i.test(posting[key]),'native availability conflict')
 for(const key of['country','countryCode','workCountry'])if(posting[key]!=null)need(nativeCountryName(posting[key])==='India','explicit native country conflict')
 const expiry=[]
 for(const key of['validThrough','closingDate','applicationDeadline','dateExpires'])if(posting[key]!=null&&posting[key]!==''){
  const value=date(posting[key]);need(value.length===10?value>=now.toISOString().slice(0,10):Date.parse(value)>=+now,'native role expired');expiry.push({field:key,value})
 }
 for(const part of html){const d=readNativeDocument(part??''),blocks=d.nodes(n=>['p','li','h1','h2','h3','h4','strong','b'].includes(n.tag)).map(d.text)
  need(!findExplicitNativeClosure(blocks),'native role explicitly closed')
  for(const text of blocks){
   const c=/^(?:(?:work|job|workplace)\s+)?country\s*:\s*(.+)$/i.exec(text);if(c)need(nativeCountryName(c[1])==='India','native criteria country conflict')
   const l=/^(?:(?:work|job)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(text);if(l){const country=nativeLocationCountryName(l[1]);need(!country||country==='India','native criteria workplace conflict')}
   const e=/^(?:employer|legal employer|hiring organization|company(?: name)?)\s*:\s*(.+)$/i.exec(text);if(e)need(norm(e[1])===company,'native criteria employer conflict')
  }
 }
 return expiry
}
function formModel(doc,listing){
 const form=one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='awsm-application-form'),'native role application'),controls=[]
 need(form.attrs.method==='post'&&form.attrs.enctype==='multipart/form-data'&&(!form.attrs.action||new URL(form.attrs.action,listing.sourceUrl).href===listing.sourceUrl),'native application target changed')
 need(form.attrs['aria-disabled']!=='true'&&!Object.hasOwn(form.attrs,'disabled')&&!doc.nodes(n=>n.tag==='fieldset'&&Object.hasOwn(n.attrs,'disabled'),form).length,'native application disabled')
 const visit=n=>{if(typeof n==='string')return;if(['input','textarea','select','button','label'].includes(n.tag))controls.push({tag:n.tag,attrs:n.attrs,text:doc.text(n),raw:n.raw??null});n.children?.forEach(visit)};visit(form)
 const field=name=>one(controls.filter(n=>n.tag==='input'&&n.attrs.name===name),'application '+name).attrs.value
 need(controls.some(n=>(n.tag==='button'&&(!n.attrs.type||n.attrs.type==='submit')||n.tag==='input'&&n.attrs.type==='submit')&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'),'native application submit unavailable')
 need(field('awsm_job_id')===listing.jobId&&field('action')==='awsm_applicant_form_submission'&&field('_wp_http_referer')===new URL(listing.sourceUrl).pathname,'native application identity/action differs')
 for(const name of['awsm_applicant_name','awsm_applicant_email','awsm_applicant_phone','awsm_applicant_letter','awsm_file','awsm_form_privacy_policy'])need(controls.some(n=>n.attrs.name===name),'native application control unavailable: '+name)
 const config=one(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='awsm-job-scripts-js-extra'),'native role form protocol'),ast=parse(config.raw,{ecmaVersion:'latest'}),decl=ast.body[0]?.declarations?.[0]
 need(ast.body.length===1&&decl?.id?.name==='awsmJobsPublic'&&decl.init?.type==='ObjectExpression','native application protocol unqualified')
 const props=new Map(decl.init.properties.filter(p=>p.type==='Property'&&p.value.type==='Literal').map(p=>[p.key.name??p.key.value,p.value.value]))
 need(props.get('ajaxurl')===ajax&&props.get('job_id')===listing.jobId,'native application employer/role protocol differs')
 const comparisonControls=controls.map(n=>n.attrs.name==='awsm_nonce'?{...n,attrs:{...n.attrs,value:'[per-read-native-nonce]'}}:n)
 return{url:listing.sourceUrl,jobId:listing.jobId,method:'POST',nativeAjaxURL:ajax,nativeAction:'awsm_applicant_form_submission',nativeControls:controls,comparisonControls,originalHTML:doc.outer(form),originalProtocol:config.raw,activationVerified:false,submitted:false,nativeClientExecuted:false}
}
function visibilityUnreviewed(html){
 let found=false;const visit=n=>{if(typeof n==='string')return;const a=n.attrs??{};if(Object.hasOwn(a,'hidden')||Object.hasOwn(a,'inert')||a['aria-hidden']==='true'||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\b/i.test(a.style??''))found=true;n.children?.forEach(visit)};visit(document(html??'').root);return found
}
export function asipQualifiedDetail(html,listing,{observedAt=new Date().toISOString()}={}){
 const doc=document(html),canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical').attrs.href
 need(canonical===listing.sourceUrl,'native detail URL identity differs')
 const body=one(doc.nodes(n=>n.tag==='body'),'native body'),ids=(body.attrs.class||'').split(/\s+/).filter(x=>x.startsWith('postid-'))
 need(ids.length===1&&ids[0]==='postid-'+listing.jobId,'native post identity differs')
 const title=doc.text(one(doc.nodes(n=>n.tag==='h1'&&doc.hasClass(n,'awsm-jobs-single-title')),'native title'))
 const postings=[];const visit=x=>{if(!x||typeof x!=='object')return;if([x['@type']].flat().includes('JobPosting'))postings.push(x);if(x['@graph'])for(const r of x['@graph'])visit(r)}
 for(const script of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))visit(JSON.parse(script.raw))
 const posting=one(postings,'native JobPosting')
 need(title===listing.title&&norm(posting.title)===title&&posting.hiringOrganization?.name===company&&[origin,origin+'/'].includes(posting.hiringOrganization.sameAs),'native employer/title identity differs')
 const values={};for(const key of['job-location','job-category','job-type']){const wrap=one(doc.nodes(n=>doc.hasClass(n,'awsm-job-specification-'+key)),'native '+key);values[key]=doc.text(one(doc.nodes(n=>doc.hasClass(n,'awsm-job-specification-term'),wrap),'native '+key+' value'))}
 need(values['job-location']===listing.location&&values['job-category']===listing.department&&values['job-type']===listing.employmentType,'native listing/detail fields disagree')
 need(values['job-location']==='Hyderabad','exact whole native municipality unqualified')
 const place=posting.jobLocation,address=place?.address
 need(place?.['@type']==='Place'&&!Array.isArray(place)&&(address==='Hyderabad'||address&&typeof address==='object'&&address.addressLocality==='Hyderabad'&&nativeCountryName(address.addressCountry)==='India'),'native schema workplace/country conflict')
 // Hyderabad exists in India and Pakistan. Repeated municipality-only labels,
 // the employer's footer and the company's industry do not disambiguate a role.
 const country=address&&typeof address==='object'?nativeCountryName(address.addressCountry):['country','countryCode','workCountry'].some(k=>nativeCountryName(posting[k])==='India')?'India':null
 const content=doc.nodes(n=>doc.hasClass(n,'awsm-job-entry-content'));need(content.length<=1,'native criteria ambiguous')
 const raw=content.length?doc.inner(content[0]):null,schema=posting.description??null
 need(schema==null||typeof schema==='string','native authored criteria type unqualified')
 const roleScope=one(doc.nodes(n=>doc.hasClass(n,'awsm-job-main')),'native role/application availability scope'),expiry=constraints(posting,[raw,schema,doc.inner(roleScope)],observedAt),visibleText=extractActiveDescription(raw),schemaText=extractActiveDescription(schema),hiddenCriteria=visibilityUnreviewed(raw)||visibilityUnreviewed(schema),match=Boolean(visibleText&&schemaText&&norm(visibleText)===norm(schemaText)),complete=match&&!hiddenCriteria,application=formModel(doc,listing)
 const posted=posting.datePosted==null?null:date(posting.datePosted);need(!posted||Date.parse(posted)<=Date.parse(observedAt),'native publication date in future')
 return{...listing,company,nativeEmployer:company,nativeLegalEmployer:null,country,city:'Hyderabad',sourceCountryScopeUnresolved:country===null,
  sourceCountryEvidence:{kind:country?'explicit-same-role-native-country':'ambiguous-municipality-only-native-workplace',nativeLabel:'Hyderabad',nativeCountry:address?.addressCountry??null,reason:country?null:'Hyderabad string alone does not distinguish India from Pakistan; no footer/HQ inference'},
  sourceDescription:visibleText||schemaText||null,jobDescription:visibleText||schemaText||null,sourceNativeDescriptionHTML:raw,sourceNativeSchemaDescription:schema,sourceNativeJobPosting:posting,
  sourceNativeApplication:application,sourceDetailComplete:complete,sourceDetailStatus:complete?'complete':'partial',sourceDetailFailureKind:complete?null:'native-authored-criteria-missing-inconsistent-or-visibility-unreviewed',sourceCriteriaConflict:Boolean(visibleText&&schemaText&&!match),sourceCriteriaVisibilityUnreviewed:hiddenCriteria,
  sourceNativeDetailQualified:true,postingDate:posted,closingDate:expiry[0]?.value??null,sourceNativeDates:{datePosted:posting.datePosted??null,recognizedExpiryFields:expiry},
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceCompanyScopeUnresolved:false}
}
function fact(job){return{listing:job.sourceNativeListingHTML,posting:job.sourceNativeJobPosting,criteria:job.sourceNativeDescriptionHTML,application:{url:job.sourceNativeApplication.url,jobId:job.sourceNativeApplication.jobId,action:job.sourceNativeApplication.nativeAction,ajax:job.sourceNativeApplication.nativeAjaxURL,controls:job.sourceNativeApplication.comparisonControls}}}
export async function runAsipQualified(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'metadata-free callback transport unqualified')
 const transport=options.fetchImpl??globalThis.fetch,allowed=new Set([home]),raw=[],held=[],openingDetails=[],closingDetails=[]
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:(u,m)=>m==='GET'&&allowed.has(u),fetchImpl:async(u,init)=>{const r=await transport(u,init);need(r?.url===u&&Number.isInteger(r.status)&&r.headers?.get&&r.body,'native HTTP metadata unavailable');return r}})
 let count=0,total=0
 const read=async url=>{need(++count<=20,'native request cap exceeded');const html=await io.fetchText(url);total+=Buffer.byteLength(html);need(total<=8000000,'native aggregate byte cap exceeded');raw.push({url,originalHTML:html});return html}
 try{
  const opening=readCurrentAsipListings(await read(home));need(opening.length>0,'native inventory unavailable; zero not certified')
  for(const row of opening)allowed.add(row.sourceUrl)
  const byId=new Map()
  for(const row of opening){const html=await read(row.sourceUrl);try{const job=asipQualifiedDetail(html,row,{observedAt:(options.now||(()=>new Date().toISOString()))()});byId.set(row.jobId,job);openingDetails.push({id:row.jobId,fact:fact(job)})}catch(error){held.push({id:row.jobId,stage:'opening',reason:error.message,originalListing:row,originalHTML:html})}}
  const closing=readCurrentAsipListings(await read(home)),jobs=[],observations=[]
  for(const row of opening){const html=await read(row.sourceUrl),old=byId.get(row.jobId);if(!old)continue
   try{need(closing.some(r=>same(r,row)),'native closing listing changed');const current=asipQualifiedDetail(html,row,{observedAt:(options.now||(()=>new Date().toISOString()))()});closingDetails.push({id:row.jobId,fact:fact(current)});need(same(fact(old),fact(current)),'native closing full criteria/application changed');old.sourceClosingQualified=true;old.scrapedAt=(options.now||(()=>new Date().toISOString()))();observations.push(old);if(old.country==='India')jobs.push(old);else held.push({id:row.jobId,stage:'country',reason:'same-role Hyderabad country remains ambiguous; no role-level state/country binding',originalRecord:old})}catch(error){held.push({id:row.jobId,stage:'closing',reason:error.message,originalListing:row,originalHTML:html})}
  }
  const audit={source,openingRecords:opening,closingRecords:closing,openingDetails,closingDetails,observations,held,originalResponses:raw,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,backendActivationVerified:false,applicationSubmitted:false}
  const selected=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(selected,{source,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(selected,'nativeCollectionEvidence',{value:audit,configurable:true});if(options.onAudit)await observe(io,options.onAudit,structuredClone(audit));io.signal.throwIfAborted()
  return attachInventoryEvidence(selected,{status:'coverage-gap',surface:home,firstParty:true,pagesFetched:raw.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:(options.now||(()=>new Date().toISOString()))(),reason:'current-own-role-identity-and-native-application-qualified;ambiguous-Hyderabad-country-original-dates-company-inventory-and-backend-activation-held'})
 }finally{io.close()}
}
