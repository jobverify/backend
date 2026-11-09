import {parseRmkListing,parseRmkDetail} from './successFactorsRmk.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {document,norm} from './rmkNativePairHtml.js'

const requireNative=(ok,message)=>{if(!ok){const e=Error('RMK source contract: '+message);e.incompleteScope=true;throw e}}
const one=(values,label)=>{requireNative(values.length===1,'Expected one '+label);return values[0]}
const link=(href,base)=>{const u=new URL(href,base);requireNative(!u.username&&!u.password,'Credentialed native URL');return u.href}
const links=(d,base)=>d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>link(n.attrs.href,base))
const property=(d,scope,name)=>d.nodes(n=>n.attrs.itemprop===name,scope)
const meta=(d,scope,name)=>property(d,scope,name).map(n=>n.attrs.content??d.text(n))
function advertisesNativeSearch(d,config){
 const defaults={q:'',locationsearch:'',sortColumn:'referencedate',sortDirection:'desc',startrow:'0',locale:'en_US',createNewAlert:'false'}
 const valid=value=>{
  try{
   const u=new URL(value,config.origin+'/')
   return u.protocol==='https:'&&u.origin===config.origin&&!u.username&&!u.password&&!u.href.includes('#')&&/^\/search\/?$/.test(u.pathname)
    &&[...new Set(u.searchParams.keys())].every(key=>u.searchParams.getAll(key).length===1&&Object.hasOwn(defaults,key)&&u.searchParams.get(key)===defaults[key])
  }catch{return false}
 }
 const forms=d.nodes(n=>n.tag==='form'&&n.attrs.method?.toLowerCase()==='get'&&valid(n.attrs.action||''))
 // Hidden controls still submit; uninstantiated template descendants do not.
 const domNodes=(predicate,node=d.root)=>node.tag==='template'?[]:[...(predicate(node)?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>domNodes(predicate,c))]
 const allDom=domNodes(()=>true),formElements=allDom.filter(n=>n.tag==='form')
 const unfilteredForm=form=>{
  const descendants=domNodes(()=>true,form),members=new Set(descendants),id=form.attrs.id
  if(Object.hasOwn(form.attrs,'id')&&(!id||allDom.filter(n=>n.attrs.id===id).length!==1))return false
  if(formElements.some(other=>other!==form&&(members.has(other)||domNodes(n=>n===form,other).length)))return false
  if(id&&allDom.some(n=>n.attrs.form===id&&!members.has(n)))return false
  const controls=descendants.filter(n=>['input','select','textarea','button'].includes(n.tag))
  // Unsupported owner/action/method overrides cannot establish this form's scope,
  // including nameless submitters that would otherwise disappear below.
  if(controls.some(n=>['form','formaction','formmethod'].some(key=>Object.hasOwn(n.attrs,key))))return false
  const named=controls.filter(n=>n.attrs.name&&!Object.hasOwn(n.attrs,'disabled'))
   .filter(n=>!['checkbox','radio'].includes((n.attrs.type||'').toLowerCase())||Object.hasOwn(n.attrs,'checked'))
  const defaultControl=n=>{
   if(n.tag==='input')return Object.hasOwn(defaults,n.attrs.name)&&(n.attrs.value||'')===defaults[n.attrs.name]
   // Captured Hershey hidden facets contain exactly one empty All option.
   if(n.tag!=='select'||Object.hasOwn(n.attrs,'multiple')||!/^optionsFacetsDD_(?:country|location|city|title|customfield[12])$/.test(n.attrs.name))return false
   const options=domNodes(child=>child.tag==='option',n)
   return options.length===1&&Object.hasOwn(options[0].attrs,'value')&&options[0].attrs.value===''
  }
  return new Set(named.map(n=>n.attrs.name)).size===named.length&&named.every(defaultControl)
 }
 return forms.some(unfilteredForm)||d.nodes(n=>n.tag==='a'&&n.attrs.href&&valid(n.attrs.href)).length>0
}
const date=value=>{
 if(!value)return null
 requireNative(typeof value==='string','Unreviewed native date type')
 const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2})))?$/)
 const native=value.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/)
 requireNative(iso||native,'Unreviewed native date format')
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
 const [year,month,day,hour,minute,second]=iso?[iso[1],iso[2],iso[3],iso[4]||0,iso[5]||0,iso[6]||0].map(Number):[Number(native[7]),months.indexOf(native[2])+1,...native.slice(3,7).map(Number)]
 const millisecond=iso?.[7]?Number(iso[7].slice(0,3).padEnd(3,'0')):0,calendar=new Date(0)
 requireNative(month>=1&&month<=12&&day>=1&&day<=31&&hour<=23&&minute<=59&&second<=59,'Invalid native calendar or time')
 calendar.setUTCFullYear(year,month-1,day);calendar.setUTCHours(hour,minute,second,millisecond)
 requireNative(calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day,'Invalid native calendar date')
 if(native)requireNative(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][calendar.getUTCDay()]===native[1],'Native date weekday conflicts with calendar')
 const offsetHours=Number(iso?.[10]||0),offsetMinutes=Number(iso?.[11]||0)
 requireNative(offsetHours<=23&&offsetMinutes<=59,'Invalid native date offset')
 const offset=(iso?.[9]==='-'?-1:1)*(offsetHours*60+offsetMinutes),time=Date.parse(value)
 requireNative(Number.isFinite(time)&&time===calendar.getTime()-offset*60000,'Malformed native date')
 return new Date(time).toISOString()
}
function verifyTenant(d,config){
 const tokens=d.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&!Object.hasOwn(n.attrs,'nomodule')&&['','text/javascript','application/javascript','module'].includes((n.attrs.type||'').toLowerCase())).flatMap(n=>{
  const lexical=[...(n.raw||'').matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|[^\s]/g)].map(m=>m[0]).filter(v=>!v.startsWith('/*')&&!v.startsWith('//')),values=[]
  for(let i=1;i<lexical.length-2;i++)if(/^(\x22|')ssoCompanyId\1$/.test(lexical[i])&&['{',','].includes(lexical[i-1])&&lexical[i+1]===':'){const m=lexical[i+2].match(/^(\x22|')([^\x22']+)\1$/);requireNative(m,'Nonliteral company token');values.push(m[2])}return values
 });requireNative(tokens.length>0&&tokens.every(t=>t===config.companyToken),'Native tenant mismatch')
}
export function parseNativeRole(html,row,config,now=new Date().toISOString()){
 const d=document(html);verifyTenant(d,config)
 // The source's own visible closure message overrides stale structured markup.
 if(/(?:this (?:job|position|requisition) is no longer active|job (?:is )?no longer available|position has been filled)/i.test(d.text(d.root)))return{excluded:true,reason:'native-visible-source-closed',publicId:row.jobId}
 const scope=one(d.nodes(n=>Object.hasOwn(n.attrs,'itemscope')&&/^https?:\/\/schema\.org\/JobPosting\/?$/.test((n.attrs.itemtype||'').trim())),'active JobPosting microdata')
 const title=norm(config.readNativeTitle?config.readNativeTitle(d,scope):d.text(one(property(d,scope,'title'),'native title')));requireNative(title===row.title,'Listing/detail title mismatch')
 const employer=one(meta(d,scope,'hiringOrganization'),'native employer label');requireNative(employer===config.nativeEmployer,'Native employer label mismatch')
 const visible=config.source==='hubbell'?parseRmkDetail(html,row,config).nativeLocations:[]
 const foreignVisible=config.allowForeignStreetAddressCountries===true?d.nodes(n=>n.attrs.class?.split(/\s+/).includes('jobGeoLocation'),scope).map(n=>d.text(n)):[]
 const foreignScopeMatches=config.allowForeignStreetAddressCountries===true&&Array.isArray(row.locations)&&foreignVisible.length===row.expectedLocationCount&&JSON.stringify([...foreignVisible].sort())===JSON.stringify([...row.locations].sort())
 const foreignStreetCode=a=>{
  if(!foreignScopeMatches||a.addressLocality!==null||a.addressRegion!==null||a.addressCountry!==null||a.postalCode!==null||typeof a.streetAddress!=='string'||!row.locations.includes(a.streetAddress))return null
  const parts=a.streetAddress.split(',').map(value=>value.trim()),code=parts.at(-1)
  return parts.length>=2&&parts.every(Boolean)&&/^[A-Z]{2}$/.test(code)&&code!=='IN'&&Array.isArray(row.nativeCountryCodes)&&row.nativeCountryCodes.includes(code)?code:null
 }
 const addresses=property(d,scope,'address').map(n=>{const read=p=>{const v=meta(d,n,p);requireNative(v.length<=1,'Ambiguous address field');return v[0]??null};const a={addressLocality:read('addressLocality'),addressRegion:read('addressRegion'),addressCountry:read('addressCountry'),postalCode:read('postalCode'),streetAddress:read('streetAddress')};const explicitCode=config.caseInsensitiveNativeCountryCodes===true&&typeof a.addressCountry==='string'?a.addressCountry.toUpperCase():a.addressCountry,foreignCode=foreignStreetCode(a);return{...a,nativeCountryCode:explicitCode||(/^[A-Z]{2}$/.test(a.streetAddress||'')&&visible.includes(a.streetAddress)?a.streetAddress:null)||foreignCode,countryEvidence:a.addressCountry?'native-addressCountry':a.streetAddress&&visible.includes(a.streetAddress)?'native-country-only-visible-location-corroborated-by-streetAddress':foreignCode?'native-full-streetAddress-explicit-foreign-country-corroborated':null}})
 requireNative(addresses.length===row.expectedLocationCount&&addresses.every(a=>/^[A-Z]{2}$/.test(a.nativeCountryCode||'')),'Native detail/listing address count or typed country mismatch')
 const primary=addresses.find(a=>a.nativeCountryCode===row.countryCode&&(norm(a.addressLocality).toLowerCase()===row.locations[0].split(',')[0].trim().toLowerCase()||row.locations[0]===row.countryCode&&a.streetAddress===row.countryCode&&visible.includes(row.countryCode)))
 requireNative(primary,'Native primary location disagrees with listing')
 const india=addresses.filter(a=>a.nativeCountryCode==='IN')
 if(!india.length)return{excluded:true,reason:'native-addresses-all-outside-India',publicId:row.jobId,nativeAddresses:addresses}
 const applications=[...new Set(links(d,row.sourceUrl).filter(u=>new URL(u).pathname.includes('/talentcommunity/apply/')))]
 requireNative(applications.length>0&&applications.every(u=>new URL(u).origin===config.origin&&new URL(u).pathname==='/talentcommunity/apply/'+row.jobId+'/'),'Native application/public identity mismatch')
 let requisitionId=null
 if(config.requisitionProperty){const req=one(d.nodes(n=>n.attrs['data-careersite-propertyid']===config.requisitionProperty),'native requisition field');requisitionId=d.text(req);requireNative(/^[1-9]\d*$/.test(requisitionId),'Native requisition unavailable')}
 const descriptions=property(d,scope,'description');requireNative(descriptions.length<=1,'Multiple native descriptions')
 const description=descriptions[0]?d.inner(descriptions[0]):null,plain=descriptions[0]?d.text(descriptions[0]):''
 // Section evidence establishes role content; employer boilerplate alone does not.
 const detailComplete=plain.length>=180&&/(?:responsibilit|accountabilit|duties|what will help you thrive|a day in the life|minimum (?:education|requirements)|qualifications|what (?:you will|will you) do|experience guiding|essential functions)/i.test(plain)
 const placement=plain.match(/\b(?:this role|this position)\s+(?:is|will be)\s+(?:based|located)\s+in\s+(United States|United Kingdom|Canada|Australia|India)\b/i)
 if(placement&&placement[1].toLowerCase()!=='india')return{excluded:true,reason:'explicit-role-placement-contradicts-native-India-address',placementEvidence:placement[0],publicId:row.jobId,nativeAddresses:addresses,nativeDescriptionHTML:description}
 const posted=meta(d,scope,'datePosted'),closing=meta(d,scope,'validThrough');requireNative(posted.length<=1&&closing.length<=1,'Ambiguous source dates')
 const nativeDatePosted=posted[0]??null,nativeValidThrough=closing[0]??null,postingDate=date(nativeDatePosted),closingDate=date(nativeValidThrough)
 const exactClosing=Boolean(nativeValidThrough&&/(?:T|\s)\d{2}:\d{2}/.test(nativeValidThrough)&&/(?:UTC|GMT|Z\s*$|[+-]\d{2}:?\d{2})/i.test(nativeValidThrough))
 const job={source:config.source,company:config.companyName,jobId:requisitionId||row.jobId,requisitionId,nativePublicJobId:row.jobId,title,
  nativeEmployerLabel:employer,nativeEmployer:employer,legalEmployer:null,originalPublicationDate:null,sourceUrl:row.sourceUrl,applyUrl:applications[0],link:applications[0],
  nativeLocations:addresses,location:india.map(a=>[a.addressLocality,a.addressRegion,'India'].filter(Boolean).join(', ')).join(' / '),country:'India',city:india.length===1?india[0].addressLocality:null,
  jobDescription:description,sourceDescription:description,nativeDescriptionHTML:description,nativeJobPostingHTML:d.outer(scope),nativeJobPosting:null,
  nativeMicrodata:{title,hiringOrganization:employer,jobLocation:addresses,datePosted:nativeDatePosted,validThrough:nativeValidThrough,description},
  nativeDatePosted,nativeDatePostedPrecision:nativeDatePosted?(/\d{2}:\d{2}/.test(nativeDatePosted)?'second':'day'):null,nativeDatePostedMeaning:'native-public-post-date-original-requisition-publication-unknown',
  nativeValidThrough,nativeValidThroughPrecision:nativeValidThrough?(exactClosing?'second':'day'):null,nativeValidThroughMeaning:'native-validThrough-application-deadline-not-independently-confirmed',
  postingDate,postedAt:postingDate,closingDate,sourceClosingDateIsExact:exactClosing,sourceDetailComplete:detailComplete,sourceDetailStatus:detailComplete?'complete':'partial',sourceListingComplete:false,sourceScopeComplete:false,sourceLocationCorroborationComplete:true,scrapedAt:now}
 if(!detailComplete)job.sourceDetailFailureKind='missing-content'
 return job
}
export async function runNative(config,{fetchText,signal,now=new Date().toISOString()}={}){
 requireNative(Number.isFinite(Date.parse(now)),'Invalid observation clock')
 const activeSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(540000)]):AbortSignal.timeout(540000)
 const approveURL=(value,expectedOrigin=null)=>{
  const u=new URL(value),corporate=new URL(config.home)
  requireNative(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&[config.origin,corporate.origin].includes(u.origin)&&(!expectedOrigin||u.origin===expectedOrigin),'Unapproved native GET or redirect origin/credentials')
  if(u.origin===corporate.origin)requireNative(!u.search&&[corporate.pathname,config.homeRedirectPath].filter(Boolean).includes(u.pathname),'Unapproved corporate redirect path')
  else{
   requireNative(/^\/(?:search\/?|job\/[^/]+\/\d+\/)?$/.test(u.pathname),'Unapproved native GET or redirect path')
   if(/^\/search\/?$/.test(u.pathname)){
    const allowed={q:'',sortColumn:'referencedate',sortDirection:'desc'}
    for(const key of new Set(u.searchParams.keys()))requireNative(u.searchParams.getAll(key).length===1&&(key==='startrow'?/^\d{1,5}$/.test(u.searchParams.get(key))&&Number(u.searchParams.get(key))<=10000:Object.hasOwn(allowed,key)&&u.searchParams.get(key)===allowed[key]),'Unapproved native GET or redirect query')
   }else requireNative(!u.search,'Unapproved native GET or redirect query')
  }
  return u
 }
 const get=async url=>{
  activeSignal.throwIfAborted();const initial=approveURL(url)
  if(fetchText)return fetchText(url,{signal:activeSignal})
  const visited=new Set();let current=initial
  for(let hop=0;hop<=5;hop++){
   activeSignal.throwIfAborted();requireNative(!visited.has(current.href),'Native redirect loop');visited.add(current.href)
   const requestSignal=AbortSignal.any([activeSignal,AbortSignal.timeout(30000)])
   const r=await fetch(current.href,{method:'GET',redirect:'manual',signal:requestSignal,headers:{accept:'text/html','user-agent':'Mozilla/5.0'}});let consumed=false
   try{
    requireNative(!r.redirected&&r.url===current.href,'Native fetch followed an unvalidated redirect')
    if([301,302,303,307,308].includes(r.status)){
     const location=r.headers.get('location');requireNative(typeof location==='string'&&location.trim().length>0,'Native redirect Location missing')
     requireNative(hop<5,'Native redirect hop bound exceeded')
     let destination;try{destination=new URL(location,current)}catch{requireNative(false,'Native redirect invalid URL')}
     current=approveURL(destination.href,initial.origin);requireNative(!visited.has(current.href),'Native redirect loop')
     continue
    }
    requireNative(r.ok,'Native HTTP '+r.status);requestSignal.throwIfAborted()
    const html=await r.text();consumed=true;requestSignal.throwIfAborted();return html
   }finally{if(!consumed&&r.body)try{await r.body.cancel()}catch{/* Preserve the original HTTP, abort, or validation failure. */}}
  }
  requireNative(false,'Native redirect hop bound exceeded')
 }
 const home=document(await get(config.home)),careers=document(await get(config.origin+'/'))
 requireNative(links(home,config.home).includes(config.origin+'/'),'Current corporate career handoff missing')
 requireNative(advertisesNativeSearch(careers,config),'Current advertised GET search missing or changed origin/scope')
 const search=config.origin+'/search/',rows=[],seen=new Set();let next=search,total=null,pages=0,first=null
 while(next){requireNative(++pages<=100,'Native pagination bound exceeded');const p=parseRmkListing(await get(next),config);if(total===null){total=p.total;first=p}requireNative(p.total===total&&p.start===rows.length+1,'Changed native total/range');for(const row of p.jobs){requireNative(!seen.has(row.jobId),'Duplicate native public ID');seen.add(row.jobId);rows.push(row)}next=p.nextUrl
  if(next){const u=new URL(next);requireNative(u.origin===config.origin&&u.pathname.replace(/\/$/,'')==='/search'&&!u.hash,'Unapproved continuation');const allowed={q:'',sortColumn:'referencedate',sortDirection:'desc',startrow:String(p.end)};for(const key of new Set(u.searchParams.keys()))requireNative(u.searchParams.getAll(key).length===1&&Object.hasOwn(allowed,key)&&u.searchParams.get(key)===allowed[key],'Native pagination scope changed');requireNative(u.searchParams.get('startrow')===String(p.end),'Wrong native continuation')}
 }
 requireNative(total===rows.length,'Native inventory does not reconcile')
 const jobs=[],excluded=[],ids=new Set()
 for(const row of rows.filter(r=>r.countryCode==='IN'||r.expectedLocationCount>r.locations.length)){const job=parseNativeRole(await get(row.sourceUrl),row,config,now);if(job.excluded)excluded.push(job);else{requireNative(!ids.has(job.jobId),'Duplicate native requisition identity');ids.add(job.jobId);jobs.push(job)}}
 const closure=parseRmkListing(await get(search),config);requireNative(closure.total===total&&JSON.stringify(closure.jobs)===JSON.stringify(first.jobs),'Native inventory changed during capture')
 activeSignal.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,surface:search,pagesFetched:pages,reportedTotal:total,indiaFacetCount:jobs.length,verifiedAt:now,reason:'full-native-rmk-pagination-and-detail-corrob;whole-employer-and-original-publication-unknown;cleanup-forbidden;excluded-public-ids:'+excluded.map(x=>x.publicId+':'+x.reason).join(',')})
}
