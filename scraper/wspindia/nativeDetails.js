import {createHash} from 'node:crypto'
import {extractActiveDescription,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {oracleRecruitmentEmployer} from '../../scraper-support/utils/recruitmentOracle.js'

export const PUBLIC_ROLE_FIELDS=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr']
export const PUBLIC_DESCRIPTION_FIELDS=[...PUBLIC_ROLE_FIELDS,'CorporateDescriptionStr','OrganizationDescriptionStr']
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const need=(condition,message,code='WSP_NATIVE_ROLE')=>{
  if(!condition)throw Object.assign(Error('WSP India native role: '+message),{code})
}
const declaration=html=>{
  const doc=readNativeDocument(html),blocked=new Set(['blockquote','q','pre','code','script','style','template','aside','object','iframe','noscript'])
  const ownText=node=>node.inert||blocked.has(node.tag)?'':node.children.map(child=>
    typeof child==='string'?decodeNativeEntities(child):ownText(child)).join(' ')
  const visit=node=>node.inert||blocked.has(node.tag)?[]:[
    ...(['p','li','div'].includes(node.tag)?[clean(ownText(node))]:[]),
    ...node.children.filter(child=>typeof child!=='string').flatMap(visit),
  ]
  for(const paragraph of visit(doc.nodes(node=>node.tag==='root')[0])){
    if(paragraph.startsWith("WSP is one of the world's leading professional services consulting firms."))return{name:'WSP',statement:paragraph}
    if(/^(?:BGV:\s*[\u2022-]?\s*)?Employment with WSP India is subject to the successful completion of a background verification/.test(paragraph)
      ||paragraph.startsWith('WSP India is currently seeking '))return{name:'WSP India',statement:paragraph}
    if(paragraph.startsWith('WSP is currently seeking '))return{name:'WSP',statement:paragraph}
  }
  return null
}
const date=(value,field)=>{
  if(value==null||value==='')return{raw:value??null,iso:null,precision:null}
  need(typeof value==='string'&&/^(?:19|20)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'invalid native '+field)
  const parsed=new Date(value)
  need(Number.isFinite(parsed.getTime())&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10),'invalid native calendar '+field)
  return{raw:value,iso:parsed.toISOString(),precision:value.includes('.')?'millisecond':'second'}
}
export function qualifyNativeWspRole(job,payload,clock){
  need(typeof job.jobId==='string'&&/^[1-9]\d{0,15}$/.test(job.jobId),'invalid advertised native requisition identifier')
  const rows=payload?.items
  need(Array.isArray(rows)&&rows.length===1,'Oracle requisition identity changed')
  const detail=rows[0]
  need((typeof detail.Id==='string'||Number.isSafeInteger(detail.Id))
    &&String(detail.Id)===job.jobId&&clean(detail.Title)===job.title,'Oracle requisition identity changed')
  const url=new URL(job.sourceUrl)
  need(url.origin==='https://emit.fa.ca3.oraclecloud.com'
    &&new RegExp('^/hcmUI/CandidateExperience/en/sites/CX_2001/(?:job/|requisitions/preview/)'+job.jobId+'$').test(url.pathname)
    &&!url.search&&!url.hash,'Oracle public role URL changed')
  need(nativeCountryName(detail.PrimaryLocationCountry)==='India','Oracle primary worksite does not prove India')
  const countries=[detail.PrimaryLocationCountry,...(detail.secondaryLocations||[]).map(place=>place.CountryCode),
    ...(detail.workLocation||[]).map(place=>place.Country)].filter(value=>value!=null&&value!=='')
  need(countries.every(value=>nativeCountryName(value)==='India'),'Oracle native India worksite countries conflict or are unreviewed')
  need(PUBLIC_DESCRIPTION_FIELDS.every(field=>detail[field]==null||typeof detail[field]==='string'),'native public criteria field type changed')
  const role=PUBLIC_ROLE_FIELDS.map(field=>detail[field]).filter(value=>value?.trim()).join('\n')
  need((extractActiveDescription(role)||'').length>=100,'full public role criteria missing','WSP_NATIVE_CONTENT_MISSING')
  const descriptionHTML=PUBLIC_DESCRIPTION_FIELDS.map(field=>detail[field]).filter(value=>value?.trim()).join('\n')
  const description=extractActiveDescription(descriptionHTML)
  const explicit=oracleRecruitmentEmployer(detail)
  let employer=explicit.employer,binding=null
  if(employer)need(['WSP','WSP India'].includes(employer.name),'unreviewed explicit native legal employer')
  else{
    for(const field of PUBLIC_DESCRIPTION_FIELDS){
      const statement=declaration(detail[field]||'')
      if(statement){employer={name:statement.name};binding={method:'explicit-native-role-employer-statement',field,
        statement:statement.statement,legalEmployer:null};break}
    }
    need(employer,'own explicit native employer statement missing')
  }
  const posted=date(detail.ExternalPostedStartDate,'publication'),closing=date(detail.ExternalPostedEndDate,'closing date')
  need(!posted.iso||Date.parse(posted.iso)<=Date.parse(clock),'native publication is in the future')
  need(!closing.iso||Date.parse(closing.iso)>Date.parse(clock)
    &&(!posted.iso||closing.iso>=posted.iso),'native public role has expired')
  return{
    ...job,country:'India',companyDomain:'wsp.com',atsPlatform:'oracle-cloud',
    jobDescription:description,sourceDescription:description,
    nativeSourceRecord:{nativeSiteNumber:'CX_2001',listing:structuredClone(job),detail:structuredClone(detail)},
    nativeHiringOrganization:employer,nativeEmployerBinding:binding,
    nativeDescriptionFields:PUBLIC_DESCRIPTION_FIELDS.filter(field=>detail[field]?.trim()),
    nativeDescriptionSHA256:createHash('sha256').update(descriptionHTML).digest('hex'),
    sourceRoleDescription:extractActiveDescription(role),
    postingDate:posted.iso,closingDate:closing.iso,sourcePostedDateRaw:posted.raw,sourceClosingDateRaw:closing.raw,
    sourceDatePrecision:posted.precision,sourceClosingDatePrecision:closing.precision,firstEverPublication:null,
    sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    applicationVisited:false,
  }
}

export async function readWspResponse(url,{signal,json=false}={}){
  const budget=AbortSignal.any([AbortSignal.timeout(20000),...(signal?[signal]:[])])
  const response=await fetch(url,{redirect:'manual',credentials:'omit',signal:budget,
    headers:{'User-Agent':'Mozilla/5.0',Accept:json?'application/json':'text/html,application/xhtml+xml'}})
  if(response.url!==url||json&&response.status!==200){
    void response.body?.cancel().catch(()=>{})
    throw Object.assign(Error('WSP India HTTP '+response.status+' or response URL mismatch at '+url),{status:response.status,abortRetries:true})
  }
  const chunks=[];let size=0
  if(response.body)for await(const chunk of response.body){
    size+=chunk.byteLength
    if(size>4e6)throw Error('WSP India response body bound')
    chunks.push(Buffer.from(chunk))
  }
  budget.throwIfAborted()
  const text=Buffer.concat(chunks).toString('utf8')
  if(json){
    need(/(?:application|text)\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type')||''),'native response is not JSON')
    return JSON.parse(text)
  }
  return{status:response.status,url:response.url,html:text}
}
