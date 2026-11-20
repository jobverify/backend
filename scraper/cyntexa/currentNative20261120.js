import {isDeepStrictEqual} from 'node:util'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader} from './currentRead20261120.js'
import {page,one,need,failure,norm,cls,enabled,ownURL,countries,fieldsFacts,scopeFacts,projectedDate,authoredModelFacts,markupFacts} from './currentFacts20261120.js'

export const SOURCE='cyntexa',COMPANY='Cyntexa',CAREERS='https://cyntexa.com/careers/'
const ORIGIN='https://cyntexa.com',EMPLOYERS=['Cyntexa'],schemaType=value=>[value].flat().some(v=>['JobPosting','https://schema.org/JobPosting','http://schema.org/JobPosting'].includes(v))
const pure=fn=>{try{return fn()}catch(error){if(error?.failureKind==='parser_or_contract_error')throw error;throw Object.assign(failure('malformed complete200 own Cyntexa model: '+error.message),{cause:error})}}
const own=(value,base=CAREERS)=>ownURL(value,base,ORIGIN)
const context=value=>typeof value==='string'&&/^https?:\/\/schema\.org\/?$/.test(value)
const rowIdentity=row=>({title:row.title,url:row.url})
const scopesDates=values=>{const out={publications:[],expiries:[]};for(const value of values)for(const key of Object.keys(out))out[key].push(...value[key]);for(const list of Object.values(out))list.sort((a,b)=>(a.iso??a.calendarDate).localeCompare(b.iso??b.calendarDate));return out}
const brand=d=>{const values=d.models.flatMap(v=>v?.['@graph']??[v]);need(values.some(v=>[v?.['@type']].flat().includes('Organization')&&v.name===COMPANY&&own(v.url).href===ORIGIN+'/'),'current own Cyntexa publisher absent');return{brand:COMPANY,origin:ORIGIN,legalEmployerClaimed:false}}
function roleURL(href){const u=own(href);need(/^\/careers\/[^/]+\/$/.test(u.pathname)&&!u.search,'own published role URL changed');return u.href}
function appURL(href,id,role){const u=own(href,role);need(u.pathname==='/apply-at-cyntexa/'&&u.searchParams.size===1&&u.searchParams.get('id')===id,'same-role native application ID/path changed');return u.href}
const rowFields=(row,at,allowedCountries=['India'])=>{const dates={publications:[],expiries:[]};for(const attrs of[row.publicationOwnerAttributes,row.attrs,row.titleAttrs,...row.anchors.map(a=>a.attrs)]){need(!Object.hasOwn(attrs,'disabled')&&attrs['aria-disabled']!=='true','actual native listing carrier disabled');fieldsFacts(attrs,{employers:EMPLOYERS,at,dates,allowedCountries})}return scopesDates([dates,markupFacts(row.nativeRowDOMHTML,{employers:EMPLOYERS,at,allowedCountries}).dates])}

export function readCurrentListing(html){return pure(()=>{
 const d=page(html,CAREERS),publisher=brand(d),section=one(d.nodes(n=>n.tag==='section'&&cls(n,'job-opportunities')),'current Job Opportunities section'),cards=d.nodes(n=>n.tag==='div'&&cls(n,'job'),section)
 need(cards.length<=60,'current native role count exceeds bounded source reader')
 const rows=cards.map(card=>{
  need(enabled(card),'native published card disabled')
  const head=one(d.nodes(n=>n.tag==='h3'&&cls(n,'job-title'),card),'native card title'),title=norm(d.text(head)),anchors=d.nodes(n=>n.tag==='a'&&n.attrs.href,card)
  need(title&&anchors.length>0&&anchors.length<=4&&(!head.attrs['data-title']||norm(head.attrs['data-title'])===title),'native title identity missing/ambiguous')
  const urls=anchors.map(a=>{need(enabled(a)&&norm(d.text(a))===title,'native card link/title identity differs');return roleURL(a.attrs.href)})
  const url=one([...new Set(urls)],'native same-role card links'),locations=d.nodes(n=>cls(n,'location'),card).map(d.text)
  need(locations.length>0&&locations.length<=8&&locations.every(v=>v.trim()),'native card workplace unavailable')
  return{url,title,locations,attrs:card.attrs,publicationOwnerAttributes:section.attrs,titleAttrs:head.attrs,anchors:anchors.map(a=>({attrs:a.attrs,text:d.text(a)})),nativeDepartment:card.attrs['data-department']??null,nativeRowDOMHTML:d.outer(card),nativeDOMProjection:true}
 })
 need(new Set(rows.map(r=>r.url)).size===rows.length,'duplicate native role URL makes closing bindings ambiguous')
 return{publisher,rows,nativeSectionAttributes:section.attrs,companyTotalClaimed:false,sourceScopeComplete:false}
})}

function currentSchema(d){
 const found=[]
 for(const n of d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){
  const syntax=readLiteralModel(n.raw,{rawControls:true}),walk=(value,inherited,depth=0)=>{
   need(depth<=32,'native schema graph bound');if(Array.isArray(value)){for(const v of value)walk(v,inherited,depth+1);return}if(!value||typeof value!=='object')return
   const ctx=value['@context']??inherited
   if(schemaType(value['@type'])){need(context(ctx),'foreign/unknown JobPosting schema context');found.push({model:value,raw:n.raw,syntax:{validJSON:syntax.validJSON,rawControlCharacters:syntax.rawControlCharacters}})}
   if(value['@graph'])walk(value['@graph'],ctx,depth+1)
  };walk(syntax.value,undefined)
 }
 return one(found,'current own JobPosting')
}
function geography(model){
 const raw=[model.jobLocation].flat();need(raw.length>0&&raw.length<=32,'typed current workplace absent')
 const places=raw.map(place=>{const address=place?.address,country=countryName(typeof address?.addressCountry==='object'?address.addressCountry.name:address?.addressCountry);need(address&&country,'typed workplace country unknown');for(const name of['addressLocality','addressRegion','streetAddress','name'])need(address[name]==null||typeof address[name]==='string','native workplace field shape changed');for(const text of[place.name,place.description,address.name,address.addressLocality,address.addressRegion,address.streetAddress].filter(v=>v!=null&&v!==''))need(typeof text==='string'&&countries(text).every(c=>c===country),'whole typed workplace contradicts its country');return{country,city:address.addressLocality??null,state:address.addressRegion??null,raw:place}})
 const names=[...new Set(places.map(p=>p.country))];need(names.includes('India'),'no typed India workplace alternative')
 for(const key of['applicantLocationRequirements','eligibleRegion'])if(model[key]!=null){const values=[model[key]].flat();need(values.length>0&&values.length<=32&&values.every(v=>countryName(typeof v==='string'?v:v?.name??v?.addressCountry))&&values.some(v=>countryName(typeof v==='string'?v:v?.name??v?.addressCountry)==='India'),'native applicant eligibility excludes India or is unknown')}
 return{countries:names,places}
}
function validateLabels(labels,geo){for(const raw of labels){need(typeof raw==='string'&&norm(raw),'native visible workplace unavailable');const explicit=countries(raw);need(explicit.every(c=>geo.countries.includes(c)),'native whole visible workplace contradicts typed country');if(!explicit.length&&!/^(?:remote|hybrid|on[- ]site|onsite)(?:\s*[,/]\s*(?:remote|hybrid|on[- ]site|onsite))*$/i.test(norm(raw)))need(geo.places.some(p=>p.city&&norm(raw).toLowerCase().includes(norm(p.city).toLowerCase())),'native visible city does not bind to a typed workplace')}}
function actualAncestors(d,nodes){const walk=(node,path=[])=>{if(nodes.includes(node))need([...path,node].every(enabled),'actual application has disabled/inactive ancestor');for(const child of node.children??[])if(typeof child!=='string')walk(child,[...path,node])};walk(d.root)}
const criteriaKey=key=>/description|qualification|requirements|responsibilit|skills|education|experience|dateposted|validthrough|postingdate|closingdate|applicationdeadline|expirydate|expirationdate|publishedat|expires/i.test(key)

export function readCurrentRole(html,row,at){return pure(()=>{
 const d=page(html,row.url),publisher=brand(d),record=currentSchema(d),m=record.model,main=one(d.nodes(n=>n.tag==='main'),'own role main'),children=main.children.filter(n=>typeof n!=='string'),other=children.findIndex(n=>cls(n,'other-opportunities')),owners=(other<0?children:children.slice(0,other)).filter(n=>!cls(n,'breadcrumb-header'))
 const hero=one(owners.filter(n=>cls(n,'hero-section')),'actual role hero'),title=one(d.nodes(n=>n.tag==='h1',hero),'own title header')
 need(norm(d.text(title))===row.title&&norm(m.title)===row.title,'native listing/actual title/schema title differs')
 need(m.hiringOrganization?.name===COMPANY,'native exact hiring brand differs')
 need(!/\(S2 Labs\)/i.test(row.title),'explicit separate S2 Labs role scope unresolved')
 for(const key of['url','sameAs'])if(m.hiringOrganization[key]!=null){const u=new URL(m.hiringOrganization[key]);need(u.protocol==='https:'&&['cyntexa.com','www.cyntexa.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.hash&&!u.search&&['/','/careers','/careers/'].includes(u.pathname),'native employer organization URL differs')}
 for(const value of[m.url,typeof m.mainEntityOfPage==='string'?m.mainEntityOfPage:m.mainEntityOfPage?.['@id']].filter(v=>v!=null))need(own(value,row.url).href===row.url,'schema source role URL differs')
 const id=m.identifier?.value;need(m.identifier?.name===COMPANY&&typeof id==='string'&&/^\d{8,32}$/.test(id),'native public role identifier unavailable')
 const geo=geography(m),dates=[rowFields(row,at,geo.countries),fieldsFacts(main.attrs,{employers:EMPLOYERS,at,allowedCountries:geo.countries}),fieldsFacts(m,{employers:EMPLOYERS,at,allowedCountries:geo.countries})]
 dates.push(...authoredModelFacts(m,{employers:EMPLOYERS,at,allowedCountries:geo.countries}))
 const labels=d.nodes(n=>cls(n,'job-location'),hero).map(d.text);need(labels.length>0,'actual own role workplace missing');validateLabels([...row.locations,...labels],geo)
 for(const owner of owners){need(enabled(owner),'actual own role scope disabled');dates.push(scopeFacts(d,owner,{employers:EMPLOYERS,at,allowedCountries:geo.countries}).dates)}
 const apps=owners.flatMap(owner=>d.nodes(n=>n.tag==='a'&&/^Apply Now$/i.test(norm(d.text(n))),owner));need(apps.length>0&&apps.length<=8,'native actual application controls unavailable');actualAncestors(d,apps)
 const application=one([...new Set(apps.map(n=>appURL(n.attrs.href,id,row.url)))],'current same-role application'),applicationAttrs=apps.map(n=>n.attrs)
 for(const attrs of applicationAttrs)dates.push(fieldsFacts(attrs,{employers:EMPLOYERS,at,allowedCountries:geo.countries}))
 for(const[key,value]of Object.entries(m))if(/^(?:applyurl|applicationurl|applicationlink|applylink)$/i.test(key.replace(/[-_]/g,''))&&value!=null)need(appURL(value,id,row.url)===application,'schema application URL differs')
 const ownRole=owners.map(n=>({attrs:n.attrs,html:d.outer(n),text:d.text(n)})),criteria=owners.filter(n=>!cls(n,'hero-section')&&!cls(n,'are-you-interested')&&!cls(n,'benefits-section')).map(n=>({attrs:n.attrs,html:d.outer(n),text:d.text(n)}))
 const allDates=scopesDates(dates),india=geo.places.filter(p=>p.country==='India'),description=criteria.map(v=>v.text).join('\n')||null
 return{source:SOURCE,company:COMPANY,jobId:SOURCE+'-'+id,requisitionId:null,nativePublicJobId:id,nativeIdentifier:m.identifier,title:row.title,sourceUrl:row.url,applyUrl:application,link:application,country:'India',city:india.length===1?india[0].city:null,state:india.length===1?india[0].state:null,location:india.map(p=>[p.city,p.state,p.country].filter(Boolean).join(', ')).join(' / '),nativeEmployerDisplayName:m.hiringOrganization.name,sourceLegalEmployer:null,sourceNativePublisher:publisher,sourceNativeGeography:geo,sourceNativeVisibleWorkplaces:labels,sourceNativeListingRecord:row,sourceNativeRecord:m,sourceNativeSchema:record,sourceNativeRole:ownRole,sourceNativeCriteria:{visible:criteria,schema:typeof m.description==='string'?m.description:null},sourceNativeUnknownModel:Object.fromEntries(Object.entries(m).filter(([key])=>!criteriaKey(key))),sourceNativeIdentity:{id,role:row.url,title:row.title,employer:m.hiringOrganization,geography:geo,application},sourceNativeApplicationControls:applicationAttrs,sourceNativeDates:allDates,postingDate:projectedDate(allDates.publications),closingDate:projectedDate(allDates.expiries),sourceDescription:description,jobDescription:description,sourceNativeDescription:m.description??null,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'current-own-native-role-partial;fullcompany-and-application-backend-unverified',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,sourceNativeRoleClosingQualified:false,scrapedAt:at,companyCareerPage:CAREERS,companyDomain:'cyntexa.com',atsPlatform:'official-company-careers'}
})}
function reconcile(opening,closing){need(isDeepStrictEqual(opening.sourceNativeIdentity,closing.sourceNativeIdentity),'closing native identity/employer/geography/application changed');need(isDeepStrictEqual(opening.sourceNativeUnknownModel,closing.sourceNativeUnknownModel),'closing non-criteria native model changed');const dates=scopesDates([opening.sourceNativeDates,closing.sourceNativeDates]);return{...opening,sourceNativeDates:dates,postingDate:projectedDate(dates.publications),closingDate:projectedDate(dates.expiries),sourceNativeRoleVersions:[{phase:'opening',schema:opening.sourceNativeSchema,role:opening.sourceNativeRole},{phase:'closing',schema:closing.sourceNativeSchema,role:closing.sourceNativeRole}],sourceNativeCriteriaAlternatives:[opening.sourceNativeCriteria,closing.sourceNativeCriteria],sourceCriteriaChangedDuringRead:!isDeepStrictEqual(opening.sourceNativeCriteria,closing.sourceNativeCriteria),sourceNativeRoleClosingQualified:true}}

export async function runCurrentNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original Response transport required')
 const at=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString(),cap=options.maxJobs??60;need(Number.isSafeInteger(cap)&&cap>=0&&cap<=1000&&Number.isFinite(Date.parse(at)),'native clock or caller cap invalid')
 const finish=(jobs,audit)=>{attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.openingNativeRecords?.length??0,observedVacancyCount:audit.openingNativeRecords?.length??0,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:audit.requests,verifiedAt:at,reason:'current-own-SSR-cards-and-independently-qualified-native-India-roles;company-scope-and-backend-unverified'});options.signal?.throwIfAborted();return jobs}
 if(cap===0||options.maxPages===0)return finish([],{source:SOURCE,requests:0,callerZeroCap:true,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false})
 const allowed=new Set([CAREERS]),io=createCurrentReader(options,url=>allowed.has(url)),responses=[],heldNativeRoles=[],optionalFailures=[]
 const read=async(url,phase)=>{const p=await io.read(url,{phase});responses.push({requestedUrl:url,method:'GET',url:p.url,status:p.status,headers:{'content-type':p.headers['content-type']},bytes:Buffer.from(p.bodyBase64,'base64').length,sha256:p.sha256,phase,fullOriginalRetainedByCaptureTransport:true});return p.text}
 try{
  const opening=readCurrentListing(await read(CAREERS,'opening-listing')),closing=readCurrentListing(await read(CAREERS,'closing-listing')),closed=new Map(closing.rows.map(r=>[r.url,r])),jobs=[]
  for(const row of opening.rows){if(jobs.length>=cap||io.isDenied(CAREERS))break;let observed=null;const last=closed.get(row.url)
   try{
    need(last&&isDeepStrictEqual(rowIdentity(row),rowIdentity(last)),'closing listing native identity/title absent or changed');allowed.add(row.url)
    observed=readCurrentRole(await read(row.url,'opening-role'),row,at);const closingRowDates=pure(()=>rowFields(last,at,observed.sourceNativeGeography.countries));validateLabels(last.locations,observed.sourceNativeGeography)
    const current=readCurrentRole(await read(last.url,'closing-role'),last,at),job=reconcile(observed,current);job.sourceNativeDates=scopesDates([job.sourceNativeDates,closingRowDates]);job.postingDate=projectedDate(job.sourceNativeDates.publications);job.closingDate=projectedDate(job.sourceNativeDates.expiries);job.sourceNativeIndexVersions=[row,last];job.sourceClosingReconciled=true;jobs.push(job)
   }catch(error){io.check();const status=error.httpStatus??error.nativeHttpStatus??null;optionalFailures.push({url:row.url,openingQualified:!!observed,httpStatus:status,reason:error.message});if(observed&&error.failureKind!=='parser_or_contract_error'&&![301,302,303,307,308,404,410].includes(status)){
     pure(()=>{validateLabels(last.locations,observed.sourceNativeGeography);observed.sourceNativeDates=scopesDates([observed.sourceNativeDates,rowFields(last,at,observed.sourceNativeGeography.countries)])});observed.postingDate=projectedDate(observed.sourceNativeDates.publications);observed.closingDate=projectedDate(observed.sourceNativeDates.expiries);observed.sourceOptionalClosingFailure={httpStatus:status,reason:error.message};observed.sourceNativeRoleVersions=[{phase:'opening',schema:observed.sourceNativeSchema,role:observed.sourceNativeRole}];observed.sourceNativeIndexVersions=[row,last];observed.sourceClosingReconciled=true;jobs.push(observed)
    }else heldNativeRoles.push({url:row.url,title:row.title,reason:error.message})
   }
  }
  const idCounts=new Map();for(const job of jobs)idCounts.set(job.nativePublicJobId,(idCounts.get(job.nativePublicJobId)??0)+1)
  const conflictedNativePublicIDs=[...idCounts].filter(([,count])=>count>1).map(([id])=>id),qualified=jobs.filter(job=>{if(!conflictedNativePublicIDs.includes(job.nativePublicJobId))return true;heldNativeRoles.push({url:job.sourceUrl,title:job.title,nativePublicJobId:job.nativePublicJobId,reason:'Conflicting distinct current own roles share one native public/application ID; every observed member of that ID remains held'});return false})
  const audit={source:SOURCE,recoveryKind:'valid-partial-current-own-native-records',openingNativeRecords:opening.rows,closingNativeRecords:closing.rows,openingPublisher:opening.publisher,closingPublisher:closing.publisher,originalResponses:responses,heldNativeRoles,conflictedNativePublicIDs,optionalFailures,returnedRows:qualified.length,fullCriteriaRecovered:false,fullCriteriaIndiaJobs:0,missingCriteriaJobs:qualified.length,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,...io.stats()};io.check();return finish(qualified,audit)
 }finally{io.close()}
}
