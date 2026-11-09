import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE='tripcom'
export const COMPANY='Trip.com'
export const CAREERS_URL='https://careers.trip.com/'
export const JOBS_API_URL=CAREERS_URL+'api/oversea/getOverseaJobAd'
export const LOCATION_API_URL=CAREERS_URL+'api/oversea/getLocation'
export const PAGE_SIZE=20 // Both 10 and 20 are advertised by the current public client.
export const COUNTRY_CODE='IND'
const CDN='https://ak-s-cw.tripcdn.com/modules/hrteam/careers-trip-abroad-ares/'
const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const check=(condition,message)=>{if(!condition)throw Object.assign(Error('Trip.com native contract: '+message),{code:'TRIPCOM_NATIVE_CONTRACT',abortRetries:true})}
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const decode=value=>String(value??'').replace(/&(?:#(x[\da-f]+|\d+);?|(nbsp|amp|quot|apos|lt|gt|rsquo|lsquo|ndash|mdash|hellip);)/gi,(m,n,name)=>{
 if(name)return {nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',rsquo:'’',lsquo:'‘',ndash:'–',mdash:'—',hellip:'…'}[name.toLowerCase()]
 const number=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)
 return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):'\ufffd'
})
const attributes=tag=>{
 const result={},reasons=[]
 for(const m of tag.replace(/^<\/?[a-z][\w:-]*/i,'').replace(/\/?\s*>$/,'').matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
  const key=m[1].toLowerCase();if(Object.hasOwn(result,key))reasons.push('duplicate-attribute:'+key)
  result[key]=decode(m[2]??m[3]??m[4]??'')
 }
 return {values:result,reasons}
}

// This deliberately small renderer handles native rich text, not arbitrary CSS.
// Unreviewed visibility remains incomplete; hidden/nonrendering subtrees never
// contribute requirements, country or employer evidence.
export function projectNativeHtml(input) {
 const html=String(input??'').replace(/<!--[^]*?(?:-->|$)/g,''),stack=[],parts=[],reasons=[]
 const block=new Set(['p','div','section','article','li','ul','ol','h1','h2','h3','h4','h5','h6','blockquote','table','tr','td','th'])
 const nonrendering=new Set(['script','style','head','title','template','noscript','iframe','object','embed'])
 const voids=new Set(['br','hr','img','input','meta','link','wbr','area','base','col','source','track','embed'])
 const hidden=()=>stack.some(node=>node.hidden)
 const line=()=>{if(!hidden())parts.push('\n')}
 for(const token of html.matchAll(/<\/?[a-z][\w:-]*(?:\s+(?:[^"'>]|"[^"]*"|'[^']*')*)?\s*\/?>|[^<]+|</gi)){
  const raw=token[0]
  if(!raw.startsWith('<')||raw==='<'){if(!hidden())parts.push(decode(raw));continue}
  const match=/^<(\/)?([\w:-]+)/.exec(raw),tag=match[2].toLowerCase()
  if(match[1]){
   const at=stack.map(n=>n.tag).lastIndexOf(tag)
   if(at>=0){stack.splice(at);if(block.has(tag))line()}else if(!voids.has(tag))reasons.push('unmatched-closing:'+tag)
   continue
  }
  if(block.has(tag)||tag==='br')line()
  const {values:attrs,reasons:attrReasons}=attributes(raw);reasons.push(...attrReasons)
  let suppressed=nonrendering.has(tag)||Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||/^true$/i.test(attrs['aria-hidden']||'')
  if(attrs.class){if(/(?:^|\s)(?:hidden|invisible|d-none|sr-only|visually-hidden)(?:\s|$)/i.test(attrs.class))suppressed=true;else reasons.push('unreviewed-class-visibility')}
  if(attrs.style){
   const css=attrs.style.replace(/\/\*[^]*?\*\//g,'').toLowerCase(),declarations=css.split(';').map(x=>x.trim()).filter(Boolean)
   let unknown=false
   for(const declaration of declarations){
    const at=declaration.indexOf(':');if(at<0){unknown=true;continue}
    const key=declaration.slice(0,at).trim(),value=declaration.slice(at+1).replace(/\s*!important\s*$/,'').trim()
    if(key==='display'&&value==='none'||key==='visibility'&&['hidden','collapse'].includes(value)||key==='content-visibility'&&value==='hidden'||key==='opacity'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(value)&&Number(value)===0)suppressed=true
    else if(key==='display'&&['block','inline','inline-block','flex','grid','list-item','table'].includes(value)||key==='visibility'&&value==='visible'||key==='opacity'&&Number(value)>0&&Number(value)<=1||['font-weight','font-style','text-decoration','text-align'].includes(key)&&/^[a-z\s\d-]+$/.test(value)){}
    else unknown=true
   }
   if(unknown&&!suppressed)reasons.push('unresolved-style-visibility')
  }
  if(Object.keys(attrs).some(k=>/^on/.test(k)))reasons.push('unreviewed-dynamic-visibility')
  if(!voids.has(tag)&&!raw.endsWith('/>'))stack.push({tag,hidden:suppressed})
 }
 if(stack.length)reasons.push('unclosed-native-markup')
 const text=parts.join('').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n+/g,'\n').trim()
 return {text,complete:reasons.length===0,reasons:[...new Set(reasons)]}
}

export const buildJobsRequestBody=(page=1)=>{
 check(Number.isSafeInteger(page)&&page>0,'invalid native page')
 return JSON.stringify({condition:{keyword:'',jobId:[],kind:[],country:[],city:[],bucode:[],jobFamilyGroupCode:[],jobFamilyCode:[]},pager:{index:String(page),size:String(PAGE_SIZE)},head:{language:'en-US'}})
}
const identity=row=>{
 check(row&&typeof row==='object'&&!Array.isArray(row),'invalid native role')
 const id=String(row.id??''),jobId=clean(row.jobId),fromId=clean(row.fromId),ats=clean(row.atsApiType)
 check(id&&jobId&&(fromId||jobId),'missing native identity or application jobId')
 check(['Moka_Overseas','Avature'].includes(ats),'missing or unreviewed native ATS type')
 return {id,jobId,fromId,ats,key:ats+':'+(fromId||jobId)}
}
export const buildDetailRequestBody=row=>{
 const id=identity(row)
 return JSON.stringify({condition:{fromId:[id.fromId||id.jobId]},atsApiType:id.ats,pager:{index:1,size:10},head:{language:'en-US'}})
}
const parsePayload=payload=>{
 check(payload?.retCode==='201'&&payload.retValue&&Array.isArray(payload.retValue.recruitJobAdList),'official jobs API response contract changed')
 const {total,recruitJobAdList:rows}=payload.retValue
 check(Number.isSafeInteger(total)&&total>=0,'invalid native total')
 for(const row of rows)identity(row)
 return {total,rows}
}
const nativeDate=(value,reasons,label)=>{
 if(value==null||value==='')return null
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)||!Number.isFinite(Date.parse(value))){reasons.push('invalid-'+label);return null}
 const [year,month,day]=value.slice(0,10).split('-').map(Number),date=new Date(Date.UTC(year,month-1,day))
 if(date.toISOString().slice(0,10)!==value.slice(0,10)){reasons.push('invalid-'+label);return null}
 return value
}
const FIELDS=new Set(['id','fromId','jobId','jobTitle','publishDate','city','cityName','requirements','duty','jobFamilyGroupCode','jobFamilyGroupName','buCode','buName','user','hrDutyUser','hrUserName','channelId','internalId','kind','kindName','atsApiType','ynShowInterviewDate','nextWeekDays','dutyUserCode','category','country','countryCode','countryName','jobCountry','jobCountryCode','employer','companyName','legalEmployer','closingDate','expiryDate','validThrough'])
function projectRole(row,{taxonomy,links={},now,detail=false}={}){
 const id=identity(row),reasons=[],requirements=projectNativeHtml(row.requirements),duty=projectNativeHtml(row.duty)
 check(clean(row.jobTitle),'missing native title')
 for(const field of Object.keys(row))if(!FIELDS.has(field))reasons.push('unreviewed-native-field:'+field)
 if(typeof row.requirements!=='string'||!requirements.text)reasons.push('missing-native-full-criteria')
 reasons.push(...requirements.reasons,...duty.reasons)
 // Requirement HTML is the entire body rendered by the public detail client.
 // A future separate duty section is retained, but needs a client visibility review.
 if(duty.text)reasons.push('unreviewed-native-duty-visibility')
 const description=requirements.text,lines=description.split('\n'),employers=[row.legalEmployer,row.employer,row.companyName,...lines.flatMap(line=>line.match(/^(?:Employer|Hiring company|Hiring organization|Company)\s*:\s*(.+)$/i)?.slice(1)||[])].map(clean).filter(Boolean)
 const employerNames=[...new Set(employers)],company=employerNames.length===1?employerNames[0]:null
 if(!company)reasons.push(employerNames.length?'conflicting-native-employer':'unknown-native-role-employer')
 const city=clean(row.cityName)||null,cityCode=clean(row.city),parents=taxonomy?.cities.get(cityCode)||[],matching=parents.filter(p=>p.cityName===city)
 const nativeCountryFields=[row.countryName,row.country,row.jobCountry,row.countryCode,row.jobCountryCode].map(clean).filter(Boolean)
 const workCountryLines=lines.flatMap(line=>line.match(/^(?:Work country|Job country)\s*:\s*(.+)$/i)?.slice(1)||[]).map(clean).filter(Boolean)
 const explicit=[...nativeCountryFields,...workCountryLines]
 let country=null,countryEvidence=null
 if(explicit.length&&taxonomy){
  const values=explicit.map(value=>taxonomy.countries.find(c=>c.code===value||c.name===value)).filter(Boolean)
  if(values.length===explicit.length&&new Set(values.map(c=>c.code)).size===1){country=values[0].name;countryEvidence={type:nativeCountryFields.length?'native-job-country-field':'native-work-country-prose',raw:explicit,countryCode:values[0].code}}
 }
 if(!country&&matching.length===1&&parents.length===1){country=matching[0].countryName;countryEvidence={type:'first-party-job-location-hierarchy',cityCode,cityName:city,countryCode:matching[0].countryCode,countryName:country,jobLocationField:'city',taxonomyUrl:LOCATION_API_URL}}
 if(explicit.length&&!['native-job-country-field','native-work-country-prose'].includes(countryEvidence?.type)){country=null;countryEvidence=null}
 if(!country)reasons.push('unknown-explicit-job-country')
 const postingDate=nativeDate(row.publishDate,reasons,'native-publication'),expiries=[row.closingDate,row.expiryDate,row.validThrough].filter(v=>v!=null&&v!=='')
 const parsed=expiries.map(v=>nativeDate(v,reasons,'native-expiry')),closingDate=parsed[0]??null
 if(new Set(parsed).size>1)reasons.push('conflicting-native-expiry')
 if(postingDate&&now&&postingDate.slice(0,10)>now.slice(0,10))reasons.push('future-native-publication')
 const active=!(closingDate&&now&&(closingDate.length===10?closingDate<now.slice(0,10):Date.parse(closingDate)<=Date.parse(now)))
 if(!active)reasons.push('expired-native-role')
 if(/\b(?:position (?:is )?(?:closed|filled)|no longer accepting applications|job (?:is )?expired)\b/i.test(description))reasons.push('visibly-closed-native-role')
 const sourceUrl=CAREERS_URL+'#/job-detail?'+new URLSearchParams({fromId:id.fromId||id.jobId,atsApiType:id.ats})
 const template=links[id.ats],applyUrl=template?(template.includes('{jobId}')?template.replace(/\{jobId\}/g,encodeURIComponent(id.jobId)):template+(template.includes('?')?'&':'?')+'jobId='+encodeURIComponent(id.jobId)):null
 if(detail&&!applyUrl)reasons.push('unverified-native-application-context')
 const full=detail&&reasons.every(r=>r==='unknown-native-role-employer'||r==='unknown-explicit-job-country')
 const job={source:SOURCE,title:clean(row.jobTitle),company,legalEmployer:company,companyCareerPage:CAREERS_URL,companyDomain:'trip.com',atsPlatform:'first-party-careers-api',jobId:id.id,sourceJobId:id.id,nativeFromId:id.fromId||null,nativeApplicationJobId:id.jobId,nativeAtsApiType:id.ats,requisitionId:null,requisitionIdEvidence:null,sourceUrl,applyUrl,link:applyUrl||sourceUrl,applicationContextUrl:sourceUrl,applicationLinkSource:applyUrl?'current-public-detail-client-and-translations':null,applicationSubmitted:false,candidateActionsTaken:false,department:clean(row.jobFamilyGroupName)||null,team:clean(row.buName)||null,employmentType:clean(row.kindName)||clean(row.kind)||null,location:city,city,country,nativeCountryEvidence:countryEvidence,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate,postedAt:postingDate,nativePublicationRaw:row.publishDate??null,nativePublicationSource:postingDate?'getOverseaJobAd.publishDate':null,nativePublicationPrecision:postingDate?postingDate.length===10?'day':'native-local-time':null,closingDate,nativeExpiryRaw:expiries.length?expiries:null,sourceClosingDateIsExact:Boolean(closingDate&&/(?:Z|[+-]\d\d:\d\d)$/.test(closingDate)),jobDescription:description,sourceDescription:row.requirements??null,descriptionSections:{Requirements:requirements.text,...(duty.text?{Duty:duty.text}:{})},nativeDescriptionSections:{requirements:row.requirements??null,duty:row.duty??null},nativeFields:structuredClone(row),sourceDetailComplete:full,sourceActive:active,scrapedAt:now??null}
 return {job,reasons,full,identity:id}
}
export const extractJobsFromPayload=payload=>parsePayload(payload).rows.map(row=>projectRole(row).job)

function readPublicShell(html){
 const match=String(html).match(/i18n_base_language\s*=\s*({[^]*?})\s*;?\s*<\/script>/i)
 check(match,'missing current public translations')
 let strings;try{strings=JSON.parse(match[1])['en-US']}catch{check(false,'invalid public translation JSON')}
 check(strings?.['recruit.overseasCareers.home.documentTitle']==='Careers | Trip.com Group','official group board identity changed')
 const main=[...html.replace(/<!--[^]*?-->/g,'').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(m=>new URL(m[1],CAREERS_URL).href).filter(u=>u.startsWith(CDN+'static/js/main.'))
 check(main.length===1,'ambiguous current public application client')
 const chunkMap=html.match(/\.u=\w+=>"static\/js\/"\+\w+\+"\."\+({[^}]+})\[\w+\]\+"\.chunk\.js"/)
 check(chunkMap,'current public route manifest changed')
 const chunks=Object.fromEntries([...chunkMap[1].matchAll(/(\d+)\s*:\s*"([\w-]+)"/g)].map(m=>[m[1],CDN+'static/js/'+m[1]+'.'+m[2]+'.chunk.js']))
 check(chunks[187]&&chunks[240]&&chunks[995],'missing current listing/detail routes')
 const links={Moka_Overseas:strings['OverseasCareers.MokaApplyPC'],Avature:strings['OverseasCareers.AvatureApply']}
 check(typeof links.Moka_Overseas==='string'&&/^https:\/\/hire-r1\.mokahr\.com\/apply\/tripoverseas\/\d+#\/job\/\{jobId\}\/apply\?pure=1$/.test(links.Moka_Overseas),'native Moka application mapping changed')
 check(links.Avature==='https://jobs.careers.trip.com/en_US/careers/ApplicationSwitch','native Avature application mapping changed')
 const hiringContexts=Object.entries(strings).filter(([key])=>/^recruit\.overseasCareers\.locations\.[A-Z]+\.code$/.test(key)).map(([key,value])=>{
  let url;try{url=new URL(value,CAREERS_URL)}catch{check(false,'invalid public country hiring handoff')}
  check(url.protocol==='https:'&&!url.username&&!url.password,'unsafe public country hiring handoff')
  return {countryCode:key.split('.').at(-2),url:url.href,nativeBoard:url.origin===new URL(CAREERS_URL).origin}
 })
 return {main:main[0],chunks,links,hiringContexts}
}

export function createTripcomScraper(defaults={}){return {async run(runOptions={}){
 const options={...defaults,...runOptions},now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),cap=options.maxJobs??Infinity,interval=options.requestIntervalMs??250,timeout=options.timeoutMs??600000
 check(Number.isFinite(Date.parse(now)),'invalid verification clock');check(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap');check(Number.isSafeInteger(interval)&&interval>=0,'invalid request interval');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=900000,'invalid source deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Trip.com source deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],allowed=new Set([CAREERS_URL]),last=new Map()
 const bounded=fn=>new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(signal.reason||Error('Trip.com aborted'))},cleanup=()=>signal.removeEventListener('abort',abort);if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});Promise.resolve().then(fn).then(v=>{cleanup();resolve(v)},e=>{cleanup();reject(e)})})
 const request=async(url,body)=>{
  signal.throwIfAborted();check(body?[JOBS_API_URL,LOCATION_API_URL].includes(url):allowed.has(url),'request outside current public readonly contract')
  const origin=new URL(url).origin,wait=interval-(Date.now()-(last.get(origin)||0));if(wait>0)await delay(wait,undefined,{signal});last.set(origin,Date.now())
  const response=await bounded(()=>(options.fetchImpl??globalThis.fetch)(url,{method:body?'POST':'GET',redirect:'manual',signal,headers:body?{Accept:'application/json','Content-Type':'application/json'}:{Accept:'text/html,application/javascript,*/*'},...(body?{body}:{} )}))
  const bytes=await bounded(()=>response.text())
  receipts.push({url,method:body?'POST':'GET',requestBody:body?JSON.parse(body):null,status:response.status,bodyBytes:Buffer.byteLength(bytes),bodySHA256:hash(bytes)})
  if(response.status!==200)throw Object.assign(Error('Trip.com public HTTP '+response.status+'; stopped without retry'),{status:response.status,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:[401,403,429].includes(response.status)?'public_access_denied':'public_http_failure'})
  check(!response.url||response.url===url,'public response redirected outside native identity')
  check(Buffer.byteLength(bytes)<=5000000,'oversized native response')
  if(/access denied|captcha|verify you are human|bot.{0,35}(?:detected|denied|blocked)|automated.{0,30}(?:denied|blocked)/i.test(bytes))throw Object.assign(Error('Trip.com public access denied or bot blocked; stopped without retry'),{abortRetries:true,softFailure:true,failureKind:'public_access_denied'})
  const mime=response.headers?.get?.('content-type')||''
  check(!mime||(body?/\b(?:application|text)\/[^;]*json/i:/\b(?:text\/html|(?:application|text)\/(?:x-)?(?:javascript|ecmascript))/i).test(mime),'native response content type changed')
  if(!body)return bytes
  try{return JSON.parse(bytes)}catch{check(false,'invalid native JSON')}
 }
 const taxonomy=async()=>{
  const read=async body=>{const p=await request(LOCATION_API_URL,JSON.stringify({...body,head:{language:'en-US'}}));check(p.retCode==='201'&&Array.isArray(p.retValue),'public location taxonomy contract changed');const seen=new Set();for(const value of p.retValue){check(value&&value.type===body.type&&clean(value.code)&&clean(value.name)&&!seen.has(value.code),'invalid/duplicate public location taxonomy');seen.add(value.code)}return p.retValue}
  const countries=await read({countryCode:'',type:'OverseasCareersCountry'});check(countries.length>0&&countries.some(c=>c.code==='IND'&&c.name==='India'),'unreviewed country scope')
  const allCities=await read({countryCode:'',citycode:'',type:'OverseasCareersWorkPlace'}),cities=new Map(),raw={countries,allCities,byCountry:{}}
  for(const country of countries){const rows=await read({countryCode:country.code,citycode:'',type:'OverseasCareersWorkPlace'});raw.byCountry[country.code]=rows;for(const city of rows){const values=cities.get(city.code)||[];values.push({cityCode:city.code,cityName:city.name,countryCode:country.code,countryName:country.name});cities.set(city.code,values)}}
  return {countries,cities,raw}
 }
 const enumerate=async()=>{
  let total=null,rows=[],pages=0;const ids=new Set(),keys=new Set()
  for(let page=1;page<=10000;page++){
   const current=parsePayload(await request(JOBS_API_URL,buildJobsRequestBody(page)));pages++
   if(total===null)total=current.total;check(current.total===total,'pagination reported total changed')
   check(current.rows.length<=PAGE_SIZE,'native page exceeds requested size')
   check(current.rows.length>0||rows.length===total,'premature empty native pagination')
   for(const row of current.rows){const id=identity(row);check(!ids.has(id.id)&&!keys.has(id.key),'duplicate native pagination identity');ids.add(id.id);keys.add(id.key);rows.push(row)}
   check(rows.length<=total,'native inventory exceeds reported total')
   if(rows.length===total)return {rows,total,pages}
  }
  check(false,'native pagination exceeded bounded inventory')
 }
 try{
  const shell=readPublicShell(await request(CAREERS_URL));for(const url of [shell.main,shell.chunks[995],shell.chunks[240],shell.chunks[187]])allowed.add(url)
  const main=await request(shell.main),routes=await request(shell.chunks[995]),listClient=await request(shell.chunks[240]),detailClient=await request(shell.chunks[187])
  check(main.includes('url:"api/oversea/getOverseaJobAd",data:')&&main.includes('url:"api/oversea/getLocation",data:')&&main.includes('this.sendPost(')&&main.includes('head:{language:')&&main.includes('OverseasCareers.MokaApplyPC')&&main.includes('OverseasCareers.AvatureApply'),'current public readonly service contract changed')
  check(routes.includes('path:"/joblist"')&&routes.includes('path:"/job-detail"'),'public route contract changed')
  check(listClient.includes('pageSizeOptions:["10","20"]')&&listClient.includes('jobId:[]')&&listClient.includes('jobFamilyCode:[]')&&listClient.includes('OverseasCareersCountry')&&listClient.includes('OverseasCareersWorkPlace'),'public complete listing/location contract changed')
  check(/condition:\{fromId:\[\w+\]\},atsApiType:\w+,pager:\{index:1,size:10\}/.test(detailClient)&&detailClient.includes('.get("fromId")||')&&detailClient.includes('.get("jobId")')&&detailClient.includes('e.requirements'),'public full detail contract changed')
  const openingTaxonomy=await taxonomy(),opening=await enumerate(),roles=[],reasons=shell.hiringContexts.filter(c=>!c.nativeBoard).map(c=>'unenumerated-country-hiring-context:'+c.countryCode)
  const fetchDetails=async(snapshot,geo)=>{
   const result=new Map()
   for(const row of snapshot.rows){
    const id=identity(row),payload=parsePayload(await request(JOBS_API_URL,buildDetailRequestBody(row)))
    if(payload.total!==1||payload.rows.length!==1){reasons.push('unresolved-detail-cardinality:'+id.key);continue}
    const detail=payload.rows[0],actual=identity(detail)
    if(actual.id!==id.id||actual.jobId!==id.jobId||actual.key!==id.key){reasons.push('detail-identity-mismatch:'+id.key);continue}
    const role=projectRole(detail,{taxonomy:geo,links:shell.links,now,detail:true})
    if(canonical(row)!==canonical(detail)){role.reasons.push('listing-detail-native-fields-changed');role.full=false;role.job.sourceDetailComplete=false}
    result.set(id.key,{...role,row:detail})
   }
   return result
  }
  const details=await fetchDetails(opening,openingTaxonomy),closingTaxonomy=await taxonomy(),closing=await enumerate(),closingDetails=await fetchDetails(closing,closingTaxonomy)
  if(canonical(openingTaxonomy.raw)!==canonical(closingTaxonomy.raw))reasons.push('native-location-taxonomy-changed-during-closing')
  if(canonical(opening.rows)!==canonical(closing.rows))reasons.push('native-global-inventory-changed-during-closing')
  const eligible=[]
  for(const row of opening.rows){
   const id=identity(row),a=details.get(id.key),b=closingDetails.get(id.key)
   if(!a){reasons.push('unresolved-full-role:'+id.key);continue}
   roles.push(a.job);reasons.push(...a.reasons.map(reason=>reason+':'+id.key))
   if(!b||canonical(a.row)!==canonical(b.row)||canonical(a.job.nativeCountryEvidence)!==canonical(b.job.nativeCountryEvidence)){reasons.push('full-role-changed-during-closing:'+id.key);continue}
   reasons.push(...b.reasons.map(reason=>reason+':'+id.key))
   if(a.full&&b.full&&a.job.country==='India'&&a.job.company===COMPANY&&a.job.sourceActive)eligible.push(a.job)
  }
  if(cap<eligible.length)reasons.push('caller-cap-after-complete-native-reconciliation')
  const complete=reasons.length===0,evidence={source:SOURCE,surface:CAREERS_URL,nativeScope:'all unfiltered current overseas public board records; source Trip.com; sibling employers require role attribution',corporateHiringContexts:shell.hiringContexts,globalRecords:opening.total,closingGlobalRecords:closing.total,observedOverseasRecords:opening.total,closingObservedOverseasRecords:closing.total,wholeEmployerGlobalRecords:complete?opening.total:null,wholeEmployerIndiaRecords:complete?eligible.length:null,fullDetailRecords:[...details.values()].filter(r=>r.full).length,closingFullDetailRecords:[...closingDetails.values()].filter(r=>r.full).length,confirmedIndiaRecords:roles.filter(r=>r.country==='India').length,confirmedForeignRecords:roles.filter(r=>r.country&&r.country!=='India').length,countryUnknownRecords:roles.filter(r=>!r.country).length,employerUnknownRecords:roles.filter(r=>!r.company).length,eligibleIndiaRecords:eligible.length,publicationPolicyEligibleRecords:eligible.length===0?0:null,publicationPolicyEvaluation:'registered downstream policy evaluated separately',sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,closingReconciled:details.size===opening.total&&closingDetails.size===closing.total&&!reasons.some(r=>/changed|identity|cardinality/.test(r)),reasons:[...new Set(reasons)],roles,nativeTaxonomy:openingTaxonomy.raw,retainedResponses:receipts,verifiedAt:now,candidateActionsTaken:false,applicationSubmitted:false}
  if(options.onNativeEvidence)await options.onNativeEvidence(evidence)
  const jobs=eligible.slice(0,cap).map(job=>({...job,sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceObservedGlobalJobCount:opening.total,sourceObservedIndiaJobCount:evidence.confirmedIndiaRecords,nativeCollectionEvidence:{...evidence,roles:undefined,nativeTaxonomy:undefined}}))
  return attachInventoryEvidence(jobs,{status:complete?(opening.total===0?'verified-empty':'complete-inventory'):'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:complete,pagesFetched:opening.pages+closing.pages,reportedTotal:opening.total,indiaFacetCount:evidence.confirmedIndiaRecords,verifiedAt:now,reason:complete?'complete-native-opening-details-and-closing-reconciliation':evidence.reasons.join(';')})
 }catch(error){error.abortRetries=true;throw error}finally{clearTimeout(timer)}
}}}
