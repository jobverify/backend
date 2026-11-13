import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {activeHead,activeIframeDeclarations,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCriterion} from './criterionRendering.js'
import {parseNativeJSON} from './nativeJSON.js'
import {qualifyCorporatePublisher} from './publisherContext.js'

const profile=JSON.parse(fs.readFileSync(new URL('./native.scope.json',import.meta.url)))
export const careers='https://www.comviva.com/careers/explore-opportunity/'
const key='VkZUbnpKcFNPaUFzWitxQUNzU25sZz09',cp='Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'
const widgetProgram='https://jobsapi.ceipal.com/APISource/widget.js'
const widget='https://jobsapi.ceipal.com/APISource/v2/index.html?bgcolor=eb2227&api_key='+key+'&cp_id='+cp
const handoff='https://careerapi.ceipal.com/careerPortalWidget/?themeid=&bgcolor=&job_id=&apikey='+key+'&cp_id='+cp
const api='https://careerapi.ceipal.com/'+key+'/CareerPortalJobPostings/'
const countriesURL='https://careerapi.ceipal.com/'+key+'/CareerPortalCountries/'
const statesURL='https://careerapi.ceipal.com/'+key+'/CareerPortalStates/?country=356'
const title='Comviva Jobs | Opportunities for Growth & Innovation'
const sha=value=>createHash('sha256').update(value??'undefined').digest('hex')
const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row)
const text=value=>String(value??'').replace(/\s+/g,' ').trim()
const need=(condition,reason)=>{if(!condition)throw Object.assign(Error('comviva current native: '+reason),{abortRetries:true})}
const plain=value=>typeof value==='string'&&nativeCriterion(value).complete
const lookupLiteral=value=>typeof value==='string'&&value.length<=1000&&!/[<>\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(value)
const rendererLiteral=(value,attribute=false)=>typeof value==='string'&&value.length<=5000&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(value)
 &&(!attribute||!/["'`\t\r\n]/.test(value))&&!/&(?:#|[a-z0-9]+;)/i.test(value.replace(/&(?:nbsp|rsquo);/g,''))
const listingRendering=row=>['public_job_title','multpile_job_location'].every(key=>rendererLiteral(row[key],true))
 &&['public_job_desc','country','state','updated','tax_terms'].every(key=>rendererLiteral(row[key]))
const nativeID=value=>typeof value==='string'&&/^[A-Za-z0-9_=-]{8,200}$/.test(value)
const listURL=page=>api+'?page='+page
const detailURL=row=>api+row.id+'/?from_career_portal=1&cp_id='+cp
const apiHeaders={Accept:'*/*',Origin:'https://jobsapi.ceipal.com',Referer:widget,'User-Agent':'Mozilla/5.0'}
const handoffHeaders={Accept:'application/json, text/javascript, */*; q=0.01',Origin:'https://www.comviva.com',Referer:careers,'X-Referer-Host':'https://jobsapi.ceipal.com/','User-Agent':'Mozilla/5.0'}
const boundary='----ComvivaPublishedReadOnlyVacancySearch20261113'
const defaultFields=[['from_chatbot','0'],...['chatbot_job_title','chatbot_skills','chatbot_city','chatbot_state','chatbot_country','searchkey','sortorder','sortby','remote_opportunities','industry','country','state','city','postal_code','radius','offering','profession','speciality','job_type','state'].map(name=>[name,''])]
export function nativeSearchRequest(page){
 const fields=[...defaultFields,['page',String(page)],['api_key',key],['method','CareerPortalJobPostings'],['cp_id',cp],['from_career_portal','1']]
 // The published program serializes the default native filter form, including
 // its duplicate state control. This deterministic multipart request performs
 // exactly that read-only search; application endpoints are never requested.
 const body=fields.map(([name,value])=>'--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n\r\n'+value+'\r\n').join('')+'--'+boundary+'--\r\n'
 return{method:'POST',headers:{...apiHeaders,'Content-Type':'multipart/form-data; boundary='+boundary},body,fields}
}
export function hasCurrentNativeMarker(html){
 return activeHead(html).titles.includes(title)||readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src===widgetProgram&&node.attrs['data-ceipal-api-key']===key).length>0
}
function publisher(html){
 const head=activeHead(html),scripts=readNativeDocument(html).nodes(node=>node.tag==='script'&&node.attrs.src===widgetProgram)
 need(head.titles.length===1&&head.titles[0]===title&&scripts.length===1,'current corporate publisher handoff changed')
 const node=scripts[0]
 need(!node.nativeTagUnqualified&&node.attrs['data-ceipal-api-key']===key&&node.attrs['data-ceipal-career-portal-id']===cp
  &&Object.keys(node.attrs).every(name=>['src','nonce','data-ceipal-api-key','data-ceipal-career-portal-id'].includes(name)),'current corporate native employer identifiers changed')
 return qualifyCorporatePublisher(html,profile.corporateContextSHA256)
}
function nonceURL(value,kind){
 if(typeof value!=='string')return false
 try{const url=new URL(value);return url.origin==='https://candidateportal.ceipal.com'&&!url.username&&!url.password&&!url.search&&!url.hash
  &&(kind==='detail'?/^\/job-details\/[A-Za-z0-9_-]{10,200}$/:/^\/login\/[A-Za-z0-9_-]{10,200}\/[A-Za-z0-9_-]{10,200}$/).test(url.pathname)}catch{return false}
}
function stableNative(row,detail=false){
 const value={...row}
 for(const field of detail?['apply_job','apply_job_login','easy_apply_job_login_hc']:['apply_job_login']){
  need(nonceURL(row[field],field==='easy_apply_job_login_hc'?'detail':'login'),'native public application URL shape changed')
  value[field]=field==='easy_apply_job_login_hc'?'reviewed-volatile-native-job-details-ciphertext':'reviewed-volatile-native-login-ciphertext'
 }
 return value
}
async function concurrent(rows,work){
 const result=new Array(rows.length);let cursor=0,failure
 await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{while(cursor<rows.length&&!failure){const index=cursor++;try{result[index]=await work(rows[index],index)}catch(error){failure=error;throw error}}}))
 return result
}
async function surface(html,read){
 const publisherProof=publisher(html)
 const program=await read(widgetProgram);need(sha(program)===profile.assets[widgetProgram],'declared corporate widget program changed')
 const result=parseNativeJSON(await read(handoff,{headers:handoffHeaders}))
 need(result&&Object.keys(result).length===1&&typeof result.html==='string'&&sha(result.html)===profile.handoffHTMLSHA256,'current native published iframe handoff changed')
 const frames=activeIframeDeclarations(result.html)
 need(frames.length===1&&frames[0].href===widget+'&job_id=','current native iframe employer binding changed')
 const shell=await read(frames[0].href);need(sha(shell)===profile.assets[frames[0].href],'current native application shell changed')
 const doc=readNativeDocument(shell)
 const declared=[...doc.nodes(node=>node.tag==='script'&&node.attrs.src).map(node=>new URL(node.attrs.src,widget).href),...doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='stylesheet').map(node=>new URL(node.attrs.href,widget).href)]
 need(declared.length===14&&new Set(declared).size===14&&declared.every(url=>profile.assets[url]),'current declared renderer or stylesheet contract changed')
 await concurrent(declared,async url=>{const body=await read(url);need(sha(body)===profile.assets[url],'declared native renderer or stylesheet changed: '+url)})
 // Whole shell/program/style hashes above also bind the enabled EasyApply
 // modal, same-job dynamic_job_id, required controls and submit button. No
 // website JavaScript, modal action, captcha or application is executed.
 return{publisher:publisherProof,widgetURL:frames[0].href,widgetProgramSHA256:sha(program),shellSHA256:sha(shell),handoffHTMLSHA256:sha(result.html),declaredAssets:declared.map(url=>({url,sha256:profile.assets[url]}))}
}
async function inventory(read,maxPages){
 const rows=[],pages=[];let first
 for(let page=1;page<=(first?.num_pages??1);page++){
  need(page<=maxPages,'original native page budget cannot cover declared pagination')
  const request=nativeSearchRequest(page),value=parseNativeJSON(await read(listURL(page),request))
  need(value&&Object.keys(value).sort().join(',')==='count,host,limit,next,num_pages,page_count,page_number,previous,results'
   &&Number.isSafeInteger(value.count)&&value.count>=0&&value.count<=1000&&value.limit===20&&Number.isSafeInteger(value.num_pages)&&value.num_pages>=1
   &&value.num_pages===Math.max(1,Math.ceil(value.count/value.limit))&&value.page_number===page&&value.host==='https://talenthirecls15.ceipal.com'
   &&Array.isArray(value.results)&&value.page_count===value.results.length&&value.page_count===Math.min(value.limit,Math.max(0,value.count-(page-1)*value.limit))
   &&value.next===(page<value.num_pages?listURL(page+1):null)&&value.previous===(page>1?listURL(page-1):null),'native search pagination, scope or total changed')
  if(first)need(first.count===value.count&&first.limit===value.limit&&first.num_pages===value.num_pages,'native page cohort changed')
  else first=value
  rows.push(...value.results);pages.push(value)
 }
 const ids=new Set(),codes=new Set()
 for(const row of rows){need(row&&nativeID(row.id)&&!ids.has(row.id)&&typeof row.job_code==='string'&&/^\d+$/.test(row.job_code)&&!codes.has(row.job_code)&&text(row.public_job_title),'native role identity or duplicate membership changed');ids.add(row.id);codes.add(row.job_code);stableNative(row)}
 need(rows.length===first.count,'native final inventory membership incomplete')
 const renderingProofs=rows.map(row=>({id:row.id,jobCode:row.job_code,complete:listingRendering(row)}))
 return{rows,pages,reportedTotal:first.count,renderingProofs,renderingComplete:renderingProofs.every(row=>row.complete)}
}
const internalOnly=/\b(?:only\s+(?:current|existing|internal)\s+(?:comviva\s+)?employees|(?:current|existing|internal)\s+(?:comviva\s+)?employees\s+only|internal\s+candidates\s+only|not\s+open\s+to\s+external|restricted\s+to\s+(?:current|existing|internal)\s+employees)\b/i
function overviewText(value){
 if(typeof value!=='string')return{complete:false,text:''}
 try{
  const doc=readNativeDocument(value),visible=readVisibleNativeDocument(value,{strict:true}),root=doc.nodes(node=>node.tag==='root')[0],shown=visible.nodes(node=>node.tag==='root')[0]
  const raw=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(raw).join(' ')
  const original=root?text(raw(root)):'',rendered=shown?text(visible.text(shown)):''
  return{complete:Boolean(root&&shown&&original===text(doc.text(root))&&original===rendered),text:rendered}
 }catch{return{complete:false,text:''}}
}
async function applicationLookups(read){
 const [countries,states]=await Promise.all([countriesURL,statesURL].map(async url=>parseNativeJSON(await read(url,{headers:apiHeaders}))))
 const holds=[]
 const countryKeys='continent,currency,id,iso,iso_currency_code,name,phone_prefix',stateKeys='abbreviation,country,id,name,standard_timezone,standard_timezone_default'
 const countriesQualified=Array.isArray(countries)&&countries.length>0&&countries.length<=500&&new Set(countries.map(row=>row?.id)).size===countries.length
  &&countries.every(row=>row&&Object.keys(row).sort().join(',')===countryKeys&&Number.isSafeInteger(row.id)&&row.id>0&&lookupLiteral(row.name)
   &&(row.iso===null||typeof row.iso==='string'&&/^[A-Z]{2}$/.test(row.iso))&&Object.entries(row).every(([key,value])=>key==='id'||value===null||lookupLiteral(value)))
 if(!countriesQualified)holds.push('unqualified-current-native-applicant-country-options')
 const india=Array.isArray(countries)?countries.filter(row=>row?.id===356&&row.name==='India'&&row.iso==='IN'):[]
 if(india.length!==1)holds.push('no-current-typed-India-applicant-option')
 if(!Array.isArray(states)||states.length===0||states.length>100||new Set(states.map(row=>row?.id)).size!==states.length
  ||!states.every(row=>row&&Object.keys(row).sort().join(',')===stateKeys&&Number.isSafeInteger(row.id)&&row.id>0&&row.country==='India'&&Object.entries(row).every(([key,value])=>key==='id'||lookupLiteral(value))))holds.push('unqualified-current-native-required-applicant-state-options')
 if(internalOnly.test(JSON.stringify({countries,states})))holds.push('explicit-current-employees-only-public-lookup-restriction')
 return{countries,states,india:india.length===1?india[0]:null,untypedApplicantOptions:Array.isArray(countries)?countries.filter(row=>row?.iso===null):[],complete:holds.length===0,holds,purpose:'Current typed India applicant-country/state control path only; every original option, including native null-metadata options, is retained. These lists never assign country to a job.',countriesURL,statesURL,countriesSHA256:sha(canonical(countries)),statesSHA256:sha(canonical(states))}
}
function inspect(row,detail,lookup,sharedListingRenderingComplete){
 const holds=[],hold=reason=>holds.push(reason)
 if(!detail||typeof detail!=='object'||Array.isArray(detail))return{complete:false,holds:['no-current-full-native-detail']}
 if(Object.keys(row).some(key=>!profile.listingKeys.includes(key))||Object.keys(detail).some(key=>!profile.detailKeys.includes(key)))hold('unreviewed-native-criterion-or-identity-field')
 // The pinned client inserts these listing fields as HTML, and puts title
 // and location inside quoted attributes too. Actual previews are plain text.
 // A full detail hash cannot authorize CSS/programs injected by its sibling.
 if(!listingRendering(row))hold('unqualified-native-listing-render-input')
 if(!sharedListingRenderingComplete)hold('unqualified-shared-native-listing-render-context')
 if(!rendererLiteral(detail.public_job_title,true)||!rendererLiteral(detail.modified)||!rendererLiteral(detail.multpile_job_location,true))hold('unqualified-native-detail-render-input')
 if(detail.show_job_summary!==0)hold('unreviewed-native-job-summary-render-input')
 if(detail.job_code!==row.job_code||detail.public_job_title!==row.public_job_title||detail.company_url!=='www.comviva.com')hold('native-detail-employer-or-role-identity-mismatch')
 if(!detail.custom_fields||Array.isArray(detail.custom_fields)||Object.keys(detail.custom_fields).some(key=>!profile.customFieldKeys.includes(key)))hold('unreviewed-native-custom-field')
 for(const [field,expected]of Object.entries(profile.commonDetailHashes))if(sha(canonical(detail[field]))!==expected)hold('unreviewed-native-'+field)
 const criteria=nativeCriterion(detail.public_job_desc),experience=nativeCriterion(detail.experience),skills=nativeCriterion(detail.primary_skills)
 const overview=overviewText(detail.overview_final_data?.subject)
 if(!criteria.complete||criteria.text.length<120||!experience.complete||!skills.complete)hold('incomplete-full-original-visible-criteria')
 if(!overview.complete)hold('incomplete-full-original-visible-overview')
 if(!Array.isArray(detail.display_job_view_fields)||detail.display_job_view_fields.length!==2||!detail.display_job_view_fields.every(field=>
  field&&Object.keys(field).sort().join(',')==='bu_label,is_custom_field,key,label,value'&&field.is_custom_field==='0'
  &&(field.key==='job_code'&&field.label==='Job Code'&&field.bu_label==='Req ID'&&field.value===detail.job_code||field.key==='experience'&&field.label==='Experience'&&field.bu_label==='Experience'&&field.value===detail.experience))
  ||new Set(detail.display_job_view_fields.map(field=>field?.key)).size!==2)hold('unqualified-native-quick-view-criteria')
 if(!Array.isArray(detail.pay_rates)||!detail.pay_rates.every(pay=>pay&&Object.keys(pay).sort().join(',')==='max_pay_rate,min_pay_rate,pay_rate,pay_rate_currency,pay_rate_employment_type,pay_rate_pay_frequency_type'&&Object.values(pay).every(plain)))hold('unqualified-native-pay-criteria')
 if(row.country!=='India'||detail.country!=='India'||row.multpile_job_location!==detail.multpile_job_location||row.remote_opportunities!==detail.remote_opportunities||![0,2].includes(detail.remote_opportunities))hold('unqualified-explicit-role-country-or-alternatives')
 const places=detail.multpile_job_location
 if(typeof places!=='string'||!/^\([^()<>]+\)(?:,\s*\([^()<>]+\))*$/.test(places))hold('unqualified-native-location-alternatives')
 // These global applicant options never assign geography. Their explicit
 // foreign country labels are only a conservative contradiction check against
 // an otherwise role-owned native country; city names never prove country.
 const foreign=detail.form_fields?.standard_fields?.find(field=>field.key==='country')?.options?.map(option=>option.name).filter(name=>name!=='India')||[]
 if(typeof places==='string'&&places.split(/[(),]/).some(part=>foreign.some(name=>text(part).toLowerCase()===name.toLowerCase())||/^(?:US|USA|UK)$/.test(text(part))))hold('contradictory-native-location-country')
 if(row.product_type!==1||row.apply_with_out_registration!==1||row.apply_now!==0||detail.apply_with_out_registration!==1||detail.apply_now!==0)hold('inactive-or-unqualified-native-public-application')
 if(!lookup.complete)hold('unqualified-current-required-applicant-application-controls')
 if(!Number.isSafeInteger(detail.number_of_positions)||detail.number_of_positions<1)hold('no-qualified-current-native-position-count')
 try{stableNative(detail,true)}catch{hold('unqualified-native-application-URL')}
 const authored=[detail.public_job_desc,detail.experience,detail.primary_skills,JSON.stringify(detail.form_fields),JSON.stringify(detail.job_posting_questions),JSON.stringify(detail.overview_final_data)].join(' ')
 if(internalOnly.test(authored))hold('explicit-current-employees-only-restriction')
 const originalExtras=[detail.experience,detail.primary_skills,...(detail.display_job_view_fields||[]).map(field=>field.bu_label+': '+field.value),...(detail.pay_rates||[]).flatMap(pay=>Object.values(pay))].map(value=>nativeCriterion(String(value)).text).filter(Boolean)
 return{complete:holds.length===0,holds,description:criteria.text,overview:overview.text,experience:experience.text,skills:skills.text,renderedDescription:[overview.text,criteria.text,...originalExtras].filter(Boolean).join('\n\n'),
  application:{activePublicUI:false,nativeWidgetUIQualified:holds.length===0,corporatePublisherQualified:false,method:'published-same-job-EasyApply-widget-form; corporate-rendering-unqualified',sameJobNativeID:row.id,requiredSchemaSHA256:sha(canonical(detail.form_fields)),requiredApplicantControlsQualified:lookup.complete,applicantCountriesSHA256:lookup.countriesSHA256,applicantStatesSHA256:lookup.statesSHA256,submissionAttempted:false,backendAcceptanceAssumed:false},
  country:{country:'India',countryCode:'IN',method:'matching-role-owned-native-list-and-detail-country-for-all-native-alternatives',listingCountry:row.country,detailCountry:detail.country,nativeAlternatives:places},
  internalPostingMetadata:{is_ijp_job:detail.custom_fields?.is_ijp_job??null,meaning:'Native IJP metadata is ambiguous alongside the enabled public application UI; no backend acceptance is assumed.'}}
}
export async function readCurrentNative({careersHTML,read,receipts,options,maxJobs,maxPages}){
 const openingSurface=await surface(careersHTML,read),opening=await inventory(read,maxPages)
 const openingApplicationLookups=await applicationLookups(read)
 const india=opening.rows.filter(row=>row.country==='India')
 async function fullDetail(row){
  let originalBody
  try{originalBody=await read(detailURL(row),{headers:apiHeaders});const value=parseNativeJSON(originalBody);if(!value||typeof value!=='object'||value.success===0||value.status===400)throw Object.assign(Error('native detail unavailable'),{status:value?.status});return{value,sha256:sha(originalBody)}}
  catch(error){
   options.signal?.throwIfAborted()
   if([400,401,403].includes(error.status)){
    options.onAudit?.({source:'comviva',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,sourceNativeRaw:opening.rows,publicRequestReceipts:receipts,blockedNativeID:row.id,blockedReason:String(error.message||error),productionWrites:false,websiteJavaScriptExecuted:false})
    throw error
   }
   return{value:null,originalUnqualifiedBody:originalBody||null,error:String(error.message||error)}
  }
 }
 const before=await concurrent(india,fullDetail),closing=await inventory(read,maxPages)
 need(canonical(opening.rows.map(row=>stableNative(row)))===canonical(closing.rows.map(row=>stableNative(row))),'closing full native inventory or final membership changed')
 const after=await concurrent(india,fullDetail)
 const closingApplicationLookups=await applicationLookups(read)
 const applicationLookupsMatched=canonical(openingApplicationLookups)===canonical(closingApplicationLookups)
 if(!applicationLookupsMatched){
  openingApplicationLookups.complete=false;closingApplicationLookups.complete=false
  openingApplicationLookups.holds.push('closing-native-required-applicant-controls-changed');closingApplicationLookups.holds.push('closing-native-required-applicant-controls-changed')
 }
 const closingSurface=await surface(await read(careers,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}}),read)
 const {publisher:openingPublisher,...openingNativeSurface}=openingSurface,{publisher:closingPublisher,...closingNativeSurface}=closingSurface
 need(canonical(openingNativeSurface)===canonical(closingNativeSurface),'closing current native application contract changed')
 const publisherOpeningClosingMatched=canonical(openingPublisher)===canonical(closingPublisher)
 const jobs=[],proofs=[]
 for(let index=0;index<india.length;index++){
  const native=india[index],start=before[index],end=after[index],first=inspect(native,start.value,openingApplicationLookups,opening.renderingComplete),last=inspect(native,end.value,closingApplicationLookups,closing.renderingComplete)
  let stable=false
  try{stable=Boolean(start.value&&end.value&&canonical(stableNative(start.value,true))===canonical(stableNative(end.value,true)))}catch{}
  const nativeComplete=first.complete&&last.complete&&stable,publisherComplete=openingPublisher.complete&&closingPublisher.complete&&publisherOpeningClosingMatched
  for(const proof of[first,last])if(proof.application){proof.application.corporatePublisherQualified=publisherComplete;proof.application.activePublicUI=publisherComplete&&proof.application.nativeWidgetUIQualified}
  const complete=nativeComplete&&publisherComplete
  proofs.push({id:native.id,jobCode:native.job_code,complete,nativeComplete,publisherComplete,publicationHolds:publisherComplete?[]:['unqualified-current-corporate-public-application-rendering'],openingProof:first,closingProof:last,stableNativeRole:stable,openingNativeDetail:start.value,closingNativeDetail:end.value,openingUnqualifiedBody:start.originalUnqualifiedBody||null,closingUnqualifiedBody:end.originalUnqualifiedBody||null,openingDetailSHA256:start.sha256||null,closingDetailSHA256:end.sha256||null,openingError:start.error||null,closingError:end.error||null,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  if(!complete)continue
  const detail=start.value,sourceURL=careers+'?job_id='+native.id
  jobs.push({source:'comviva',company:'Comviva',companyDomain:'comviva.com',companyCareerPage:careers,atsPlatform:'ceipal-widget',jobId:native.job_code,sourceJobId:native.job_code,requisitionId:native.job_code,sourceNativeId:native.id,title:native.public_job_title,
   country:'India',location:detail.multpile_job_location+', India',locations:detail.multpile_job_location.match(/\([^()]+\)/g).map(value=>value.slice(1,-1)+', India'),sourceCountryEvidence:first.country,
   sourceURL,sourceUrl:sourceURL,applyUrl:sourceURL,link:sourceURL,jobDescription:first.renderedDescription,sourceDescription:detail.public_job_desc,sourceNativeListing:native,sourceNativeDetail:detail,
   sourceApplicationEvidence:first.application,sourceInternalPostingMetadata:first.internalPostingMetadata,sourceModifiedAt:detail.modified,postingDate:null,sourcePublishedDateUnknown:true,employmentType:native.tax_terms||null,
   experienceRequired:detail.experience,requiredSkills:detail.primary_skills,sourceDetailComplete:true,sourceNativeCriteriaComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   sourceNativeDetailSHA256:start.sha256,sourceNativeClosingDetailSHA256:end.sha256,scrapedAt:new Date().toISOString()})
 }
 const result=maxJobs>0?jobs.slice(0,maxJobs):jobs
 const audit={source:'comviva',recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  sourceNativeRaw:opening.rows,closingNativeRaw:closing.rows,openingNativePages:opening.pages,closingNativePages:closing.pages,nativeIndiaDetailProofs:proofs,openingSurface,closingSurface,openingApplicationLookups,closingApplicationLookups,
  openingListingRenderingProofs:opening.renderingProofs,closingListingRenderingProofs:closing.renderingProofs,
  foreignNativeRecords:opening.rows.filter(row=>row.country!=='India'),qualifiedNativeCount:jobs.length,returnedNativeCount:result.length,withheldIndiaCount:proofs.filter(row=>!row.complete).length,
  intrinsicallyQualifiedIndiaCount:proofs.filter(row=>row.nativeComplete).length,individuallyUnqualifiedIndiaCount:proofs.filter(row=>!row.nativeComplete).length,publisherBlockedIndiaCount:proofs.filter(row=>row.nativeComplete&&!row.publisherComplete).length,
  openingClosingMatched:publisherOpeningClosingMatched&&applicationLookupsMatched&&proofs.every(row=>row.stableNativeRole),boardOpeningClosingMatched:true,publisherOpeningClosingMatched,applicationLookupsMatched,publicRequestReceipts:receipts,publicRequestContext:{nativeAPIHeaders:apiHeaders,widgetHandoffHeaders:handoffHeaders,unfilteredSearchFields:nativeSearchRequest(1).fields},
  internalPostingMetadataAmbiguity:'Original is_ijp_job metadata is preserved. Native widget controls are reviewed separately; corporate programs/styles remain unqualified. No application is submitted, public availability asserted or backend acceptance assumed.',
  productionWrites:false,websiteJavaScriptExecuted:false,reason:'current-published-employer-bound-native-board; all-pages-and-full-India-details-reconciled; unreviewed-corporate-programs-and-styles-hold-current-public-application; company-scope-remains-unknown'}
 attachSourceObservationEvidence(result,audit);Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
 options.onAudit?.(structuredClone(audit))
 return attachInventoryEvidence(result,{status:result.length?'discovery-only':'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:careers,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:options.now?.()||new Date().toISOString(),reason:audit.reason})
}
