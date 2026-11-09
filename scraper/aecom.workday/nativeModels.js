import {isDeepStrictEqual} from 'node:util'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {BOARD,ROLE_BASE,need} from './nativeDeclarations.js'
import {nativeSafeCount} from './nativeJSON.js'

const string=v=>typeof v==='string'&&v.trim().length>0
const int=v=>Number.isSafeInteger(v)&&v>=0
const allNodes=n=>typeof n==='string'?[]:[n,...n.children.flatMap(allNodes)]
const rendered=n=>typeof n==='string'?decodeNativeEntities(n):(['p','li','ul','ol'].includes(n.tag)?'\n':'')+n.children.map(rendered).join('')+(['p','li','ul','ol'].includes(n.tag)?'\n':'')
const common=['guid','id','reqid','buid','company_exact','country_ac','country_exact','country_short_exact','city_exact','location_exact','title_exact','title_slug','description','date_new','date_updated','job_type','job_category','job_function','other','is_posted','on_sites','onet_exact']
const timestamp=(value,label,now)=>{
 need(typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value)),'invalid '+label)
 need(Date.parse(value)<=now,'future '+label)
 return Date.parse(value)
}
export function readIndiaFacet(model){
 need(model?.meta?.source==='solr'&&model.meta.canonical==='/jobs/','global search identity differs')
 const matches=model.filters?.country?.filter(f=>f.display==='India')
 need(matches?.length===1&&matches[0].link==='/locations/ind/jobs'&&int(matches[0].value),'missing or ambiguous declared India facet')
 need(int(model.pagination?.total)&&model.pagination.total>=matches[0].value,'invalid global total')
 return{display:matches[0].display,link:matches[0].link,value:matches[0].value}
}
export function readIndiaPage(model,page,total){
 need(model?.meta?.source==='solr'&&model.meta.canonical==='/locations/ind/jobs/','India native listing identity differs')
 need(model.meta.filters?.length===1&&model.meta.filters[0].display==='IND'&&model.meta.filters[0].key==='locations','India native filter differs')
 need(Array.isArray(model.featured_jobs)&&model.featured_jobs.length===0,'unreviewed featured postings')
 const p=model.pagination,pages=Math.ceil(total/10)
 need(p&&p.total===total&&nativeSafeCount(p.page)===page&&p.page_size===10&&p.total_pages===pages&&p.offset===(page-1)*10&&p.has_more_pages===(page<pages),'invalid India pagination arithmetic')
 need(Array.isArray(model.jobs)&&model.jobs.length===Math.min(10,total-(page-1)*10),'duplicate or incomplete India page count')
 for(const j of model.jobs)validateListing(j)
 return model.jobs
}
export function validateListing(j){
 need(j&&typeof j==='object'&&/^[A-F0-9]{32}$/.test(j.guid)&&j.id==='seo.joblisting.'+j.guid&&string(j.reqid),'listing role identity differs')
 need(j.company_exact==='AECOM'&&[55872,38582].includes(j.buid),'listing employer identity differs')
 need(j.country_ac==='India'&&j.country_exact==='India'&&j.country_short_exact==='IND','listing own country differs')
 need(string(j.title_exact)&&string(j.title_slug)&&string(j.location_exact)&&string(j.description),'incomplete native listing')
 need(string(j.city_exact)&&isDeepStrictEqual(j.all_locations,[j.city_exact,j.city_exact+', ','India']),'listing worksite aliases conflict or are unsupported')
 need(j.country_slab_exact==='ind/jobs::India','listing typed country slab differs')
 need(j.company_buid_slab==='AECOM::'+j.buid&&j.company_buid_slab_exact==='AECOM::'+j.buid&&j.company_slab_exact==='aecom/careers::AECOM','listing typed employer slabs differ')
 need(!Object.hasOwn(j,'deleted_at'),'listing expiry flag')
}
export function readRole(model,listing,now){
 validateListing(listing)
 need(model&&typeof model==='object'&&model.guid===listing.guid&&model.id===listing.id&&model.reqid===listing.reqid,'role GUID or requisition differs')
 for(const key of common){
  // Solr omits empty job_function; the own JSON explicitly retains "".
  if(key==='job_function'&&!Object.hasOwn(listing,key)&&model[key]==='')continue
  need(isDeepStrictEqual(model[key],listing[key]),'role '+key+' differs from own listing')
 }
 need(model.company==='AECOM'&&model.company_ac==='AECOM'&&model.company_canonical_microsite===BOARD&&model.company_canonical_microsite_exact===BOARD,'role employer identity differs')
 need(['country','country_ac','country_exact'].every(k=>model[k]==='India')&&model.country_short==='IND'&&model.country_short_exact==='IND'&&model.country_slug==='india','role own country differs')
 need(model.title===model.title_exact&&model.location===model.location_exact&&string(model.city_exact),'role native aliases differ')
 need(model.country_slab==='ind/jobs::India'&&model.country_slab_exact==='ind/jobs::India','role typed country slabs differ')
 need(model.company_slab==='aecom/careers::AECOM'&&model.company_slab_exact==='aecom/careers::AECOM','role typed employer slabs differ')
 for(const key of ['full_loc','full_loc_exact']){
  need(typeof model[key]==='string','unsupported role typed location')
  const fields=model[key].split('@@').map(part=>{const at=part.indexOf('::');need(at>0,'invalid typed role location');return[part.slice(0,at),part.slice(at+2)]})
  need(fields.length===4&&new Set(fields.map(([key])=>key)).size===4,'ambiguous typed role location')
  const place=Object.fromEntries(fields)
  need(place.country==='India'&&place.city===model.city_exact&&place.location===model.location_exact&&place.state==='None','role typed location aliases conflict or are unsupported')
 }
 need(Array.isArray(model.all_locations)&&model.all_locations.length===0,'unsupported additional role worksites')
 for(const key of ['location_info','location_name','full_address'])need(model[key]===null||model[key]==='','unsupported role placement field '+key)
 need(!Object.hasOwn(model,'deleted_at'),'role expiry flag present')
 need(!/\b(?:expression of interest|talent (?:pool|community)|future opportunities)\b/i.test(model.title),'prospective hiring record')
 for(const key of ['date_added','date_new','date_updated']){
  const a=timestamp(model[key],'role '+key,now),b=timestamp(listing[key],'listing '+key,now)
  need(a===b,'role '+key+' instant differs from listing')
  if(Object.hasOwn(model,key+'_exact'))need(timestamp(model[key+'_exact'],key+' alias',now)===a,'role date alias differs')
 }
 need(string(model.html_description),'missing whole role criteria')
 const doc=readVisibleNativeDocument(model.html_description,{strict:true}),root=doc.nodes(n=>n.tag==='root')[0]
 const nodes=allNodes(root),supported=new Set(['root','p','strong','ul','li','em','ol'])
 need(nodes.every(n=>!n.inert&&!n.nativeTagUnqualified&&supported.has(n.tag)&&Object.entries(n.attrs||{}).every(([k,v])=>n.tag==='ol'&&k==='start'&&/^[0-9]+$/.test(v))),'unsupported or inactive whole role criteria')
 const description=rendered(root).replace(/\s+/g,' ').trim()
 need(description.includes('Job Description')&&description.includes('Qualifications'),'missing native job requirements sections')
 const reqids=[...description.matchAll(/\bReqID\s*:\s*([^\s]+)/gi)].map(m=>m[1])
 need(reqids.length===1&&reqids[0]===model.reqid,'HTML requisition differs from own model')
 const blocks=rendered(root).split(/\n+/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean)
 for(let index=0;index<blocks.length;index++){
  const match=blocks[index].match(/^(country|work(?:site|place) country|mandatory work assignment|employer|legal employer|hiring (?:company|organization))\s*:\s*(.*)$/i)
  if(!match)continue
  const value=match[2]||blocks[index+1]||'',country=/country|assignment/i.test(match[1])
  need(value&&!/^[^:]+:$/.test(value),'criteria declaration has no resolved value')
  if(country)need(/^(?:India|IND)[.!]?$/i.test(value),'criteria workplace country conflicts or is unknown')
  else need(/^AECOM[.!]?$/.test(value),'criteria employer conflicts or is unknown')
 }
 need(!/\b(?:this is not (?:a |an )?(?:current |open )?(?:vacancy|position)|no (?:current |open )?vacanc(?:y|ies))\b/i.test(description),'non-vacancy criteria')
 return{model,description,renderedDescription:description,descriptionHTML:model.html_description,sourceURL:ROLE_BASE+model.guid+'.json'}
}
const without=(model,keys)=>Object.fromEntries(Object.entries(model).filter(([key])=>!keys.includes(key)))
export function reconcileModels(open,close,kind){
 // Index ranking/version/salt are kept in full models, but are not authored
 // criteria. Every other known or future field participates in closing proof.
 const ignored=kind==='listing'?['_version_','score','salted_date']:['salted_date']
 need(isDeepStrictEqual(without(open,ignored),without(close,ignored)),'closing '+kind+' model changed')
}
export function reconcileIndiaEnvelope(open,close){
 const envelope=model=>({...without(model,['jobs']),meta:without(model.meta,['request_country','request_id'])})
 // Rows are compared independently by GUID, so ranking/page membership may
 // change. Every other India envelope field, including future keys, is bound.
 need(isDeepStrictEqual(envelope(open),envelope(close)),'closing India page envelope changed')
}
export function mapRole(source,listing,opening,closing,closingListing,declaration,at){
 const d=opening.model
 return{source,companyName:'AECOM',company:'AECOM',companyCareerPage:'https://aecom.com/careers/',jobId:d.guid,requisitionId:d.reqid,title:d.title_exact,location:d.location_exact,city:d.city_exact,country:'India',jobDescription:opening.description,sourceDescription:d.html_description,sourceUrl:opening.sourceURL,jobUrl:opening.sourceURL,applyUrl:d.link||null,postingDate:d.date_added,employmentType:null,workplaceType:d.job_type||null,
  canonicalRoleURL:null,legalEmployer:null,firstEverPublication:null,applicationVisited:false,
  nativeSourceRecord:{publisher:declaration,listing,detail:d},nativeClosingRecord:{listing:closingListing,detail:closing.model},nativeRenderedCriteriaText:opening.renderedDescription,nativeCriteriaComplete:true,nativeGeographyQualified:true,nativeEmployerReconciled:true,sourceDetailComplete:true,sourceCountryScopeUnresolved:false,
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,companyInventoryComplete:false,
  nativePublicationEvidence:{expiryRule:'published-client: own deleted_at property presence',openingDeletedAtPresent:false,closingDeletedAtPresent:false,indexPostedFlag:d.is_posted,indexPostedFlagMeaning:null,sourceDateAdded:d.date_added,sourceDateNew:d.date_new,sourceDateUpdated:d.date_updated,firstEverPublication:null,verifiedAt:at},
  sourceWorksiteCountryProof:{kind:'own-native-country-fields',country:d.country,countryCode:d.country_short,listingCountry:listing.country_exact,requestCountryUsed:false,cityDictionaryUsed:false},nativeRegistrationAliasOf:source==='aecomindia'?'aecom':null,sourceCapturedAt:at}
}
