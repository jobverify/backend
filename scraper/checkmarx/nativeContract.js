import {readNativeData} from './nativeData.js'
import {activeText} from './nativeHtml.js'
import {createHash} from 'node:crypto'

export const SOURCE='checkmarx',COMPANY='Checkmarx',BOARD='https://www.comeet.com/jobs/checkmarx/C0.008'
export const OFFICIAL_BINDING=Object.freeze({
  officialURL:'https://checkmarx.com/',careersURL:'https://checkmarx.com/company/careers/',
  nativeCompanyUID:'C0.008',nativeBoardURL:BOARD,checkedAt:'2026-10-21T03:25:40.790Z',
  proof:'artifacts/full-catalog/checkmarx-native-001/browser-native-011/packet-002.json',
  bodySha256:'a90876c4c0d11a1b0f7ff345cff9c2483cd336def6786a4ffc93f8a3aa155592',
  scope:'Captured official Comeet configuration; current native company identity is independently checked each run.',
})
const check=(ok,message)=>{if(!ok)throw Error('Checkmarx native contract: '+message)}
const plain=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=1000&&!/[<>\u0000-\u001f]/.test(s)
const uid=s=>typeof s==='string'&&/^[A-F0-9]{2}\.[A-F0-9]{3}(?:-[A-F0-9]{2}\.[A-F0-9]{3})?$/.test(s)
const COUNTRIES={IN:'India',US:'United States',PT:'Portugal',IL:'Israel',BR:'Brazil',PH:'Philippines',MX:'Mexico',GB:'United Kingdom',SG:'Singapore'}
const LOCATION_FIELDS=new Set(['name','country','city','state','postal_code','street_name','arrival_instructions','street_number','timezone','location_uid','is_remote'])
const hasCarrierValue=value=>value!==null&&value!==undefined&&value!==''&&(typeof value!=='object'||Object.values(value).some(hasCarrierValue))
function countryAddressCarriers(value,topLevel=true){
  for(const [key,field]of Object.entries(value)){
    if(!(topLevel&&LOCATION_FIELDS.has(key))&&/country|address/i.test(key))check(!hasCarrierValue(field),'Unreviewed native country/address carrier')
    if(field&&typeof field==='object')countryAddressCarriers(field,false)
  }
}
const INDIA_CITIES=new Set(['Pune','Mumbai','Bengaluru','Bangalore','Hyderabad','Chennai','Delhi','New Delhi','Gurgaon','Gurugram','Noida','Kolkata','Ahmedabad','Remote'])
const INDIA_STATES=new Set(('AN|Andaman and Nicobar Islands|AP|Andhra Pradesh|AR|Arunachal Pradesh|AS|Assam|BR|Bihar|CH|Chandigarh|CG|Chhattisgarh|DN|Dadra and Nagar Haveli|DD|Daman and Diu|DL|Delhi|GA|Goa|GJ|Gujarat|HR|Haryana|HP|Himachal Pradesh|JK|Jammu and Kashmir|JH|Jharkhand|KA|Karnataka|KL|Kerala|LA|Ladakh|LD|Lakshadweep|MP|Madhya Pradesh|MH|Maharashtra|MN|Manipur|ML|Meghalaya|MZ|Mizoram|NL|Nagaland|OD|OR|Odisha|PB|Punjab|PY|Puducherry|RJ|Rajasthan|SK|Sikkim|TN|Tamil Nadu|TS|Telangana|TR|Tripura|UP|Uttar Pradesh|UK|UT|Uttarakhand|WB|West Bengal').toLowerCase().split('|'))
const cityKey=value=>value.toLowerCase().replace(/\bbangalore\b/g,'bengaluru').replace(/\bgurgaon\b/g,'gurugram').replace(/\bnew delhi\b/g,'delhi')
const FOREIGN_IN_INDIA=/\b(?:United States|USA|United Kingdom|Australia|France|Germany|Canada|Singapore|Israel|Portugal|Brazil|Philippines|Mexico|New York|Sydney|Paris|London|Tokyo)\b|(?:^|[,\s/])(?:US|AU|FR|GB|UK|DE|CA|SG|IL|PT|BR|PH|MX|JP)(?=$|[,\s/])/i

function envelope(value){
  check(value&&typeof value==='object'&&!Array.isArray(value),'Native object unavailable')
  for(const [key,v]of Object.entries(value)){
    if(/^(?:error|errors|errorcode|errormessage|exception|fault)$/i.test(key.replace(/[_\s-]/g,''))&&v!=null)check(v===''||Array.isArray(v)&&v.length===0,'Native error envelope')
    if(/^(?:ok|success)$/i.test(key)&&v!=null)check(v===true,'Native failed envelope')
    if(/^(?:status|statuscode|code)$/i.test(key)&&v!=null)check(v===200,'Native status failure')
    if(/^(?:meta|metadata)$/i.test(key)&&v!=null)envelope(v)
  }
}
function instant(value,now){
  check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),'Native update timestamp unavailable')
  const d=new Date(value)
  check(Number.isFinite(+d)&&d.toISOString().replace('.000Z','Z')===value.replace('.000Z','Z')&&+d<=Date.parse(now),'Invalid/future native update calendar')
  return d.toISOString()
}
function company(html){
  const c=readNativeData(html,'COMPANY_DATA');envelope(c)
  check(c.name===COMPANY&&c.company_uid==='C0.008'&&c.slug==='checkmarx','Native employer/account mismatch')
  check(typeof c.website==='string','Native official website missing')
  const u=new URL(c.website)
  check(['http:','https:'].includes(u.protocol)&&['checkmarx.com','www.checkmarx.com'].includes(u.hostname)&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password,'Native official website identity changed')
  check(Array.isArray(c.company_domain_set)&&c.company_domain_set.length===1&&c.company_domain_set[0]==='checkmarx.com','Native company domain identity changed')
  check(c.url_comeet_hosted_page===BOARD&&c.url_recruit_hosted_page===BOARD,'Native public board identity changed')
  check(typeof c.show_apply_as_an_employee==='boolean'&&typeof c.allow_employee_only_positions==='boolean','Native application visibility configuration unavailable')
  return c
}
// Exact observed public US tracking data. These links are never fetched; role
// authority and reads continue to use the query-free Comeet UID URL. A changed
// raw query, country, visibility, UID or path must pass the original contract.
const REVIEWED_FOREIGN_TRACKING=Object.freeze({
  'A0.F64':'12bb8abcaa3cfb3436549c2947360f584a2f908d714e0f58a3799b63065960d2',
  '26.27C':'c7729e1321e21a4514bbae3ef0cf5f589dbec234d346ddc3403279fdb3a3ac5f',
})
function nativeURL(value,id,firstParty=false,foreignPublicTracking=false){
  check(typeof value==='string','Native role URL missing')
  const u=new URL(value)
  check(!u.hash&&!u.username&&!u.password,'Native role URL credentials/fragment changed')
  if(firstParty){
    // Native foreign records retain search/referral/share tracking and location
    // variants can point to the base role page. These raw links are data only:
    // visibility and actual reads use the query-free native public UID URL.
    const allowed=new Set([id,id.split('-')[0]])
    check(u.origin==='https://checkmarx.com'&&[...allowed].some(x=>u.pathname==='/job-openings/position/'+x+'/'||u.pathname==='/job-openings/position/'+x),'Native official role identity mismatch')
    const reviewedTracking=foreignPublicTracking&&Object.hasOwn(REVIEWED_FOREIGN_TRACKING,id)&&value===u.href&&u.pathname==='/job-openings/position/'+id+'/'&&createHash('sha256').update(u.search.slice(1)).digest('hex')===REVIEWED_FOREIGN_TRACKING[id]
    if(!reviewedTracking){
    const keys=[...u.searchParams.keys()]
    check(new Set(keys).size===keys.length&&keys.every(k=>['ref',';t','Share','utm_search_query','jr_id','employee','t'].includes(k)),'Native official tracking query changed')
    const params=u.searchParams
    check(!params.has('utm_search_query')||plain(params.get('utm_search_query')),'Native official search tracking malformed')
    check(!params.has('jr_id')||/^[a-f0-9]{24}$/.test(params.get('jr_id')),'Native official referral tracking malformed')
    check(!params.has('employee')||params.get('employee')===''&&params.has('Share')&&params.get('Share')===''&&params.has('t'),'Native official employee tracking malformed')
    // The declared board also publishes a standalone millisecond clock. Its
    // raw query remains data; native public identity uses the query-free UID.
    check(!params.has('t')||/^\d{13}$/.test(params.get('t'))&&(keys.length===1||params.has('Share')&&params.get('Share')===''&&params.has('employee')&&params.get('employee')===''),'Native official share tracking malformed')
    }
  }else check(!u.search&&u.origin==='https://www.comeet.com'&&new RegExp('^/jobs/checkmarx/C0\\.008/[a-z0-9-]+/'+id.replaceAll('.','\\.')+'$').test(u.pathname),'Native public role identity mismatch')
  return u.href
}
function geography(location,{allowMissingCountry=false}={}){
  envelope(location)
  countryAddressCarriers(location)
  const missingCountry=allowMissingCountry&&location.country===''
  check(missingCountry||typeof location.country==='string'&&Object.hasOwn(COUNTRIES,location.country),'Unknown/noncanonical native country')
  check(plain(location.name)&&(location.city===null||typeof location.city==='string')&&(location.state===null||typeof location.state==='string'),'Native city/state/label unavailable')
  check(location.is_remote===undefined||typeof location.is_remote==='boolean','Native remote field malformed')
  if(missingCountry)return location
  if(location.country==='IN'){
    check(plain(location.city)&&INDIA_CITIES.has(location.city),'Native India city is unverified or conflicting')
    check(!FOREIGN_IN_INDIA.test(location.name)&&!FOREIGN_IN_INDIA.test(location.city),'Native India/foreign label contradiction')
    check(/\bIndia\b/i.test(location.name)||/^IN(?:[,\s-]|$)/.test(location.name),'Native India country label unavailable')
    const name=cityKey(location.name),city=cityKey(location.city)
    check(new RegExp('\\b'+city+'\\b').test(name),'Native India city/label contradiction')
    check([...INDIA_CITIES].every(candidate=>!new RegExp('\\b'+cityKey(candidate)+'\\b').test(name)||cityKey(candidate)===city),'Native India label has conflicting cities')
    check(location.state===null||plain(location.state)&&INDIA_STATES.has(location.state.toLowerCase()),'Native India state is unverified or conflicting')
  }else{
    check(!/\bIndia\b/i.test(location.name)&&!/^IN(?:[,\s-]|$)/.test(location.name)&&!(location.city!=='Remote'&&INDIA_CITIES.has(location.city)),'Native foreign country contradicts India label/city')
  }
  return location
}
function record(row,now,{allowMissingCountry=false}={}){
  envelope(row)
  check(uid(row.uid)&&plain(row.name)&&row.company_name===COMPANY,'Native record ID/title/employer mismatch')
  check(typeof row.is_internal==='boolean','Native public/internal status must be a boolean')
  check(row.internal_use_custom_id==null||row.internal_use_custom_id===''||plain(row.internal_use_custom_id),'Native requisition malformed')
  for(const [key,value]of Object.entries(row)){
    if(/^(?:locations|secondary_locations|additional_locations|jobLocations|countries|location_object)$/i.test(key))check(value==null||Array.isArray(value)&&value.length===0,'Unverified secondary native location contract')
    if(/^(?:datePosted|posted_at|postedAt|postingDate|published_at|publication_date|closing_date|closingDate|closing_at|expires_at|expiration_date|endDate|validThrough)$/i.test(key))check(value==null,'Unverified native publication/closing date contract')
  }
  geography(row.location,{allowMissingCountry})
  const native=nativeURL(row.url_comeet_hosted_page,row.uid)
  check(row.url_recruit_hosted_page===native,'Native role canonical disagreement')
  const official=nativeURL(row.url_active_page,row.uid,true,row.location.country==='US'&&row.is_internal===false)
  check(row.url_detected_page===official,'Native official application URL disagreement')
  instant(row.time_updated,now)
  return row
}
export function parseCheckmarxBoard(html,{now=new Date().toISOString(),maxNativeRecords=300}={}){
  check(Number.isFinite(Date.parse(now))&&Number.isInteger(maxNativeRecords)&&maxNativeRecords>=1&&maxNativeRecords<=300,'Invalid bounded native options')
  const c=company(html),rows=readNativeData(html,'COMPANY_POSITIONS_DATA')
  check(Array.isArray(rows)&&rows.length>0&&rows.length<=maxNativeRecords,'Native board empty/unavailable/capped; company zero is unverified')
  rows.forEach(r=>record(r,now,{allowMissingCountry:true}))
  check(new Set(rows.map(r=>r.uid)).size===rows.length,'Duplicate native record IDs')
  const heldNativeRows=rows.filter(r=>r.location.country==='').map(row=>({uid:row.uid,reason:'native-country-missing',nativeRecord:structuredClone(row)}))
  return{company:c,rows,heldNativeRows,observedNativeBoardRecords:rows.length,companyGlobalTotal:null,companyIndiaTotal:null}
}
function section(html){
  if(typeof html!=='string')return null
  const text=activeText(html)
  if(/\b(?:this (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i.test(text))return null
  const substantive=text.split(/(?<=[.!?])\s+/).filter(s=>!/^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon)\b/i.test(s)&&!/^please\s+(?:check back|click apply now)\b/i.test(s)).join(' ').replace(/\b(?:Description|Requirements|Job Description|Apply now|Read more|Coming soon|Placeholder|Sample)\b/gi,'')
  return substantive.replace(/[^\p{L}\p{N}]/gu,'').length>=100?text:null
}
export function parseCheckmarxRole(html,row,{now=new Date().toISOString()}={}){
  check(row&&typeof row==='object','Native board row required')
  const c=company(html),p=record(readNativeData(html,'POSITION_DATA'),now)
  check(p.uid===row.uid&&p.name===row.name&&p.company_name===row.company_name&&p.internal_use_custom_id===row.internal_use_custom_id,'Native detail/board identity mismatch')
  check(JSON.stringify(p.location)===JSON.stringify(row.location)&&p.time_updated===row.time_updated&&p.url_comeet_hosted_page===row.url_comeet_hosted_page,'Native detail/board geography/clock/URL mismatch')
  check(p.is_internal===false&&row.is_internal===false,'Employee-only native role cannot qualify as public')
  check(p.location.country==='IN','Selected public role is not native India')
  check(p.description===undefined&&p.requirements===undefined,'Unverified flat native content contract')
  check(p.custom_fields&&typeof p.custom_fields==='object'&&!Array.isArray(p.custom_fields)&&Array.isArray(p.custom_fields.details),'Native content sections unavailable')
  const details=p.custom_fields.details
  check(details.length>0&&details.length<=20,'Native content sections empty or over bound')
  for(const f of details)check(f&&plain(f.name)&&(f.value===null||typeof f.value==='string')&&Number.isSafeInteger(f.order),'Native content section malformed')
  check(new Set(details.map(f=>f.name)).size===details.length,'Duplicate native content sections')
  const descriptionHtml=details.find(f=>f.name==='Description')?.value??null,requirementsHtml=details.find(f=>f.name==='Requirements')?.value??null
  const description=section(descriptionHtml),requirements=section(requirementsHtml)
  const full=description&&requirements&&description!==activeText(c.description||'')?details.filter(f=>f.value!=null).map(f=>activeText(f.value)).filter(Boolean).join('\n\n'):null
  const categories=p.custom_fields.categories
  check(Array.isArray(categories),'Native location categories unavailable')
  const workLocations=categories.filter(f=>f.name==='CX Work Location')
  check(workLocations.length===1&&workLocations[0].value===p.location.name,'Native work-location category contradicts typed geography')
  return{
    source:SOURCE,company:COMPANY,jobId:p.uid,requisitionId:p.internal_use_custom_id||null,title:p.name,
    country:'India',city:p.location.city,state:p.location.state||null,location:[p.location.city,p.location.state,'India'].filter(Boolean).join(', '),
    locations:[[p.location.city,p.location.state,'India'].filter(Boolean).join(', ')],
    sourceUrl:p.url_comeet_hosted_page,applyUrl:p.url_comeet_hosted_page,link:p.url_comeet_hosted_page,
    nativeFirstPartyApplicationURL:p.url_active_page,nativeEmployer:p.company_name,nativeLegalEmployer:null,
    nativeCompanyUID:c.company_uid,nativeIsInternal:p.is_internal,nativeApplyAsEmployeeOption:c.show_apply_as_an_employee,
    nativeLocation:{...p.location},nativeCountry:p.location.country,nativeUpdatedAt:instant(p.time_updated,now),
    postedAt:null,postingDate:null,closingDate:null,nativePublicationDate:null,nativeClosingDate:null,
    nativeDescriptionHtml:descriptionHtml,nativeRequirementsHtml:requirementsHtml,nativeContentSections:details.map(f=>({...f})),
    jobDescription:full,sourceDescription:full,sourceDetailComplete:Boolean(full),
    sourceDetailStatus:full?'complete':'native-full-description-missing',
    nativeEmploymentType:p.employment_type||null,employmentType:p.employment_type||null,
    nativeWorkplaceType:p.workplace_type||null,nativeIsRemote:p.location.is_remote??null,
    applicationAccess:'anonymous-public-native-position-page',applicationSubmitted:false,applicationVisited:false,activeApplyVerified:false,lifecycleCleanupAllowed:false,
    sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,
    sourceOfficialBindingCheckedAt:OFFICIAL_BINDING.checkedAt,sourceNativeCompanyIdentityCheckedAt:now,
    sourceOfficialHtmlFetchedAtRuntime:false,scrapedAt:now,
  }
}
