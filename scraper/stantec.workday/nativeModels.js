import {isDeepStrictEqual} from 'node:util'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeSafeCount} from '../aecom.workday/nativeJSON.js'
import {BOARD,ROLE_BASE,need,json} from './nativeDeclarations.js'

const string=v=>typeof v==='string'&&v.trim().length>0,int=v=>Number.isSafeInteger(v)&&v>=0
const nativeIndiaRegions=new Set('Andaman and Nicobar Islands;Andhra Pradesh;Arunachal Pradesh;Assam;Bihar;Chandigarh;Chhattisgarh;Dadra and Nagar Haveli and Daman and Diu;Delhi;Goa;Gujarat;Haryana;Himachal Pradesh;Jammu and Kashmir;Jharkhand;Karnataka;Kerala;Ladakh;Lakshadweep;Madhya Pradesh;Maharashtra;Manipur;Meghalaya;Mizoram;Nagaland;Odisha;Puducherry;Punjab;Rajasthan;Sikkim;Tamil Nadu;Telangana;Tripura;Uttar Pradesh;Uttarakhand;West Bengal'.split(';'))
const roleKeys='GeoLocation all_locations apply_info assets audiences buid city city_ac city_exact city_slab city_slab_exact city_slug company company_ac company_canonical_microsite company_canonical_microsite_exact company_digital_strategies_customer company_enhanced company_exact company_member company_slab company_slab_exact country country_ac country_exact country_short country_short_exact country_slab country_slab_exact country_slug date_added date_added_exact date_new date_new_exact date_updated date_updated_exact default_facet_tags description django_ct django_id facet_hash featured_facet_tags federal_contractor full_address full_loc full_loc_exact google_place_id guid html_description id internal_tags is_posted job_category job_function job_shift job_source_name job_type lat_long_buid_slab lat_long_buid_slab_exact link location location_exact location_info location_name mapped_moc on_sites onet onet_exact other reqid salted_date standard_facet_tags state state_ac state_exact state_short state_short_exact state_slab state_slab_exact state_slug street_name street_number text title title_ac title_exact title_slab title_slab_exact title_slug uid zipcode'.split(' ')
const common='guid id reqid buid company_exact country_ac country_exact country_short_exact title_exact title_slug location_exact description is_posted on_sites onet_exact other GeoLocation company_member federal_contractor django_ct django_id city_slab_exact country_slab_exact company_slab_exact title_slab_exact lat_long_buid_slab_exact'.split(' ')
const timestamp=(value,label,now)=>{
 need(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value)),'invalid '+label)
 const time=Date.parse(value);need(new Date(time).toISOString().slice(0,19)===value.slice(0,19)&&time<=now,'invalid or future '+label);return time
}
export function readIndiaFacet(model){
 need(model?.meta?.source==='solr'&&model.meta.canonical==='/jobs/','global search identity differs')
 const matches=model.filters?.country?.filter(f=>f.display==='India')
 need(matches?.length===1&&matches[0].link==='/locations/ind/jobs'&&int(matches[0].value)&&matches[0].value>0&&matches[0].value<=1000,'missing, ambiguous or empty native India facet')
 need(int(model.pagination?.total)&&model.pagination.total>=matches[0].value,'invalid worldwide total')
 return{display:'India',link:matches[0].link,value:matches[0].value}
}
export function readIndiaPage(model,page,total){
 need(model?.meta?.source==='solr'&&model.meta.canonical==='/locations/ind/jobs/','India listing identity differs')
 need(isDeepStrictEqual(model.meta.filters,[{display:'IND',key:'locations',link:'/jobs',name:'locations'}]),'India native filter differs')
 need(Array.isArray(model.featured_jobs)&&model.featured_jobs.length===0,'unreviewed featured records')
 const p=model.pagination,pages=Math.ceil(total/50)
 need(p&&p.total===total&&nativeSafeCount(p.page)===page&&p.page_size===50&&p.total_pages===pages&&p.offset===(page-1)*50&&p.has_more_pages===(page<pages),'invalid India pagination arithmetic')
 need(Array.isArray(model.jobs)&&model.jobs.length===Math.min(50,total-(page-1)*50),'incomplete India page')
 for(const row of model.jobs)validateListing(row)
 return model.jobs
}
export function validateListing(row){
 need(row&&typeof row==='object'&&/^[A-F0-9]{32}$/.test(row.guid)&&row.id==='seo.joblisting.'+row.guid&&string(row.reqid),'listing native role identity differs')
 need(row.company_exact==='Stantec'&&row.buid===58027,'listing employer differs')
 need(row.country_ac==='India'&&row.country_exact==='India'&&row.country_short_exact==='IND'&&row.country_slab_exact==='ind/jobs::India','listing own country differs')
 need(row.company_buid_slab==='Stantec::58027'&&row.company_buid_slab_exact==='Stantec::58027'&&row.company_slab_exact==='stantec/careers::Stantec','listing employer slabs differ')
 need(string(row.title_exact)&&string(row.title_slug)&&string(row.location_exact)&&string(row.description),'incomplete native listing')
 if(Object.hasOwn(row,'city_exact'))need(string(row.city_exact)&&row.location_exact===row.city_exact+', IND'&&isDeepStrictEqual(row.all_locations,[row.city_exact,row.city_exact+', ','India']),'listing placement aliases conflict')
 else need(row.location_exact==='Virtual, IND'&&isDeepStrictEqual(row.all_locations,[', ','India']),'unsupported native missing-city representation')
 need(!Object.hasOwn(row,'deleted_at'),'listing expiry presence')
}
const nodes=node=>typeof node==='string'?[]:[node,...node.children.flatMap(nodes)]
const flow=(node,omit=true)=>{
 if(typeof node==='string')return decodeNativeEntities(node)
 if(omit&&node.tag==='p'&&flow(node,false).trim()==='#additional')return''
 return(['p','li','ul','ol','br'].includes(node.tag)?'\n':'')+node.children.map(n=>flow(n,omit)).join('')+(['p','li','ul','ol'].includes(node.tag)?'\n':'')
}
export function readRole(model,listing,now){
 validateListing(listing)
 need(model&&typeof model==='object'&&isDeepStrictEqual(Object.keys(model).sort(),[...roleKeys].sort()),'unreviewed role fields changed')
 need(model.guid===listing.guid&&model.id===listing.id&&model.reqid===listing.reqid,'role GUID or requisition differs')
 for(const key of common)need(isDeepStrictEqual(model[key],listing[key]),'role '+key+' differs from listing')
 need(['company','company_ac','company_exact','job_source_name'].every(k=>model[k]==='Stantec')&&model.company_canonical_microsite===BOARD&&model.company_canonical_microsite_exact===BOARD,'role own employer differs')
 need(['country','country_ac','country_exact'].every(k=>model[k]==='India')&&model.country_short==='IND'&&model.country_short_exact==='IND'&&model.country_slug==='india','role own country differs')
 need(model.title===model.title_exact&&model.title_ac===model.title_exact&&model.location===model.location_exact,'role title or location aliases differ')
 const city=listing.city_exact||''
 need(['city','city_ac','city_exact'].every(k=>model[k]===city),'role native city aliases conflict')
 need(['state','state_ac','state_exact','state_short','state_short_exact'].every(k=>model[k]===''),'unreviewed native state aliases')
 need(model.country_slab==='ind/jobs::India'&&model.country_slab_exact==='ind/jobs::India'&&model.company_slab==='stantec/careers::Stantec'&&model.company_slab_exact==='stantec/careers::Stantec','role employer or country slabs differ')
 for(const key of ['full_loc','full_loc_exact']){
  need(typeof model[key]==='string','missing typed placement')
  const fields=model[key].split('@@').map(s=>{const i=s.indexOf('::');need(i>0,'invalid typed placement');return[s.slice(0,i),s.slice(i+2)]})
  need(fields.length===4&&new Set(fields.map(([k])=>k)).size===4,'ambiguous typed placement')
  const place=Object.fromEntries(fields);need(place.country==='India'&&place.location===model.location_exact&&place.city===(city||'None')&&place.state==='None','role typed work-country or placement conflicts')
 }
 need(isDeepStrictEqual(model.all_locations,[])&&['location_info','location_name','full_address'].every(k=>model[k]===null||model[k]===''),'unsupported additional placement aliases')
 need(!Object.hasOwn(model,'deleted_at'),'role expiry presence')
 for(const key of ['date_added','date_new','date_updated']){
  const instant=timestamp(model[key],key,now);need(instant===timestamp(listing[key],'listing '+key,now)&&instant===timestamp(model[key+'_exact'],key+' alias',now),'role date instant differs')
 }
 const other=json(model.other),ghost=isDeepStrictEqual(other,{ghost:'Single job with multiple work locations available'})
 need(ghost||isDeepStrictEqual(other,{}),'unreviewed role metadata');need(!!city||ghost,'missing-city record has no declared multiple-location meaning')
 need(isDeepStrictEqual(model.assets,{}),'unreviewed supplemental role assets')
 need(string(model.html_description)&&model.html_description.length<=200000,'missing whole role criteria')
 const doc=readVisibleNativeDocument(model.html_description,{strict:true}),root=doc.nodes(n=>n.tag==='root')[0],all=nodes(root),tags=new Set(['root','p','strong','ul','li','ol','br'])
 need(all.every(n=>!n.inert&&!n.nativeTagUnqualified&&tags.has(n.tag)&&Object.entries(n.attrs||{}).every(([k,v])=>n.tag==='ol'&&k==='start'&&/^[1-9][0-9]*$/.test(v))),'unsupported or inactive whole role criteria')
 const marker=all.filter(n=>n.tag==='p'&&flow(n,false).includes('#additional'))
 need(marker.length<=1&&marker.every(n=>flow(n,false).trim()==='#additional'),'additional marker would remove substantive criteria')
 const authored=flow(root,false),description=flow(root).replace(/\s+/g,' ').trim(),blocks=authored.split(/\n+/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean)
 need(description.length>=200&&/qualification|capabilit|experience|education|skills|requirements/i.test(description),'missing whole role requirements')
 const labelled=label=>blocks.filter(s=>s.toLowerCase().startsWith(label.toLowerCase()+':')).map(s=>s.slice(s.indexOf(':')+1).trim()),primary=labelled('Primary Location'),extra=labelled('Other Locations'),reqs=labelled('Req ID')
 need(primary.length===1&&reqs.length===1&&reqs[0]===model.reqid,'native body requisition or primary location differs')
 for(const label of [...primary,...extra]){
  const parts=label.split('|').map(s=>s.trim()),cityPattern=/^[\p{L}\p{M}0-9 .'-]+$/u
  // The current native multi-location body can include its state between
  // country and city. Every worksite must still explicitly name India; the
  // optional state is a closed India-region value, never country inference.
  const placement=parts.length===2&&cityPattern.test(parts[1])
   ||parts.length===3&&nativeIndiaRegions.has(parts[1])&&cityPattern.test(parts[2])
  need(parts[0]==='India'&&placement,'native body work-country conflicts or is unresolved')
 }
 if(!ghost)need(extra.length===0&&primary[0]==='India | '+city,'body and structured primary worksite differ')
 for(const block of blocks){const match=block.match(/^(country|work(?:site|place) country|mandatory work assignment|employer|legal employer|hiring (?:company|organization))\s*:\s*(.*)$/i);if(match)need(/country|assignment/i.test(match[1])?/^(?:India|IND)[.!]?$/.test(match[2]):/^Stantec[.!]?$/.test(match[2]),'criteria employer or workplace country conflicts or is unresolved')}
 need(!/\b(?:this is not (?:a |an )?(?:current |open )?(?:vacancy|position)|no (?:current |open )?vacanc(?:y|ies))\b/i.test(description),'non-vacancy criteria')
 need(!blocks.some(s=>/^(?:this|the) (?:position|job|vacancy|role) (?:has been filled|is (?:filled|closed)|is no longer (?:available|open|accepting applications))[.!]?$/i.test(s)||/^(?:we are no longer|no longer) accepting applications(?: for (?:this|the) (?:position|job|vacancy|role))?[.!]?$/i.test(s)),'explicit native filled or closed publication status')
 const prospective=/\btalent (?:pool|community)\b|\bexpression of interest\b|\bfuture opportunities\b/i.test(model.title_exact)
 return{model,description,authoredText:authored.replace(/\s+/g,' ').trim(),bodyWorksites:[...primary,...extra],ghost,eligible:!prospective,heldReason:prospective?'prospective-talent-pool':null,rendererOmissions:marker.map(()=>({tag:'p',text:'#additional',reason:'published-client-literal-metadata-marker'}))}
}
const without=(model,keys)=>Object.fromEntries(Object.entries(model).filter(([k])=>!keys.includes(k)))
export function reconcileModels(open,close,kind){need(isDeepStrictEqual(without(open,kind==='listing'?['_version_','score','salted_date']:['salted_date']),without(close,kind==='listing'?['_version_','score','salted_date']:['salted_date'])),'closing '+kind+' whole model changed')}
export function reconcileIndiaEnvelope(open,close){
 const envelope=m=>({...without(m,['jobs']),meta:without(m.meta,['request_country','request_id'])})
 need(isDeepStrictEqual(envelope(open),envelope(close)),'closing India envelope changed')
}
export function mapRole(listing,open,close,closingListing,publisher,at){
 const d=open.model
 return{source:'stantec',companyName:'Stantec',company:'Stantec',companyCareerPage:'https://www.stantec.com/',jobId:d.guid,requisitionId:d.reqid,title:d.title_exact,country:'India',location:open.ghost?'India':d.location_exact,city:open.ghost?null:d.city_exact,state:null,workplaceType:null,employmentType:null,
  jobDescription:open.description,sourceDescription:d.html_description,sourceUrl:ROLE_BASE+d.guid+'.json',jobUrl:ROLE_BASE+d.guid+'.json',applyUrl:d.link||null,canonicalRoleURL:null,legalEmployer:null,postingDate:null,firstEverPublication:null,applicationVisited:false,activeApplyVerified:false,
  nativeSourceRecord:{publisher,listing,detail:d},nativeClosingRecord:{listing:closingListing,detail:close.model},nativeRendererOmissions:open.rendererOmissions,nativeBodyWorksites:open.bodyWorksites,nativeIndexLocation:d.location_exact,nativeMultipleWorksites:open.ghost,
  nativeCriteriaComplete:true,nativeGeographyQualified:true,nativeEmployerReconciled:true,sourceDetailComplete:true,nativeRoleClosingReconciled:true,sourceCountryScopeUnresolved:false,
  nativePublicationEvidence:{expiryRule:'published-client: own deleted_at property presence',openingDeletedAtPresent:false,closingDeletedAtPresent:false,indexPostedFlag:d.is_posted,indexPostedFlagMeaning:null,nativeDateAdded:d.date_added,nativeDateNew:d.date_new,nativeDateUpdated:d.date_updated,firstEverPublication:null,verifiedAt:at},
  sourceWorksiteCountryProof:{kind:'own-native-country-aliases-and-body-worksites',country:d.country,countryCode:d.country_short,bodyWorksites:open.bodyWorksites,requestCountryUsed:false,cityDictionaryUsed:false},
  sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,sourceCapturedAt:at}
}
