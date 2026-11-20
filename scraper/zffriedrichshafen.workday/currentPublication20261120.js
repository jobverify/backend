import {setTimeout as delay} from 'node:timers/promises'
import {isDeepStrictEqual} from 'node:util'
import {document,decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {verifyRmkCompanyToken,readRmkLocationCountry} from '../../scraper-support/shared/successFactorsRmk.js'
import {nativeDate,nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='zffriedrichshafen',COMPANY='ZF Friedrichshafen',NATIVE_BRAND='ZF Group',HOME='https://www.zf.com/india/en/careers/careers.html',ORIGIN='https://jobs.zf.com',TOKEN={companyToken:'zffriedric'}
const norm=s=>String(s??'').replace(/\s+/g,' ').trim(),need=(ok,message)=>{if(!ok)throw Object.assign(Error('ZF current publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const one=(values,label)=>{need(values.length===1,'unique '+label+' unavailable');return values[0]},classes=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
function page(html){const d=document(html);need(!d.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'unreviewed native navigation');return d}
const safeURL=(href,base)=>{const u=new URL(href,base);need(u.origin===ORIGIN&&!u.username&&!u.password&&!u.hash,'native URL leaves own publisher');return u}
const disabled=n=>Object.hasOwn(n.attrs,'disabled')||n.attrs['aria-disabled']==='true'||classes(n,'disabled')
function utcDate(value){
 const m=typeof value==='string'&&/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value)
 if(!m)return nativeDate(value,{required:true})
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],t=new Date(Date.UTC(+m[7],months.indexOf(m[2]),+m[3],+m[4],+m[5],+m[6]))
 need(t.getUTCFullYear()===+m[7]&&t.getUTCMonth()===months.indexOf(m[2])&&t.getUTCDate()===+m[3]&&t.getUTCHours()===+m[4]&&t.getUTCMinutes()===+m[5]&&t.getUTCSeconds()===+m[6]&&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getUTCDay()]===m[1],'invalid native UTC calendar')
 return{raw:value,iso:t.toISOString(),exact:true,precision:'second'}
}
function workplaceCountries(value){
 const found=new Set(),words=String(value).match(/[\p{L}]+/gu)??[]
 for(let start=0;start<words.length;start++)for(let length=1;length<=5&&start+length<=words.length;length++){const phrase=words.slice(start,start+length).join(' ');if(phrase.length>3){const country=nativeCountryName(phrase);if(country)found.add(country)}}
 for(const part of String(value).split(/[/|;]/)){if(!part.includes(','))continue;let code;try{code=readRmkLocationCountry(part)}catch{continue}const country=nativeCountryName(code);if(country)found.add(country)}
 return [...found]
}
function wholeWorkplaceCountry(value){const code=readRmkLocationCountry(value),country=nativeCountryName(code);need(workplaceCountries(value).every(found=>found===country),'native whole workplace contains contradictory countries');return code}
function authoredScopeLines(d){
 const blocks=new Set(['address','article','aside','blockquote','dd','details','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','pre','section','summary','table','tbody','td','th','thead','tr','ul','br'])
 const walk=n=>{if(n.inactive||n.tag==='script')return '';const value=n.children.map(c=>typeof c==='string'?c:walk(c)).join(' ');return blocks.has(n.tag)||n.attrs?.itemprop==='description'?'\n'+value+'\n':value}
 return [...new Set([...decode(walk(d.root)).split(/\n+/).map(norm),...d.nodes(n=>n.tag==='span'&&!d.nodes(child=>child!==n&&(blocks.has(child.tag)||child.tag==='span'),n).length).map(d.text)].filter(Boolean))]
}
function publicationFields(fields,at=new Date().toISOString(),dates){
 const positive=new Set(['active','isactive','published','ispublished','posted','isposted','open','isopen','canapply','allowapplications','acceptingapplications']),negative=new Set(['closed','isclosed','expired','isexpired','archived','isarchived','disabled','isdisabled','removed','isremoved','deleted','isdeleted'])
 for(const {key,value}of fields){const field=key.replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase(),raw=typeof value==='string'?value.trim().toLowerCase():value
  if(positive.has(field))need(raw===true||raw==='true','native publication explicitly unavailable: '+key)
  if(negative.has(field))need(raw===false||raw==='false','native publication explicitly unavailable: '+key)
  if(['status','jobstatus','postingstatus','publicationstatus','availability','availabilitystatus'].includes(field))need(typeof raw==='string'&&/^(?:open|active|published|available|approved|accepting applications)\b/.test(raw),'native publication status unavailable: '+key)
  if(['company','companyname','employer','employername','legalemployer','hiringorganization'].includes(field))need([COMPANY,NATIVE_BRAND].includes(value),'native publication employer conflict: '+key)
  if(['country','countrycode','jobcountry','workcountry','addresscountry'].includes(field))need(nativeCountryName(value)==='India','native publication country conflict: '+key)
  const deadline=['validthrough','closingdate','applicationdeadline','expirydate'].includes(field),publication=['dateposted','postingdate','publishedat'].includes(field)
  if(deadline||publication){let parsed;try{parsed=utcDate(value)}catch{need(false,'malformed native publication date: '+key)}need(deadline?(parsed.exact?Date.parse(parsed.iso)>=Date.parse(at):parsed.iso.slice(0,10)>=at.slice(0,10)):Date.parse(parsed.iso)<=Date.parse(at),deadline?'native role expired':'native publication date in future');if(dates)dates[deadline?'expiries':'publications'].push({field:key,...parsed})}
 }
}
function constraints(html,properties,at){
 const d=page(html),root=d.root,lines=authoredScopeLines(d),dates={publications:[],expiries:[]}
 publicationFields(properties,at,dates)
 need(!findExplicitNativeClosure([d.text(root),...lines]),'native role explicitly closed')
 const date=(raw,deadline,label)=>{const value=utcDate(raw),now=Date.parse(at);need(deadline?(value.exact?Date.parse(value.iso)>=now:value.iso.slice(0,10)>=at.slice(0,10)):Date.parse(value.iso)<=now,deadline?'native role expired':'native publication date in future');dates[deadline?'expiries':'publications'].push({field:label,...value})}
 for(const {key,value}of properties){
  if(['country','countryCode','addressCountry','workCountry'].includes(key)&&value)need(nativeCountryName(value)==='India','native explicit country conflict')
  if(['hiringOrganization','employer','company','legalEmployer'].includes(key))need([COMPANY,NATIVE_BRAND].includes(value),'native employer conflict')
  if(['isClosed','closed','archived','isArchived','expired','isExpired'].includes(key))need(value==='false','native publication explicitly closed')
  if(['canApply','isActive','isPublished'].includes(key))need(value==='true','native publication disabled')
  if(['status','jobStatus','publicationStatus'].includes(key))need(/^(?:open|active|published|approved)$/i.test(value),'native publication status unavailable')
 }
 for(const line of lines){const m=/^([^:]{1,40}):\s*(.+)$/.exec(norm(line));if(!m)continue;const label=m[1],value=m[2]
  if(/^(?:employer|company(?: name)?|legal employer|hiring organization)$/i.test(label))need([COMPANY,NATIVE_BRAND].includes(value),'native authored employer conflict')
  if(/^(?:(?:job|work|workplace) )?country$/i.test(label))need(nativeCountryName(value)==='India','native authored country conflict')
  if(/^(?:(?:job|work) )?(?:location|workplace)$/i.test(label)){const c=nativeLocationCountryName(value);need((!c||c==='India')&&workplaceCountries(value).every(country=>country==='India'),'native authored workplace conflict')}
  if(/^(?:(?:job|publication|posting) )?(?:status|availability)$/i.test(label))need(!/^(?:draft|closed|filled|inactive|unpublished|not\s+published|disabled|expired|archived)\b/i.test(value),'native authored publication unavailable')
  if(/^(?:closing date|application deadline|valid through|expiry date)$/i.test(label))date(value,true,label)
  if(/^(?:date posted|posted date|publication date|posting date)$/i.test(label))date(value,false,label)
 }
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso));return dates
}
export function readCurrentListing(html,url,at=new Date().toISOString()){
 verifyRmkCompanyToken(html,TOKEN);const d=page(html),table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'native result table'),range=/Page (\d+) of (\d+), Results (\d+) to (\d+) of (\d+)/i.exec(table.attrs['aria-label']??'')
 need(range&&+range[1]>=1&&+range[2]<=20&&+range[3]>=1&&+range[4]<=+range[5]&&+range[5]<=1000,'native range/accounting unavailable')
 const rows=d.nodes(n=>n.tag==='tr'&&classes(n,'data-row'),table).map(n=>{
  const links=d.nodes(a=>a.tag==='a'&&classes(a,'jobTitle-link'),n),href=one([...new Set(links.map(a=>a.attrs.href))],'same native role link'),title=one([...new Set(links.map(d.text))],'native title'),u=safeURL(href,url),m=/^\/job\/[^/]+\/(\d+)\/$/.exec(u.pathname)
  need(m&&title&&!u.search&&links.every(a=>!disabled(a)),'native role identity unavailable')
  const nativeLocationLabels=[...new Set(d.nodes(a=>classes(a,'jobLocation')&&!d.nodes(c=>c!==a&&classes(c,'jobLocation'),a).length,n).map(d.text))],additionalCounts=nativeLocationLabels.map(value=>Number(value.match(/\+(\d+)\s+more(?:\u2026|\.{3})?\s*$/iu)?.[1]??0)),additionalLocationCount=Math.max(...additionalCounts),locations=[...new Set(nativeLocationLabels.map(value=>value.replace(/\s*\+\d+\s+more(?:\u2026|\.{3})?\s*$/iu,'')))],countryCodes=locations.map(readRmkLocationCountry)
  need(additionalLocationCount<=20&&new Set(additionalCounts.filter(Boolean)).size<=1,'Native additional workplace count conflicts')
  need(locations.length>0&&new Set(countryCodes).size===1,'native workplace alternatives disagree')
  let nativePublicationFailure=null;try{for(const node of [n,...links])publicationFields(Object.entries(node.attrs).map(([key,value])=>({key,value})),at)}catch(error){if(error.failureKind!=='parser_or_contract_error')throw error;nativePublicationFailure=error.message}
  return{nativePublicationFailure,jobId:m[1],title,sourceUrl:u.href,locations,nativeLocationLabels,additionalLocationCount,countryCode:countryCodes[0],nativeFields:d.nodes(a=>a.tag==='td',n).map(a=>({headers:a.attrs.headers??null,text:d.text(a)})),nativeAttributes:n.attrs,nativeControlAttributes:links.map(node=>node.attrs),originalRowHTML:d.outer(n)}
 })
 need(rows.length===+range[4]-+range[3]+1&&new Set(rows.map(r=>r.jobId)).size===rows.length,'native page identities/count disagree')
 let next=null;if(+range[1]<+range[2]){const link=one([...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.title==='Page '+(+range[1]+1)).map(n=>n.attrs.href))],'native next page');const u=safeURL(link,url);need(u.pathname==='/search/'&&u.searchParams.get('optionsFacetsDD_country')==='IN','native continuation scope changed');next=u.href}
 return{rows,total:+range[5],start:+range[3],end:+range[4],next}
}
const rowModel=row=>({nativePublicationFailure:row.nativePublicationFailure,jobId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,locations:row.locations,nativeLocationLabels:row.nativeLocationLabels,additionalLocationCount:row.additionalLocationCount,countryCode:row.countryCode,nativeFields:row.nativeFields,nativeAttributes:row.nativeAttributes,nativeControlAttributes:row.nativeControlAttributes})
export function readCurrentRole(html,row,at=new Date().toISOString()){
 for(const attributes of [row.nativeAttributes??{},...row.nativeControlAttributes??[]])publicationFields(Object.entries(attributes).map(([key,value])=>({key,value})),at);need(!row.nativePublicationFailure,'native row publication withheld: '+row.nativePublicationFailure)
 verifyRmkCompanyToken(html,TOKEN);const d=page(html),owner=one(d.nodes(n=>n.attrs.itemtype==='http://schema.org/JobPosting'||n.attrs.itemtype==='https://schema.org/JobPosting'),'native JobPosting'),prop=key=>d.nodes(n=>(n.attrs.itemprop??'').split(/\s+/).includes(key),owner),value=key=>{const nodes=prop(key);need(nodes.length<=1,'ambiguous native '+key);return nodes[0]?.attrs.content??(nodes[0]?d.text(nodes[0]):null)}
 publicationFields(Object.entries(owner.attrs).map(([key,value])=>({key,value})),at)
 need(value('title')===row.title&&value('hiringOrganization')===NATIVE_BRAND,'native own role title/employer conflict')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical URL').attrs.href;need(canonical===row.sourceUrl,'native canonical role identity conflict')
 const copyright=d.nodes(n=>n.tag==='footer'||classes(n,'footer')).map(d.text).filter(t=>t.includes('ZF Friedrichshafen AG'));need(copyright.length>0,'Current native publisher ownership unbound')
 const typedPlaces=prop('address').map(address=>{const fields=d.nodes(n=>n.attrs.itemprop,address).flatMap(n=>n.attrs.itemprop.split(/\s+/).filter(Boolean).map(key=>({key,value:n.attrs.content??d.text(n)}))),get=key=>one(fields.filter(p=>p.key===key).map(p=>p.value),'typed '+key),country=get('addressCountry'),city=get('addressLocality'),state=fields.find(p=>p.key==='addressRegion')?.value??null,postal=fields.find(p=>p.key==='postalCode')?.value??null;need(nativeCountryName(country)==='India'&&city,'Native typed workplace outside India');return{country,city,state,postal,fields,attributes:address.attrs}})
 const street=d.nodes(n=>n.attrs.id==='job-location',owner).flatMap(node=>{const places=d.nodes(n=>classes(n,'jobGeoLocation'),node);return places.length?places.map(d.text):[d.text(node)]});need(typedPlaces.length>0&&typedPlaces.length<=32&&street.length===row.locations.length+row.additionalLocationCount&&typedPlaces.length===street.length&&row.locations.every(location=>street.includes(location))&&street.every(s=>wholeWorkplaceCountry(s)==='IN')&&row.countryCode==='IN','Native whole typed/listing/visible workplace conflict')
 for(const p of typedPlaces)need(street.some(s=>{const parts=s.split(',').map(norm);return parts[0]===p.city&&(!p.state||parts.includes(p.state))&&(!p.postal||parts.includes(p.postal))}),'Native typed city/region/postcode contradicts whole workplace')
 const descriptions=prop('description');need(descriptions.length<=1,'native criteria ownership ambiguous');const description=descriptions[0]?d.inner(descriptions[0]):null,properties=d.nodes(n=>n.attrs.itemprop,owner).flatMap(n=>n.attrs.itemprop.split(/\s+/).filter(key=>key&&!['description','jobLocation','address','title'].includes(key)).map(key=>({key,value:n.attrs.content??d.text(n)}))),dates=constraints(d.inner(owner),properties,at)
 need(!findExplicitNativeClosure([d.text(owner)]),'native role page explicitly closed')
 const applications=d.nodes(n=>n.tag==='a'&&n.attrs.href?.includes('/talentcommunity/apply/'));need(applications.length>0&&applications.every(a=>!disabled(a)),'native application unavailable')
 for(const attributes of [row.nativeAttributes??{},...row.nativeControlAttributes??[],...[owner,...prop('title'),...d.nodes(n=>n.attrs.id==='job-location',owner),...applications].map(node=>node.attrs)])publicationFields(Object.entries(attributes).map(([key,value])=>({key,value})),at,dates)
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso))
 const urls=[...new Set(applications.map(n=>new URL(n.attrs.href,row.sourceUrl).href))],application=one(urls,'native same-role application URL'),u=safeURL(application,row.sourceUrl)
 need(u.pathname==='/talentcommunity/apply/'+row.jobId+'/'&&[...u.searchParams].every(([k,v])=>k==='locale'&&['en_US','en_GB'].includes(v)),'native application requisition identity conflict')
 return{source:SOURCE,company:COMPANY,jobId:row.jobId,requisitionId:/\bReq ID\s+(\d+)\s*\|/.exec(d.text(owner))?.[1]??null,nativePublicJobId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,applyUrl:application,link:application,country:'India',city:null,state:null,location:street.join(' / '),nativeEmployerDisplayName:NATIVE_BRAND,sourceLegalEmployer:null,sourceNativeEmployerScope:{kind:'own-ZF-group-publisher;original-per-role-legal-labels-retained-in-criteria',publisherCopyright:copyright[0],legalEmployerRelabelled:false},sourceNativeListingRecord:row,sourceNativeRoleHTML:d.outer(owner),sourceNativeProperties:properties,sourceNativeWorkplaces:street,sourceNativeTypedPlaces:typedPlaces,
  sourceCountryEvidence:{kind:'same-own-role-explicit-PostalAddress-country+whole-native-listing-and-visible-workplace',nativeCountryCode:'IN',typedAddressCountryInvented:false,originalWorkplaces:street},sourceNativeWorkplaceMultiplicity:{publishedAddressCount:typedPlaces.length,visibleLocationCount:street.length,listingAdditionalLocationCount:row.additionalLocationCount},sourceDescription:description,jobDescription:description,postingDate:dates.publications[0]?.iso??null,closingDate:dates.expiries[0]?.iso??null,sourceNativeDates:dates,
  sourceNativeApplication:{kind:'own-current-role-declared-exact-public-ID-application-link',url:application,controlsQualified:false,activationVerified:false,submitted:false},sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-published-criteria-and-own-application-link;full-renderer-and-application-controls-unverified',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,scrapedAt:at}
}
function publicationCore(job){
 const places=job.sourceNativeTypedPlaces.map(({country,city,state,postal})=>({country:nativeCountryName(country),city,state,postal})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return{source:job.source,company:job.company,jobId:job.jobId,nativePublicJobId:job.nativePublicJobId,requisitionId:job.requisitionId,title:job.title,sourceUrl:job.sourceUrl,applyUrl:job.applyUrl,country:job.country,nativeEmployerDisplayName:job.nativeEmployerDisplayName,sourceLegalEmployer:job.sourceLegalEmployer,workplaces:[...job.sourceNativeWorkplaces].sort(),places}
}
function closePartialPublication(job,opening,closing){
 need(typeof opening.sourceNativeRoleHTML==='string'&&typeof closing.sourceNativeRoleHTML==='string'&&isDeepStrictEqual(publicationCore(opening),publicationCore(closing)),'closing native publisher/identity/employer/workplace/application binding changed')
 const {sourceNativeRoleHTML:openingHTML,...a}=opening,{sourceNativeRoleHTML:closingHTML,...b}=closing
 job.sourceNativeCriteriaStable=isDeepStrictEqual(a,b)
 job.sourceNativeDates=Object.fromEntries(['publications','expiries'].map(key=>[key,[...opening.sourceNativeDates[key],...closing.sourceNativeDates[key]].sort((left,right)=>left.iso.localeCompare(right.iso))]))
 job.postingDate=job.sourceNativeDates.publications[0]?.iso??null;job.closingDate=job.sourceNativeDates.expiries[0]?.iso??null
 if(!job.sourceNativeCriteriaStable){
  job.sourceNativeCriteriaVariants=[{phase:'opening',description:opening.sourceDescription,properties:opening.sourceNativeProperties,dates:opening.sourceNativeDates,originalRoleHTML:openingHTML},{phase:'closing',description:closing.sourceDescription,properties:closing.sourceNativeProperties,dates:closing.sourceNativeDates,originalRoleHTML:closingHTML}]
  job.sourceDetailFailureKind+=';native-criteria-revision-both-original-variants-retained'
 }
 job.sourceNativeRoleClosingQualified=true
}
export async function runCurrentPublications(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original HTTP metadata transport required')
 const at=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid observation clock')
 const duration=options.sourceTimeoutMs??180000,interval=options.requestIntervalMs??500;need(Number.isSafeInteger(duration)&&duration>0&&duration<=180000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid source bounds')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('ZF source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,allowed=new Set([HOME]),originalResponses=[],held=[],optionalRoleFailures=[]
 let requests=0,bytes=0,last=0,denied=false
 async function read(url){signal.throwIfAborted();need(!denied&&allowed.has(url)&&++requests<=128,'unbound public read or source request budget');const wait=interval-(performance.now()-last);if(wait>0)await delay(wait,undefined,{signal});last=performance.now()
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:Error('ZF streamed entity bound'),fetchImpl:async(u,init)=>{const r=await(options.fetchImpl??globalThis.fetch)(u,{...init,credentials:'omit',cache:'no-store'});try{need(r?.url===u&&r.redirected===false&&r.headers?.get&&r.body,'original HTTP identity unavailable');if(r.status!==200){if([202,401,402,403,406,407,429,451].includes(r.status))denied=true;throw Object.assign(Error('ZF native HTTP '+r.status),{status:r.status})}need(/^text\/html(?:;|$)/i.test(r.headers.get('content-type')??''),'native HTML MIME unavailable');return r}catch(error){try{Promise.resolve(r?.body?.cancel(error)).catch(()=>{})}catch{}throw error}}})
  const body=Buffer.from(packet.bodyBase64,'base64');bytes+=body.length;need(body.length<=2*1024*1024&&bytes<=32*1024*1024,'native entity/aggregate byte bound');const html=new TextDecoder('utf8',{fatal:true}).decode(body);originalResponses.push({requestedUrl:url,status:packet.status,originalBody:html});return html
 }
 async function phase(){
  const corporate=page(await read(HOME)),targets=corporate.nodes(n=>n.tag==='a'&&corporate.text(n)==='Search jobs'&&n.attrs.href).map(n=>new URL(n.attrs.href,HOME)).filter(u=>u.origin===ORIGIN&&u.pathname==='/search/'&&u.searchParams.get('optionsFacetsDD_country')==='IN');need(targets.length===1&&!targets[0].username&&!targets[0].password&&!targets[0].hash,'Current corporate-declared own India careers handoff unavailable')
  let url=targets[0],rows=[],pages=[]
  while(url){allowed.add(url.href);const parsed=readCurrentListing(await read(url.href),url.href,at);need(pages.length<5&&parsed.start===rows.length+1&&(!pages.length||parsed.total===pages[0].total),'Native pagination accounting changed');pages.push(parsed);rows.push(...parsed.rows);url=parsed.next?new URL(parsed.next):null}
  need(rows.length===pages[0].total&&new Set(rows.map(r=>r.jobId)).size===rows.length,'Native listing total/distinct IDs disagree');return{rows,pages:pages.map(p=>({start:p.start,end:p.end,total:p.total,next:p.next})),corporateIndiaTarget:targets[0].href}
 }
 async function qualify(row){const html=await read(row.sourceUrl);try{return readCurrentRole(html,row,at)}catch(error){signal.throwIfAborted();if(error.failureKind==='parser_or_contract_error')throw error;throw Object.assign(Error('ZF native200 role contract: '+error.message),{failureKind:'parser_or_contract_error',abortRetries:true,cause:error})}}

 try{
  const opening=await phase(),closing=await phase(),closed=new Map(closing.rows.map(r=>[r.jobId,r])),jobs=[]
  need(isDeepStrictEqual(opening.corporateIndiaTarget,closing.corporateIndiaTarget),'closing current publisher handoff changed')
  for(const row of opening.rows.slice(0,40)){
   if(denied)break
   if(row.nativePublicationFailure){held.push({id:row.jobId,reason:row.nativePublicationFailure,originalRecord:row});continue}
   if(!isDeepStrictEqual(rowModel(row),closed.has(row.jobId)?rowModel(closed.get(row.jobId)):null)){held.push({id:row.jobId,reason:'closing native publication changed',originalRecord:row});continue}
   if(row.countryCode!=='IN'){held.push({id:row.jobId,reason:'native published workplace outside India',originalRecord:row});continue}
   allowed.add(row.sourceUrl);let job=null
   try{const original=await qualify(row);job={...original,sourceClosingQualified:true,sourceNativeRoleClosingQualified:false};jobs.push(job)
    const current=await qualify(row)
    closePartialPublication(job,original,current)
   }catch(error){signal.throwIfAborted();optionalRoleFailures.push({id:row.jobId,status:error.status??null,reason:error.message,openingRoleQualified:!!job});if(job&&([404,410].includes(error.status)||error.failureKind==='parser_or_contract_error'||error instanceof SyntaxError))jobs.splice(jobs.indexOf(job),1);if(!job||[404,410].includes(error.status)||error.failureKind==='parser_or_contract_error')held.push({id:row.jobId,reason:error.message,originalRecord:row})}
  }
  const audit={source:SOURCE,openingNativeRecords:opening.rows,closingNativeRecords:closing.rows,openingPages:opening.pages,closingPages:closing.pages,held,optionalRoleFailures,originalResponses,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeClientExecuted:false,backendApplicationActivationVerified:false}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});signal.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty:true,pagesFetched:originalResponses.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:'current-own-publisher-native-RMK-listing-and-exact-same-role-employer-workplace-country-criteria-dates-and-authored-application-link;full-renderer-application-controls-company-inventory-and-cleanup-unverified'})
 }finally{clearTimeout(timer);controller.abort()}
}
