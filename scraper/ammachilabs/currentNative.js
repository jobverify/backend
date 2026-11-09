import {structure,hasClass,within,inner,htmlEscape,need,publicRead,stable} from '../alohatechnology/publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
const SOURCE='ammachilabs',COMPANY='Ammachi Labs',CAREERS='https://ammachilabs.org/careers/',API='https://ammachilabs.org/wp-json/wp/v2/jobs?per_page=100&page=1'
const one=(nodes,label)=>{need(nodes.length===1,COMPANY,'missing or ambiguous '+label);return nodes[0]}
const privateField=key=>/^position_(?:apply_now|inline_apply_now|button|pdf_export)(?:-|$)/.test(key)
const apiModel=record=>Object.fromEntries(Object.entries(record).filter(([key])=>['id','date','date_gmt','status','slug','link','title','content'].includes(key)||/^(?:sort-)?position_/.test(key)&&!privateField(key.replace(/^sort-/,''))))
function countryValueEvidence(raw){
 const values=[],reasons=[]
 const scalar=(value,path,depth=0)=>{
  if(depth>8){reasons.push('unsupported-native-country-identifier-depth');return}
  if(value==null||value==='')return
  if(Array.isArray(value)){for(const item of value)scalar(item,path,depth+1);return}
  if(typeof value==='object'){
   if(Object.hasOwn(value,'value'))scalar(value.value,path+'.value',depth+1)
   else reasons.push('unsupported-native-country-identifier-object')
   return
  }
  const country=nativeCountryName(value);values.push({path,raw:value,country});if(!country)reasons.push('unrecognized-native-country-identifier')
 }
 if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
  if(raw['@type']&&![raw['@type']].flat().includes('Country'))reasons.push('unsupported-native-country-object-type')
  for(const key of ['name','identifier','code','countryCode','isoCode','isoAlpha2','iso3166Alpha2','value','@id'])if(Object.hasOwn(raw,key))scalar(raw[key],key)
 }else scalar(raw,'addressCountry')
 const countries=[...new Set(values.map(v=>v.country).filter(Boolean))]
 if(countries.length>1)reasons.push('conflicting-native-country-name-and-identifiers')
 if(!countries.length)reasons.push('native-workplace-country-unpublished')
 return{rawCountry:raw??null,values,countries,qualified:countries.length===1&&reasons.length===0,country:countries.length===1&&reasons.length===0?countries[0]:null,reasons:[...new Set(reasons)]}
}
function workplaceAlternatives(jobLocation){
 if(jobLocation==null)return[]
 return[jobLocation].flat().flatMap((place,placeIndex)=>{
  const addresses=place&&typeof place==='object'&&place.address!=null?[place.address].flat():[null]
  return addresses.map((address,addressIndex)=>{
   const country=countryValueEvidence(address&&typeof address==='object'?address.addressCountry:null),shape=Boolean(place&&typeof place==='object'&&[place['@type']].flat().includes('Place')&&address&&typeof address==='object'&&!Array.isArray(address))
   return{placeIndex,addressIndex,rawPlace:place,rawAddress:address,countryFieldPresent:Boolean(address&&typeof address==='object'&&Object.hasOwn(address,'addressCountry')),countryEvidence:country,country:shape?country.country:null,countryQualified:shape&&country.qualified,reasons:[...country.reasons,...(!shape?['unsupported-native-workplace-shape']:[])]}
  })
 })
}
function archive(html,url,rootIsPageOne=false){
 const s=structure(html),links=s.visible(n=>n.tag==='a'&&n.attrs.href).map(n=>({node:n,href:new URL(n.attrs.href,url).href,text:s.text(n)}))
 const canonical=s.visible(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),canonicalRoot=canonical.length===1&&canonical[0].attrs.href===CAREERS
 const paginations=s.visible(n=>n.tag==='nav'&&hasClass(n,'pagination')&&n.attrs.role==='navigation'&&n.attrs['aria-label']==='Job listings pagination'),pagination=paginations.length===1?paginations[0]:null
 const current=pagination?within(pagination,n=>s.active(n)&&n.tag==='span'&&hasClass(n,'page-numbers')&&hasClass(n,'current')&&n.attrs['aria-current']==='page'):[]
 rootIsPageOne ||= url===CAREERS&&canonicalRoot&&current.length===1&&s.text(current[0])==='1'
 const firstPageAlias=rootIsPageOne&&canonicalRoot&&pagination&&links.some(n=>n.href===CAREERS+'page/1/'&&n.text==='1'&&hasClass(n.node,'page-numbers')&&within(pagination,p=>p===n.node).length===1)
 need(/AMMACHI\s*LABS/i.test(s.text(s.root))&&/CAREERS/i.test(s.text(s.root)),COMPANY,'public archive employer identity changed')
 const jobs=links.filter(n=>/^https:\/\/ammachilabs\.org\/job\/[^/]+\/$/.test(n.href)&&/CLICK HERE/i.test(n.text)).map(n=>n.href)
 const pages=links.filter(n=>/^https:\/\/ammachilabs\.org\/careers\/(?:page\/\d+\/)?$/.test(n.href)&&/^(?:\d+|»|«|Next|Previous)$/i.test(n.text)).map(n=>firstPageAlias&&n.href===CAREERS+'page/1/'?CAREERS:n.href)
 need(jobs.length>0&&new Set(jobs).size===jobs.length,COMPANY,'missing or duplicate native archive role links')
 return{jobs,pages:[...new Set(pages)],rootIsPageOne}
}
function detail(html,record){
 const s=structure(html),post=one(s.visible(n=>hasClass(n,'job-post')),'public job detail'),title=s.text(one(within(post,n=>hasClass(n,'position_title')&&hasClass(n,'jobs-row')),'native title row'))
 const nativeTitle=record.position_title||record.title?.rendered
 need(title.endsWith(s.text(structure('<p>'+nativeTitle+'</p>').root)),COMPANY,'native API/detail title identity changed')
 need(s.visible(n=>n.tag==='link'&&n.attrs.type==='application/json'&&n.attrs.href==='https://ammachilabs.org/wp-json/wp/v2/jobs/'+record.id).length===1,COMPANY,'native posting ID/detail alternate identity changed')
 const schemas=s.scripts.filter(n=>n.attrs.type==='application/ld+json').flatMap(n=>{try{return[JSON.parse(n.body)]}catch{return[]}}).filter(n=>n['@type']==='JobPosting')
 const nativeEmployerName=record.position_hiring_organization_name||COMPANY
 need(schemas.length===1&&schemas[0].title===nativeTitle&&schemas[0].hiringOrganization?.name===nativeEmployerName,COMPANY,'native structured employer/title identity changed')
 const employerScopeQualified=/^Ammachi Labs(?:\s*-\s*.+)?$/i.test(nativeEmployerName)
 const nativeWorkplaceAlternatives=workplaceAlternatives(schemas[0].jobLocation),nativeCountries=nativeWorkplaceAlternatives.filter(p=>p.countryQualified).map(p=>p.country)
 const rows=within(post,n=>hasClass(n,'jobs-row')).map(n=>{
  const field=(n.attrs.class||'').split(/\s+/).find(c=>/^position_/.test(c))
  return{node:n,field}
 }).filter(r=>r.field&&!privateField(r.field))
 const fields=rows.filter(r=>s.active(r.node)).map(({node,field})=>{
  const input=one(within(node,n=>hasClass(n,'jobs-row-input')),'public '+field+' body'),label=within(node,n=>hasClass(n,'jobs-row-label'))[0]
  return{field,label:label?s.text(label):null,text:s.text(input),html:inner(input)}
 })
 for(const field of fields.filter(f=>f.field==='position_job_location'&&f.text)){const country=nativeLocationCountryName(field.text);if(country)nativeCountries.push(country)}
 const unresolvedWorkplaces=nativeWorkplaceAlternatives.some(p=>!p.countryQualified),multipleCountries=new Set(nativeCountries).size>1
 need(fields.some(f=>['position_description','position_responsibilities','position_qualifications'].includes(f.field)&&f.text),COMPANY,'native full role criteria missing')
 const metadataFields=new Set(['position_title','position_hiring_organization','position_employment_type','position_job_location','position_date_posted','position_valid_through'])
 const criteria=fields.filter(f=>f.text&&!metadataFields.has(f.field)),jobDescription=criteria.map(f=>(f.label?'<h3>'+htmlEscape(f.label)+'</h3>':'')+f.html).join('\n')
 const publicDate=schemas[0].datePosted,apiDate=record.date_gmt?record.date_gmt+'Z':record.date
 need(typeof publicDate==='string'&&Number.isFinite(Date.parse(publicDate))&&Date.parse(publicDate)===Date.parse(apiDate),COMPANY,'original native job publication date conflict')
 // WordPress's default identifier repeats the employer name. It is not a
 // formal requisition; the published post ID is retained only as jobId.
 return{nativePostId:String(record.id),nativeTitle,nativeEmployerName,employerScopeQualified,nativeCountries:[...new Set(nativeCountries)],nativeWorkplaceAlternatives,countryEvidenceQualified:!unresolvedWorkplaces&&!multipleCountries&&nativeCountries.length>0,nativeCountryGapReasons:[...new Set([...nativeWorkplaceAlternatives.flatMap(p=>p.reasons),...(multipleCountries?['multiple-native-workplace-countries-require-reviewed-selection']:[])])],fields,jobDescription,originalCriteriaText:criteria.map(f=>[f.label,f.text].filter(Boolean).join(' ')).join('\n'),postingDate:new Date(publicDate).toISOString(),schemaModel:Object.fromEntries(Object.entries(schemas[0]).filter(([key])=>!['image','logo','interactionStatistic'].includes(key)))}
}
export async function runCurrentAmmachi(options,mapRecords){return publicRead({source:SOURCE,company:COMPANY},options,async({read,stamp,audit,publicPages})=>{
 const verifiedAt=stamp(),cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,COMPANY,'invalid caller cap')
 const snapshot=async phase=>{
  const firstHtml=await read(CAREERS,{phase}),initial=archive(firstHtml,CAREERS),pages=new Map([[CAREERS,initial]]),pending=[...initial.pages]
  const seen=new Set([CAREERS])
  while(pending.length){const url=pending.shift();if(seen.has(url))continue;seen.add(url);need(pages.size<100,COMPANY,'unbounded public archive continuation');const page=archive(await read(url,{phase,allowedFinalUrls:url===CAREERS+'page/1/'?[url,CAREERS]:[url]}),url,initial.rootIsPageOne)
   if(url===CAREERS+'page/1/'){need(stable(page.jobs)===stable(initial.jobs),COMPANY,'published first-page alias changes native inventory');continue}
   pages.set(url,page);pending.push(...page.pages.filter(u=>!seen.has(u)))
  }
  const archiveLinks=[...pages.values()].flatMap(p=>p.jobs);need(new Set(archiveLinks).size===archiveLinks.length,COMPANY,'duplicate public archive posting URL')
  const body=await read(API,{kind:'json',phase});let records;try{records=JSON.parse(body)}catch{need(false,COMPANY,'invalid native jobs JSON')}
  need(Array.isArray(records),COMPANY,'native jobs array missing or error envelope')
  const headers=publicPages.at(-1).publicHeaders,total=headers['x-wp-total'],pageCount=headers['x-wp-totalpages']
  need(![...(headers.link||'').matchAll(/\brel\s*=\s*"([^"]+)"/gi)].some(m=>m[1].split(/\s+/).includes('next')),COMPANY,'native REST continuation contradicts terminal pagination')
  need(/^\d+$/.test(total||'')&&/^\d+$/.test(pageCount||'')&&Number(pageCount)===Math.ceil(Number(total)/100)&&Number(pageCount)===1,COMPANY,'native API total/pagination metadata missing or unsupported')
  need(records.length===Number(total)&&records.length===archiveLinks.length&&new Set(records.map(r=>r.id)).size===records.length,COMPANY,'native total/cardinality and public archive inventory mismatch')
  for(const record of records)need(Number.isSafeInteger(record.id)&&record.id>0&&record.status==='publish'&&archiveLinks.includes(record.link),COMPANY,'native publish state, posting identity or archive membership conflict')
  const details=[];for(const record of records)details.push(detail(await read(record.link,{phase}),record))
  return{records,details,archivePages:[...pages.keys()].sort(),archiveLinks:archiveLinks.sort(),stableModels:records.map(apiModel),declaredApiTotal:Number(total)}
 }
 const first=await snapshot('initial'),closing=await snapshot('closing')
 need(stable({pages:first.archivePages,links:first.archiveLinks,models:first.stableModels,details:first.details})===stable({pages:closing.archivePages,links:closing.archiveLinks,models:closing.stableModels,details:closing.details}),COMPANY,'closing native cohort, criteria, fields or public metadata changed')
 const mapped=mapRecords(first.records),byId=new Map(first.details.map(d=>[d.nativePostId,d])),jobs=mapped.map(row=>{const d=byId.get(row.jobId);return{...row,source:SOURCE,link:row.sourceUrl,requisitionId:null,jobDescription:d.jobDescription,postingDate:d.postingDate,closingDate:null,sourceDetailComplete:true,fullNativeCriteriaAvailable:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:verifiedAt,nativeRoleDescriptionSections:d.fields,nativeOriginalCriteriaText:d.originalCriteriaText,nativeLocationEvidence:{positionJobLocation:first.records.find(r=>String(r.id)===row.jobId).position_job_location,countryQualified:Boolean(row.country),reason:row.country?'explicit-native-role-country':'native-job-owned-country-unpublished'},nativeRoleIdentity:{wordPressPostId:row.jobId,formalRequisitionId:null,structuredIdentifierIsOrganizationDefault:true}}})
 for(const job of jobs){
  const d=byId.get(job.jobId),record=first.records.find(r=>String(r.id)===job.jobId)
  job.nativeLocationEvidence.apiCountry=job.country
  const unresolved=d.nativeWorkplaceAlternatives.some(p=>!p.countryQualified)||d.nativeCountries.length>1
  if(unresolved)job.country=null
  else{need(!job.country||!d.nativeCountries.length||d.nativeCountries[0]===job.country,COMPANY,'native API/detail country conflict');if(!job.country&&d.nativeCountries.length)job.country=d.nativeCountries[0]}
  Object.assign(job.nativeLocationEvidence,{positionJobLocationComponents:Object.fromEntries(['streetAddress','addressLocality','addressRegion','postalCode','addressCountry','remote'].map(key=>[key,record['position_job_location_'+key]??null])),countryQualified:Boolean(job.country),reason:unresolved?'native-workplace-alternatives-unresolved-or-conflicting':job.country?'explicit-native-job-owned-country':'native-job-owned-country-unpublished',detailJobOwnedCountries:d.nativeCountries,detailWorkplaceAlternatives:d.nativeWorkplaceAlternatives,countryGapReasons:d.nativeCountryGapReasons})
  job.nativeRoleIdentity.employerScopeQualified=d.employerScopeQualified;job.nativeEmployerName=d.nativeEmployerName;if(!d.employerScopeQualified)job.company=d.nativeEmployerName
 }
 const scopeGapRecords=jobs.filter(j=>!j.nativeRoleIdentity.employerScopeQualified),qualified=jobs.filter(j=>j.nativeRoleIdentity.employerScopeQualified)
 const evidence={status:'coverage-gap',surface:CAREERS,firstParty:publicPages.every(p=>p.status===200&&p.responseIdentity==='validated-public-response'),listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'full-public-native-archive-and-criteria-reconciled;native-role-work-countries-and-broader-company-scope-unknown'+(scopeGapRecords.length?';native-employer-outside-configured-lab-held-with-full-evidence':'')}
 await audit({verifiedAt,observations:jobs,scopeGapRecords,nativeArchivePagesEnumerated:first.archivePages.length,nativeApiTotal:first.declaredApiTotal,nativeApiAndArchiveCohortMatched:true,fullNativeRoleDetails:first.details,closingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,unknownCountryRecords:jobs.filter(j=>!j.country).length,inventoryEvidence:evidence})
 const selected=attachInventoryEvidence(qualified.slice(0,cap),evidence)
 return attachSourceObservationEvidence(selected,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:jobs.length,observedVacancyCount:jobs.length,sourceScopeComplete:false})
})}
