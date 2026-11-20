import {setTimeout as delay} from 'node:timers/promises'
import {isDeepStrictEqual} from 'node:util'
import {document,decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {verifyRmkCompanyToken,readRmkLocationCountry} from '../../scraper-support/shared/successFactorsRmk.js'
import {nativeDate,nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='teradyne',COMPANY='Teradyne',HOME='https://www.teradyne.com/careersatteradyne/',ORIGIN='https://jobs.teradyne.com',TOKEN={companyToken:'teradynein'}
const norm=s=>String(s??'').replace(/\s+/g,' ').trim(),need=(ok,message)=>{if(!ok)throw Object.assign(Error('Teradyne current publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
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
  if(['company','companyname','employer','employername','legalemployer','hiringorganization'].includes(field))need([COMPANY].includes(value),'native publication employer conflict: '+key)
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
  if(['hiringOrganization','employer','company','legalEmployer'].includes(key))need(value===COMPANY,'native employer conflict')
  if(['isClosed','closed','archived','isArchived','expired','isExpired'].includes(key))need(value==='false','native publication explicitly closed')
  if(['canApply','isActive','isPublished'].includes(key))need(value==='true','native publication disabled')
  if(['status','jobStatus','publicationStatus'].includes(key))need(/^(?:open|active|published|approved)$/i.test(value),'native publication status unavailable')
 }
 for(const line of lines){const m=/^([^:]{1,40}):\s*(.+)$/.exec(norm(line));if(!m)continue;const label=m[1],value=m[2]
  if(/^(?:employer|company(?: name)?|legal employer|hiring organization)$/i.test(label))need(value===COMPANY,'native authored employer conflict')
  if(/^(?:(?:job|work|workplace) )?country$/i.test(label))need(nativeCountryName(value)==='India','native authored country conflict')
  if(/^(?:(?:job|work) )?(?:location|workplace)$/i.test(label)){const c=nativeLocationCountryName(value);need((!c||c==='India')&&workplaceCountries(value).every(country=>country==='India'),'native authored workplace conflict')}
  if(/^(?:(?:job|publication|posting) )?(?:status|availability)$/i.test(label))need(!/^(?:draft|closed|filled|inactive|unpublished|not\s+published|disabled|expired|archived)\b/i.test(value),'native authored publication unavailable')
  if(/^(?:closing date|application deadline|valid through|expiry date)$/i.test(label))date(value,true,label)
  if(/^(?:date posted|posted date|publication date|posting date)$/i.test(label))date(value,false,label)
 }
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso));return dates
}
export function readTeradyneListing(html,url,at=new Date().toISOString()){
 verifyRmkCompanyToken(html,TOKEN);const d=page(html),table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'native result table'),range=/Page (\d+) of (\d+), Results (\d+) to (\d+) of (\d+)/i.exec(table.attrs['aria-label']??'')
 need(range&&+range[1]>=1&&+range[2]<=20&&+range[3]>=1&&+range[4]<=+range[5]&&+range[5]<=1000,'native range/accounting unavailable')
 const rows=d.nodes(n=>n.tag==='tr'&&classes(n,'data-row'),table).map(n=>{
  const links=d.nodes(a=>a.tag==='a'&&classes(a,'jobTitle-link'),n),href=one([...new Set(links.map(a=>a.attrs.href))],'same native role link'),title=one([...new Set(links.map(d.text))],'native title'),u=safeURL(href,url),m=/^\/([^/]+)\/job\/[^/]+\/(\d+)\/$/.exec(u.pathname)
  need(m&&title&&!u.search,'native role identity unavailable')
  const nativeLocationLabels=[...new Set(d.nodes(a=>classes(a,'jobLocation')&&!d.nodes(c=>c!==a&&classes(c,'jobLocation'),a).length,n).map(d.text))],additionalCounts=nativeLocationLabels.map(value=>Number(value.match(/\+(\d+)\s+more(?:\u2026|\.{3})?\s*$/iu)?.[1]??0)),additionalLocationCount=Math.max(...additionalCounts),locations=[...new Set(nativeLocationLabels.map(value=>value.replace(/\s*\+\d+\s+more(?:\u2026|\.{3})?\s*$/iu,'')))],countryCodes=locations.map(readRmkLocationCountry)
  need(additionalLocationCount<=20&&new Set(additionalCounts.filter(Boolean)).size<=1,'native additional workplace count conflicts')
  need(locations.length>0,'native whole workplace labels unavailable')
  let nativePublicationFailure=null;try{for(const node of[n,...links]){need(!disabled(node),'native publication carrier disabled');publicationFields(Object.entries(node.attrs).map(([key,value])=>({key,value})),at)}}catch(error){if(error.failureKind!=='parser_or_contract_error')throw error;nativePublicationFailure=error.message}
  return{nativePublicationFailure,nativeBrand:m[1],jobId:m[2],title,sourceUrl:u.href,locations,nativeLocationLabels,additionalLocationCount,countryCode:new Set(countryCodes).size===1?countryCodes[0]:null,nativeCountryCodes:countryCodes,nativeFields:d.nodes(a=>a.tag==='td',n).map(a=>({headers:a.attrs.headers??null,text:d.text(a)})),nativeAttributes:n.attrs,nativeControlAttributes:links.map(node=>node.attrs),originalRowHTML:d.outer(n)}
 })
 need(rows.length===+range[4]-+range[3]+1&&new Set(rows.map(r=>r.jobId)).size===rows.length,'native page identities/count disagree')
 let next=null;if(+range[1]<+range[2]){const link=one([...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.title==='Page '+(+range[1]+1)).map(n=>n.attrs.href))],'native next page');const u=safeURL(link,url);need(u.pathname==='/search/'&&u.searchParams.get('q')==='India'&&u.searchParams.size===new Set(u.searchParams.keys()).size&&[...u.searchParams].every(([k,v])=>k==='q'&&v==='India'||k==='startrow'&&/^(?:0|[1-9]\d*)$/.test(v)&&+v<=1000),'native continuation scope changed');next=u.href}
 return{rows,total:+range[5],start:+range[3],end:+range[4],next}
}
const rowModel=row=>({nativePublicationFailure:row.nativePublicationFailure,nativeBrand:row.nativeBrand,nativeCountryCodes:row.nativeCountryCodes,jobId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,locations:row.locations,countryCode:row.countryCode,nativeFields:row.nativeFields,nativeAttributes:row.nativeAttributes,nativeControlAttributes:row.nativeControlAttributes})
export function readTeradyneRole(html,row,at){
 for(const attributes of[row.nativeAttributes??{},...row.nativeControlAttributes??[]])publicationFields(Object.entries(attributes).map(([key,value])=>({key,value})),at);need(!row.nativePublicationFailure,'native row publication withheld: '+row.nativePublicationFailure)
 need(row.nativeBrand===COMPANY&&new URL(row.sourceUrl).origin===ORIGIN&&new URL(row.sourceUrl).pathname.startsWith('/Teradyne/job/'),'native role belongs to another published brand')
 verifyRmkCompanyToken(html,TOKEN);const d=page(html),owner=one(d.nodes(n=>n.attrs.itemtype==='http://schema.org/JobPosting'||n.attrs.itemtype==='https://schema.org/JobPosting'),'native JobPosting'),prop=key=>d.nodes(n=>(n.attrs.itemprop??'').split(/\s+/).includes(key),owner),value=key=>{const nodes=prop(key);need(nodes.length<=1,'ambiguous native '+key);return nodes[0]?.attrs.content??(nodes[0]?d.text(nodes[0]):null)}
 publicationFields(Object.entries(owner.attrs).map(([key,value])=>({key,value})),at)
 need(value('title')===row.title&&value('hiringOrganization')===COMPANY,'native own role title/employer conflict')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical URL').attrs.href;need(canonical===row.sourceUrl,'native canonical role identity conflict')
 const street=prop('streetAddress').map(n=>n.attrs.content??d.text(n));need(street.length===row.locations.length+row.additionalLocationCount&&row.locations.every(location=>street.includes(location))&&street.every(s=>wholeWorkplaceCountry(s)==='IN')&&row.countryCode==='IN','native same-role whole workplace/country conflict')
 const descriptions=prop('description');need(descriptions.length<=1,'native criteria ownership ambiguous');const description=descriptions[0]?d.inner(descriptions[0]):null,properties=d.nodes(n=>n.attrs.itemprop,owner).flatMap(n=>n.attrs.itemprop.split(/\s+/).filter(key=>key&&!['description','jobLocation','address','title'].includes(key)).map(key=>({key,value:n.attrs.content??n.attrs.datetime??d.text(n),nativeItemprop:n.attrs.itemprop}))),dates=constraints(d.inner(owner),properties,at)
 need(!findExplicitNativeClosure([d.text(owner)]),'native role page explicitly closed')
 const applications=d.nodes(n=>n.tag==='a'&&(n.attrs.href?.includes('/talentcommunity/apply/')||classes(n,'dialogApplyBtn')||classes(n,'apply')&&!classes(n,'applyOption')||n.attrs.role!=='menuitem'&&/^apply now(?:\s*[»›])?$/i.test(norm(d.text(n)))));need(applications.length>0&&applications.every(a=>typeof a.attrs.href==='string'&&a.attrs.href.trim()&&!disabled(a)),'native application unavailable')
 const urls=[...new Set(applications.map(n=>new URL(n.attrs.href,row.sourceUrl).href))],application=one(urls,'native same-role application URL'),u=safeURL(application,row.sourceUrl)
 need(u.pathname==='/talentcommunity/apply/'+row.jobId+'/'&&[...u.searchParams].every(([k,v])=>k==='locale'&&['en_US','en_GB'].includes(v)),'native application requisition identity conflict')
 for(const attributes of[row.nativeAttributes??{},...row.nativeControlAttributes??[],...[owner,...prop('title'),...prop('streetAddress'),...prop('jobLocation'),...applications].map(node=>node.attrs)])publicationFields(Object.entries(attributes).map(([key,value])=>({key,value})),at,dates)
 for(const values of Object.values(dates))values.sort((a,b)=>a.iso.localeCompare(b.iso))
 return{source:SOURCE,company:COMPANY,jobId:row.jobId,requisitionId:null,nativePublicJobId:row.jobId,title:row.title,sourceUrl:row.sourceUrl,applyUrl:application,link:application,country:'India',city:null,state:null,location:street.join(' / '),nativeEmployerDisplayName:COMPANY,nativeLegalEmployer:null,sourceNativeListingRecord:row,sourceNativeRoleHTML:d.outer(owner),sourceNativeProperties:properties,sourceNativeWorkplaces:street,
  sourceNativeWorkplaceMultiplicity:{publishedAddressCount:street.length,distinctAddressCount:new Set(street).size,listingAdditionalLocationCount:row.additionalLocationCount,distinctAdditionalWorkplacesVerified:new Set(street).size===street.length},
  sourceCountryEvidence:{kind:'native-RMK-whole-listing-and-same-role-streetAddress-country-suffix',nativeCountryCode:'IN',typedAddressCountryInvented:false,originalWorkplaces:street},sourceDescription:description,jobDescription:description,postingDate:dates.publications[0]?.iso??null,closingDate:dates.expiries[0]?.iso??null,sourceNativeDates:dates,
  sourceNativeApplication:{kind:'own-current-role-declared-exact-public-ID-application-link',url:application,controlsQualified:false,activationVerified:false,submitted:false},sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-published-criteria-and-own-application-link;full-renderer-and-application-controls-unverified',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,scrapedAt:at}
}
function publicationCore(job){return{source:job.source,company:job.company,jobId:job.jobId,nativePublicJobId:job.nativePublicJobId,requisitionId:job.requisitionId,title:job.title,sourceUrl:job.sourceUrl,applyUrl:job.applyUrl,country:job.country,nativeEmployerDisplayName:job.nativeEmployerDisplayName,nativeLegalEmployer:job.nativeLegalEmployer,workplaces:[...job.sourceNativeWorkplaces].sort()}}
function closePartialPublication(job,opening,closing){
 need(typeof opening.sourceNativeRoleHTML==='string'&&typeof closing.sourceNativeRoleHTML==='string'&&isDeepStrictEqual(publicationCore(opening),publicationCore(closing)),'closing native publisher/identity/employer/workplace/application binding changed')
 const{sourceNativeRoleHTML:openingHTML,...a}=opening,{sourceNativeRoleHTML:closingHTML,...b}=closing
 job.sourceNativeCriteriaStable=isDeepStrictEqual(a,b)
 job.sourceNativeDates=Object.fromEntries(['publications','expiries'].map(key=>[key,[...opening.sourceNativeDates[key],...closing.sourceNativeDates[key]].sort((left,right)=>left.iso.localeCompare(right.iso))]))
 job.postingDate=job.sourceNativeDates.publications[0]?.iso??null;job.closingDate=job.sourceNativeDates.expiries[0]?.iso??null
 if(!job.sourceNativeCriteriaStable){
  job.sourceNativeCriteriaVariants=[{phase:'opening',description:opening.sourceDescription,properties:opening.sourceNativeProperties,dates:opening.sourceNativeDates,originalRoleHTML:openingHTML},{phase:'closing',description:closing.sourceDescription,properties:closing.sourceNativeProperties,dates:closing.sourceNativeDates,originalRoleHTML:closingHTML}]
  job.sourceDescription=[...new Set([opening.sourceDescription,closing.sourceDescription].filter(value=>typeof value==='string'&&value.trim()))].join('\n\n')||null;job.jobDescription=job.sourceDescription
  job.sourceDetailFailureKind+=';native-criteria-revision-both-original-variants-retained'
 }
 job.sourceNativeRoleDetailClosingQualified=true
}
export async function runTeradynePublications(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original HTTP metadata transport required')
 const at=typeof options.now==='function'?options.now():options.now??new Date().toISOString();need(Number.isFinite(Date.parse(at)),'invalid observation clock')
 const duration=options.sourceTimeoutMs??180000,interval=options.requestIntervalMs??500;need(Number.isSafeInteger(duration)&&duration>0&&duration<=180000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid source bounds')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Teradyne source deadline exceeded')),duration),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,allowed=new Set([HOME]),originalResponses=[],held=[],optionalRoleFailures=[]
 let requests=0,bytes=0,last=0,denied=false
 async function read(url){signal.throwIfAborted();need(!denied&&allowed.has(url)&&++requests<=128,'unbound public read or source request budget');const wait=interval-(performance.now()-last);if(wait>0)await delay(wait,undefined,{signal});last=performance.now()
  const packet=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:Error('Teradyne streamed entity bound'),fetchImpl:async(u,init)=>{const r=await(options.fetchImpl??globalThis.fetch)(u,{...init,credentials:'omit',cache:'no-store'});try{need(r?.url===u&&r.redirected===false&&r.headers?.get&&r.body,'original HTTP identity unavailable');if(r.status!==200){if([202,401,402,403,406,407,429,451].includes(r.status))denied=true;throw Object.assign(Error('Teradyne native HTTP '+r.status),{status:r.status})}need(/^text\/html(?:;|$)/i.test(r.headers.get('content-type')??''),'native HTML MIME unavailable');return r}catch(error){try{Promise.resolve(r?.body?.cancel(error)).catch(()=>{})}catch{}throw error}}})
  const body=Buffer.from(packet.bodyBase64,'base64');bytes+=body.length;need(body.length<=2*1024*1024&&bytes<=32*1024*1024,'native entity/aggregate byte bound');const html=new TextDecoder('utf8',{fatal:true}).decode(body);originalResponses.push({requestedUrl:url,status:packet.status,originalBody:html});return html
 }
 async function qualify(row){const html=await read(row.sourceUrl);try{return readTeradyneRole(html,row,at)}catch(error){signal.throwIfAborted();if(error.failureKind==='parser_or_contract_error')throw error;need(false,'malformed complete200 own-role model: '+error.message)}}
 async function phase(){
  const corporate=page(await read(HOME)),targets=corporate.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>{try{return new URL(n.attrs.href,HOME).href}catch{return null}});need(targets.includes(ORIGIN+'/'),'current own corporate board handoff unavailable');allowed.add(ORIGIN+'/')
  const boardHTML=await read(ORIGIN+'/');verifyRmkCompanyToken(boardHTML,TOKEN);const board=page(boardHTML),forms=board.nodes(n=>n.tag==='form'&&n.attrs.method?.toLowerCase()==='get'&&n.attrs.action&&new URL(n.attrs.action,ORIGIN).origin===ORIGIN&&new URL(n.attrs.action,ORIGIN).pathname==='/search/'&&board.nodes(c=>c.tag==='input'&&c.attrs.name==='q',n).length);need(forms.length===1,'current declared native GET keyword query unavailable')
  let url=new URL(forms[0].attrs.action,ORIGIN);url.searchParams.set('q','India');const rows=[],pages=[]
  while(url){allowed.add(url.href);const parsed=readTeradyneListing(await read(url.href),url.href,at);need(pages.length<20&&parsed.start===rows.length+1&&(!pages.length||parsed.total===pages[0].total),'native pagination accounting changed');pages.push(parsed);rows.push(...parsed.rows);url=parsed.next?new URL(parsed.next):null}
  need(rows.length===pages[0].total&&new Set(rows.map(r=>r.jobId)).size===rows.length,'native listing total or distinct IDs disagree');return{rows,pages:pages.map(p=>({start:p.start,end:p.end,total:p.total,next:p.next})),corporatePublisherTarget:ORIGIN+'/'}
 }
 try{
  const opening=await phase(),closing=await phase(),closed=new Map(closing.rows.map(r=>[r.jobId,r])),jobs=[]
  need(isDeepStrictEqual(opening.corporatePublisherTarget,closing.corporatePublisherTarget),'closing current publisher handoff changed')
  for(const row of opening.rows.slice(0,50)){
   if(denied)break
   if(row.nativePublicationFailure){held.push({id:row.jobId,reason:row.nativePublicationFailure,originalRecord:row});continue}
   if(!isDeepStrictEqual(rowModel(row),closed.has(row.jobId)?rowModel(closed.get(row.jobId)):null)){held.push({id:row.jobId,reason:'closing native publication changed',originalRecord:row});continue}
   if(row.nativeBrand!==COMPANY){held.push({id:row.jobId,reason:'native role belongs to another published brand',originalRecord:row});continue}
   if(row.countryCode!=='IN'){held.push({id:row.jobId,reason:'native published workplace outside India',originalRecord:row});continue}
   allowed.add(row.sourceUrl);let job=null
   try{const original=await qualify(row);job={...original,sourceClosingQualified:true,sourceNativeRoleDetailClosingQualified:false};jobs.push(job)
    const current=await qualify(row)
    closePartialPublication(job,original,current)
   }catch(error){signal.throwIfAborted();optionalRoleFailures.push({id:row.jobId,status:error.status??null,reason:error.message,openingRoleQualified:!!job});if(job&&([404,410].includes(error.status)||error.failureKind==='parser_or_contract_error'||error instanceof SyntaxError))jobs.splice(jobs.indexOf(job),1);if(!job||[404,410].includes(error.status)||error.failureKind==='parser_or_contract_error')held.push({id:row.jobId,reason:error.message,originalRecord:row})}
  }
  const audit={source:SOURCE,nativeQueryCountryScope:'keyword-only-not-India-facet',openingNativeRecords:opening.rows,closingNativeRecords:closing.rows,openingPages:opening.pages,closingPages:closing.pages,held,optionalRoleFailures,originalResponses,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeClientExecuted:false,backendApplicationActivationVerified:false}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.rows.length,observedVacancyCount:opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});signal.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty:true,pagesFetched:originalResponses.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:at,reason:'current-own-publisher-native-RMK-listing-and-exact-same-role-employer-workplace-country-criteria-dates-and-authored-application-link;full-renderer-application-controls-company-inventory-and-cleanup-unverified'})
 }finally{clearTimeout(timer);controller.abort()}
}
