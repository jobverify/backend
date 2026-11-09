// Narrow public Keka contract for the two employer-bound portals in this repair.
// No login, candidate, application form or submission endpoint is requested.
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

export const CLIENT_SHA256='176878893ddcd1a0dabb3b84d1c8a98bde7c16c6ace1af2871db06c741fa022b'
export const DETAIL_CLIENT_URL='https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js'
export const DETAIL_CLIENT_SHA256='e2585ba1c4a259792330b7524042e3376994836454234a6da414eb1eeaaf315f'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
const check=(condition,message)=>{if(!condition)throw Object.assign(Error('Keka native contract: '+message),{code:'ACCIO_OPEN_NATIVE_CONTRACT',abortRetries:true})}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const decode=value=>String(value??'').replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&rsquo;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
export const plain=value=>clean(decode(String(value??'').replace(/<!--[^]*?-->/g,'').replace(/<(script|style|head|title|template|noscript)\b[^>]*>[^]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')))
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const commentsRemoved=html=>String(html).replace(/<!--[^]*?-->/g,'')
const markup=html=>commentsRemoved(html).replace(/<script\b[^>]*>[^]*?<\/script>/gi,'')
const links=html=>[...markup(html).matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)].map(m=>decode(m[2]))
const srcs=html=>[...commentsRemoved(html).matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)].map(m=>decode(m[2]))
const safeUrl=(value,base)=>{try{const u=new URL(value,base);check(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'unsafe URL');return u.href}catch{throw Error('Keka native contract: invalid URL')}}
const visible=(html,label)=>{
  check(!/<(?:script|style|iframe|object|embed|input|form)\b/i.test(html),label+' has unreviewed executable or form content')
  if(label.includes('description'))check(!/<(?:head|title|template|noscript)\b/i.test(html),label+' has nonrendering hidden content')
  // Parse both quoted and valid unquoted attributes; HTML entities are decoded
  // before CSS checks. Comments/escapes must not disguise hiding declarations.
  for(const match of String(html).matchAll(/<[a-z][^"'>]*(?:(?:"[^"]*"|'[^']*')[^"'>]*)*>/gi)) {
    const attributes=[...match[0].replace(/^<[a-z][\w:-]*/i,'').matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
    const seen=new Set()
    for(const attribute of attributes) {
      const key=attribute[1].toLowerCase(),value=decode(attribute[2]??attribute[3]??attribute[4]??'')
      check(!seen.has(key),label+' duplicate/ambiguous visibility attribute');seen.add(key)
      check(!/^on/.test(key),label+' unreviewed executable visibility attribute')
      check(!['hidden','inert'].includes(key)&&!(key==='aria-hidden'&&value.toLowerCase()==='true'),label+' hidden visibility')
      if(key==='class')check(!/(?:^|\s)(?:d-none|hidden|invisible|sr-only|visually-hidden)(?:\s|$)/i.test(value),label+' hidden visibility class')
      if(key==='style') {
        const css=value.replace(/\/\*[^]*?\*\//g,'')
        check(!/[\\@]/.test(css)&&!/\b(?:display|visibility|opacity|clip(?:-path)?|position|(?:min-|max-)?height|(?:min-|max-)?width|overflow(?:-[xy])?|content-visibility|font-size|transform|filter)\s*:/i.test(css)&&!/\b(?:color|background(?:-color)?)\s*:\s*(?:transparent|rgba\([^)]*,\s*0\s*\))/i.test(css),label+' unreviewed visibility style')
      }
    }
  }
}
const section=html=>{
  const m=/<div\b[^>]*\bclass\s*=\s*["'][^"']*\bjob-description-container\b[^"']*["'][^>]*>/i.exec(html)
  check(m,'missing full public description container')
  check([...html.matchAll(/\bclass\s*=\s*["'][^"']*\bjob-description-container\b/gi)].length===1,'ambiguous full description')
  visible(m[0],'description container')
  const start=m.index+m[0].length,tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;let depth=1,t
  while((t=tags.exec(html))){depth+=/^<\//.test(t[0])?-1:1;if(depth===0)return {html:html.slice(start,t.index),start:m.index,end:tags.lastIndex}}
  throw Error('Keka native contract: incomplete full description container')
}
const nativeDate=(value,label)=>{
  if(value==null||value==='')return null
  check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)&&Number.isFinite(+new Date(value)),'invalid '+label)
  const day=value.slice(0,10);check(new Date(day).toISOString().slice(0,10)===day,'invalid '+label+' day');return value
}
const ROW_FIELDS=new Set(['id','title','description','departmentIdentifier','departmentName','excerpt','jobLocations','jobType','experience','salaryRange','salaryRangeFormat','publishedOn','publishedSinceDays','skillNames','jobNumber','groupLinkIdentifier','businessUnitId','isRemote','closingDate','expiryDate','validThrough'])
const DISPLAY_FIELDS=new Set(['location','experience','jobType','jobNumber','salaryRange','dateOfPosting'])
const countries=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
function geography(locations) {
  check(Array.isArray(locations),'invalid native locations')
  const ids=new Set(),out=[]
  for(const l of locations) {
    check(l&&typeof l==='object'&&!Array.isArray(l)&&Object.keys(l).every(k=>['id','name','city','state','countryCode','countryName'].includes(k)),'unreviewed native location field')
    check(Number.isSafeInteger(l.id)&&l.id>0&&!ids.has(l.id),'invalid/duplicate native location identity');ids.add(l.id)
    check(['name','city','state','countryCode','countryName'].every(k=>l[k]==null||typeof l[k]==='string'),'invalid native location shape')
    const code=clean(l.countryCode).toUpperCase(),name=clean(l.countryName)
    if(!code&&!name){out.push({...l,country:null});continue}
    check(/^[A-Z]{2}$/.test(code)&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)&&countries.of(code)&&name,'incomplete explicit job country')
    check(countries.of(code).toLowerCase()===name.toLowerCase()||(code==='US'&&['usa','united states of america'].includes(name.toLowerCase()))||(code==='GB'&&name==='UK'),'conflicting native country')
    out.push({...l,country:code==='IN'?'India':countries.of(code)})
  }
  return out
}
export function projectNativeRole(row,detail,c,info,now) {
  check(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).every(k=>ROW_FIELDS.has(k)),'unreviewed native field or criteria')
  const id=String(row.id??'');check(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(+id),'invalid job identity')
  const title=clean(row.title);check(title&&typeof row.description==='string'&&plain(row.description),'missing full native description/title')
  check(row.departmentName==null||typeof row.departmentName==='string','invalid native department')
  check(row.experience==null||typeof row.experience==='string'||typeof row.experience==='number'&&Number.isFinite(row.experience)&&row.experience>=0,'invalid native experience')
  check(row.jobNumber==null||typeof row.jobNumber==='string','invalid advertised requisition')
  check(row.jobType==null||[1,2].includes(row.jobType),'unreviewed native employment type')
  check(row.isRemote==null||typeof row.isRemote==='boolean','invalid native remote status')
  check(Array.isArray(row.skillNames)&&row.skillNames.every(s=>typeof s==='string'&&clean(s)),'invalid native skills')
  check(row.salaryRangeFormat==null||typeof row.salaryRangeFormat==='string','invalid native compensation')
  check(row.salaryRange==null||typeof row.salaryRange==='object'&&!Array.isArray(row.salaryRange)&&Object.keys(row.salaryRange).every(k=>['minimum','maximum','currency','salaryPeriod','cultureInfo'].includes(k)),'unreviewed native compensation shape')
  visible(row.description,'native description')
  const body=markup(detail),h1=[...body.matchAll(/<h1\b[^>]*>([^]*?)<\/h1>/gi)]
  check(h1.length===1&&plain(h1[0][1])===title,'public detail title mismatch')
  visible(body,'public role page')
  check(plain(body).includes(c.employer),'public detail employer mismatch')
  const identifiers=[...body.matchAll(/\bselectedJobId\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1])
  check(identifiers.length>0&&identifiers.every(value=>value===id),'public detail role identity mismatch')
  check(!/\b(?:job (?:is )?(?:closed|expired|no longer)|position (?:is )?(?:closed|filled)|no longer accepting applications)\b/i.test(plain(body)),'public detail visibly closed')
  check(srcs(detail).includes(DETAIL_CLIENT_URL)&&/\bid\s*=\s*["']apply-job["']/i.test(body),'public native application context changed')
  check(!/<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(detail),'unreviewed structured criteria schema')
  const full=section(body);visible(full.html,'public description')
  check(plain(row.description)===plain(full.html),'native/full public description criteria mismatch')
  const outside=body.slice(0,full.start)+body.slice(full.end)
  check(!/\b(?:qualifications?|requirements?|eligibility|responsibilities)\b/i.test(plain(outside)),'unreviewed criteria outside full description')
  const fields=info?.jobListingSetting?.jobFields
  check(Array.isArray(fields)&&fields.every(field=>DISPLAY_FIELDS.has(field)),'unreviewed public field visibility')
  const locationRows=geography(row.jobLocations)
  const unknown=!fields.includes('location')||locationRows.length===0||locationRows.some(l=>!l.country)
  const india=locationRows.filter(l=>l.country==='India'),known=[...new Set(locationRows.map(l=>l.country).filter(Boolean))]
  const country=unknown?null:india.length?'India':known.join(' / ')
  const posted=nativeDate(row.publishedOn,'native publication'),expiries=[row.closingDate,row.expiryDate,row.validThrough].filter(v=>v!=null&&v!=='').map(v=>nativeDate(v,'native expiry'))
  check(new Set(expiries).size<=1,'conflicting native expiry fields')
  const expiry=expiries[0]??null
  check(!posted||+new Date(posted)<=+new Date(now),'future native publication')
  check(!expiry||+new Date(expiry)>+new Date(now)&&(!posted||+new Date(expiry)>+new Date(posted)),'expired or inconsistent native role')
  const show=field=>fields.includes(field),locations=show('location')?india:[],primary=locations[0],remote=show('location')&&(row.isRemote===true||locations.some(l=>/^remote$/i.test(clean(l.name))))
  const sourceUrl=c.root+'jobdetails/'+id,applyUrl=c.root+'applyjob/'+id,location=primary?[clean(primary.city)||clean(primary.name),clean(primary.state),'India'].filter(Boolean).join(', '):null
  const experience=show('experience')&&row.experience!=null?typeof row.experience==='number'?row.experience+' '+(row.experience===1?'year':'years'):clean(row.experience)||null:null
  const published=show('dateOfPosting')?posted:null,requisition=show('jobNumber')?clean(row.jobNumber)||null:null
  const publicSalary=show('salaryRange')&&row.salaryRange&&row.salaryRange.maximum!==0&&clean(row.salaryRangeFormat)
  const job={source:c.source,company:c.companyName,legalEmployer:c.employer,companyCareerPage:c.officialUrl,companyDomain:new URL(c.officialUrl).hostname.replace(/^www\./,''),atsPlatform:'keka-embed-api',id,jobId:id,sourceJobId:id,requisitionId:requisition,title,department:clean(row.departmentName)||null,location,locations:locations.map(l=>[clean(l.city)||clean(l.name),clean(l.state),'India'].filter(Boolean).join(', ')),city:primary&&clean(primary.city)||null,state:primary&&clean(primary.state)||null,country,remoteStatus:remote?'Remote':null,sourceUrl,applyUrl,link:applyUrl,applicationLinkSource:'reviewed-public-native-detail-client',applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false,employmentType:show('jobType')?({1:'Part Time',2:'Full Time'}[row.jobType]??null):null,experienceRequired:experience,minimumQualification:null,preferredQualification:null,requiredSkills:row.skillNames.map(clean),compensation:show('salaryRange')?clean(row.salaryRangeFormat)||null:null,jobDescription:full.html,sourceDescription:full.html,nativeDescriptionSections:{description:full.html},postingDate:published,postedAt:published,nativePublicationDate:published,nativePublicationSource:published?'active.publishedOn':null,nativePublicationPrecision:published?published.length===10?'day':'instant':null,closingDate:expiry,nativeExpiryRaw:expiry,sourceClosingDateIsExact:Boolean(expiry&&expiry.length>10),nativeCountryEvidence:show('location')?locationRows:[],nativePublicFieldVisibility:fields,publicRolePageFetched:true,publicExperienceChecked:true,sourceDetailComplete:true,sourceAvailabilityVerified:true,sourceActive:true,scrapedAt:now}
  job.compensation=publicSalary?clean(row.salaryRangeFormat):null
  job.nativeCompensation=publicSalary?row.salaryRange:null
  return {job,country,reasons:unknown?['unknown-explicit-job-country:'+id]:[],semantic:{row,fullDescription:full.html,title,employer:c.employer,fields,applyUrl}}
}

export function extractCareerConfig(html,c) {
  const blocks=[...commentsRemoved(html).matchAll(/window\.khConfig\s*=\s*\{([^]*?)\}/g)]
  if(blocks.length!==1)return null
  const read=k=>blocks[0][1].match(new RegExp('\\b'+k+'\\s*:\\s*[\'"]([^\'"]+)[\'"]'))?.[1]
  const identifier=read('identifier'),domain=read('domain'),portalName=read('portalName')??'default'
  return identifier===c.identifier&&domain===c.root&&portalName==='default'?{identifier,domain,portalName}:null
}
export function extractDocument(html,c) {
  const paths=[...commentsRemoved(html).matchAll(/fetch\(\s*["']([^"']+careerportal\/[^"']+\.html)["']/g)].map(m=>safeUrl(m[1],c.shellUrl))
  return paths.length===1&&paths[0]===c.documentUrl?paths[0]:null
}
export const buildActiveJobsUrl=(input,c)=>input?.identifier===c.identifier&&input?.domain===c.root&&input?.portalName==='default'?c.root+'api/embedjobs/default/active/'+c.identifier:null

export async function runNativeKeka(c,options={}) {
  check(['acciojob','openfinancialtechnologies'].includes(c.source),'unsupported employer')
  const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),maxJobs=options.maxJobs??Infinity,interval=options.requestIntervalMs??1000,timeout=options.timeoutMs??150000
  check(Number.isFinite(+new Date(now)),'invalid verification clock');check(maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid caller cap')
  check(Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl),'invalid request pacing')
  check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'invalid source deadline')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Keka bounded source deadline exceeded')),timeout)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],previous=new Map(),allowedDetails=new Set()
  const activeUrl=buildActiveJobsUrl({identifier:c.identifier,domain:c.root,portalName:'default'},c),infoUrl=c.root+'api/organization/default/careerportalinfo',groupUrl=c.root+'api/embedjobs/grouplinkstatus/'+c.identifier,embedUrl=c.root+'api/embedjobs/js/'+c.identifier
  const allowed=new Set([c.officialUrl,c.shellUrl,c.documentUrl,embedUrl,infoUrl,groupUrl,activeUrl,DETAIL_CLIENT_URL,...c.styles.map(([url])=>url)])
  const bounded=operation=>new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(signal.reason??Error('Keka aborted'))},cleanup=()=>signal.removeEventListener('abort',abort);if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});Promise.resolve().then(operation).then(v=>{cleanup();resolve(v)},e=>{cleanup();reject(e)})})
  const get=async(url,json=false)=>{
    signal.throwIfAborted();check(allowed.has(url)||allowedDetails.has(url),'request outside public read-only native contract')
    const origin=new URL(url).origin,wait=interval-(Date.now()-(previous.get(origin)??0));if(wait>0)await delay(wait,undefined,{signal});previous.set(origin,Date.now())
    const response=await bounded(()=>(options.fetchImpl??globalThis.fetch)(url,{method:'GET',redirect:'manual',signal,headers:{Accept:json?'application/json':'text/html,application/javascript,text/js,*/*'}}))
    if(response.status!==200)throw Object.assign(Error('Keka public HTTP '+response.status+'; stopped without retry'),{status:response.status,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:[401,403,429].includes(response.status)?'public_access_denied':'network_or_timeout'})
    check(!response.url||response.url===url,'public redirect identity changed')
    const mime=response.headers?.get?.('content-type')??'',js=url===embedUrl||url===DETAIL_CLIENT_URL,css=c.styles.some(([value])=>value===url)
    check(!mime||(json?/\b(?:application|text)\/[^;]*json/i:js?/\b(?:application|text)\/(?:x-)?(?:javascript|ecmascript|js)/i:css?/\btext\/css/i:/\btext\/html/i).test(mime),'public response MIME changed')
    const body=await bounded(()=>response.text());check(typeof body==='string'&&Buffer.byteLength(body)<=5000000,'oversized/invalid native response')
    receipts.push({url,method:'GET',status:response.status,bodySHA256:sha256(body),bodyBytes:Buffer.byteLength(body),observedAt:new Date().toISOString()})
    return json?JSON.parse(body):body
  }
  const snapshot=async()=>{
    const corporate=await get(c.officialUrl),corporateLinks=links(corporate).map(link=>{try{return safeUrl(link,c.officialUrl)}catch{return null}}).filter(Boolean)
    check(corporateLinks.includes(c.shellUrl),'corporate delegation/handoff changed')
    const reasons=[]
    if(/<(?:iframe|form)\b/i.test(markup(corporate)))reasons.push('unreviewed-corporate-frame-or-form')
    const other=corporateLinks.filter(url=>/keka\.com|greenhouse|lever\.co|workable|teamtailor|recruitee|\/careers?\b|\/jobs?\b|\/apply\b/i.test(url)&&url!==c.shellUrl&&url!==c.officialUrl)
    if(other.length)reasons.push('unreconciled-corporate-hiring-contexts')
    const shell=await get(c.shellUrl);check(extractDocument(shell,c),'native shell portal document changed')
    const portal=await get(c.documentUrl);check(sha256(portal)===c.documentSHA256,'unreviewed portal layout/visibility change')
    check(extractCareerConfig(portal,c)&&srcs(portal).includes(embedUrl),'native configuration identity mismatch')
    check(sha256(await get(embedUrl))===CLIENT_SHA256,'unreviewed public client change')
    for(const [url,hash] of c.styles)check(sha256(await get(url))===hash,'unreviewed native stylesheet/visibility change')
    const info=await get(infoUrl,true)
    check(info&&info.name===c.employer&&info.shortName===c.employer&&info.careersPortalDomain===new URL(c.root).hostname,'native employer identity changed')
    check(info.jobListingSetting&&Array.isArray(info.jobListingSetting.jobFields)&&info.jobListingSetting.jobFields.every(f=>DISPLAY_FIELDS.has(f)),'unreviewed field visibility')
    const group=await get(groupUrl,true);check(group&&Object.keys(group).length===1&&group.isGroupLinked===false,'unreviewed all-groups native scope')
    const rows=await get(activeUrl,true);check(Array.isArray(rows),'invalid native global inventory shape')
    const ids=new Set();for(const row of rows){const id=String(row?.id??'');check(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(+id)&&!ids.has(id),'invalid/duplicate global role identity');ids.add(id);allowedDetails.add(c.root+'jobdetails/'+id)}
    if(!rows.length)reasons.push('current-delegated-native-board-empty-whole-company-scope-unproven')
    if(rows.length)check(sha256(await get(DETAIL_CLIENT_URL))===DETAIL_CLIENT_SHA256,'unreviewed native detail/application client')
    const roles=new Map()
    for(const row of rows){const detail=await get(c.root+'jobdetails/'+row.id);try{const role=projectNativeRole(row,detail,c,info,now);roles.set(String(row.id),role);reasons.push(...role.reasons)}catch(error){if(error.code!=='ACCIO_OPEN_NATIVE_CONTRACT')throw error;reasons.push('unresolved-full-role:'+row.id+':'+error.message)}}
    return {rows,info,group,roles,reasons,corporateContexts:[...new Set(corporateLinks.filter(u=>u===c.shellUrl||other.includes(u)))]}
  }
  try {
    const opening=await snapshot(),closing=await snapshot(),reasons=[...opening.reasons,...closing.reasons]
    if(canonical(opening.rows)!==canonical(closing.rows)||canonical(opening.info)!==canonical(closing.info)||canonical(opening.corporateContexts)!==canonical(closing.corporateContexts))reasons.push('opening-closing-native-scope-or-inventory-changed')
    const healthy=[]
    for(const row of opening.rows){const a=opening.roles.get(String(row.id)),b=closing.roles.get(String(row.id));if(!a||!b)continue;if(canonical(a.semantic)!==canonical(b.semantic)){reasons.push('role-changed-during-closing:'+row.id);continue}if(a.country==='India')healthy.push(a.job)}
    if(maxJobs<healthy.length)reasons.push('caller-cap-after-complete-inventory-reconciliation')
    const complete=reasons.length===0,evidence={source:c.source,surface:c.officialUrl,nativeSurface:c.shellUrl,observedGlobalRecords:opening.rows.length,closingObservedGlobalRecords:closing.rows.length,confirmedIndiaRecords:healthy.length,fullCriteriaEligibleIndiaRecords:healthy.length,publicationPolicyEligibleIndiaRecords:healthy.length===0?0:null,publicationPolicyEvaluation:'registered-policy-evaluated-separately',confirmedForeignRecords:[...opening.roles.values()].filter(r=>r.country&&r.country!=='India').length,countryUnknownRecords:[...opening.roles.values()].filter(r=>!r.country).length,partialRecords:opening.rows.length-opening.roles.size,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,closingReconciled:opening.roles.size===opening.rows.length&&closing.roles.size===closing.rows.length&&!reasons.some(r=>/changed|unresolved-full-role/.test(r)),sourceScope:'all unfiltered records on current corporate-delegated default native board',corporateHiringContexts:opening.corporateContexts,reasons:[...new Set(reasons)],retainedResponses:receipts,verifiedAt:now,applicationSubmitted:false,candidateActionsTaken:false}
    const jobs=healthy.slice(0,maxJobs).map(job=>({...job,sourceScopeComplete:complete,sourceListingComplete:complete,lifecycleCleanupAllowed:complete,sourceObservedGlobalJobCount:opening.rows.length,sourceObservedIndiaJobCount:healthy.length,nativeCollectionEvidence:evidence}))
    Object.defineProperty(jobs,'nativeInventoryEvidence',{value:evidence})
    return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'coverage-gap',surface:c.officialUrl,firstParty:true,listingComplete:complete,pagesFetched:receipts.length,reportedTotal:opening.rows.length,indiaFacetCount:healthy.length,verifiedAt:now,reason:complete?'complete-native-opening-details-and-closing-snapshot':evidence.reasons.join(';')})
  }catch(error){if(/fetch failed|timeout|timed out|deadline|socket|econn|enotfound|tls/i.test(error.message))Object.assign(error,{abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'});throw error}finally{clearTimeout(timer)}
}
