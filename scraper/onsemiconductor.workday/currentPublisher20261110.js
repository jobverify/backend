import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../../scraper-support/utils/verifiedRecruitment.js'

export const CAREERS='https://www.onsemi.com/careers'
export const HISTORY='https://www.onsemi.com/company/about-onsemi/company-history'
export const NATIVE_SITE='https://hctz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001'
const api='https://hctz.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/'
const fields=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr']
const publicFields=[...fields,'CorporateDescriptionStr','OrganizationDescriptionStr']
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,message)=>{if(!value)throw Error('onsemi current contract: '+message)}
const clean=value=>decodeNativeEntities(String(value||'')).replace(/\s+/g,' ').trim()
function active(html){
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],nodes=[],blocks=[],body=[]
 const walk=(node,inHeading=false)=>{
  if(node.inert||['blockquote','q','pre','code','template','script','style','noscript'].includes(node.tag))return
  nodes.push(node)
  const heading=inHeading||['title','h1','h2','h3','h4','h5','h6'].includes(node.tag)
  for(const child of node.children){if(typeof child==='string'){blocks.push(clean(child));if(!heading)body.push(clean(child))}else{blocks.push('\n');body.push('\n');walk(child,heading);blocks.push('\n');body.push('\n')}}
 }
 walk(root)
 return {nodes:predicate=>nodes.filter(predicate),text:blocks.join(' ').replace(/ *\n */g,'\n'),substantive:body.join(' ').replace(/ *\n */g,'\n'),nodeText:node=>{
  const visit=n=>n.inert||['blockquote','q','pre','code','template','script','style','noscript'].includes(n.tag)?'':n.children.map(c=>typeof c==='string'?c:visit(c)).join(' ')
  return clean(visit(node))
 }}
}
export function validateCorporate(careers,history){
 const c=active(careers),h=active(history)
 need(c.nodes(n=>n.tag==='title'&&clean(n.raw)==='Careers | onsemi').length===1,'active careers publisher changed')
 need(c.nodes(n=>n.tag==='a'&&n.attrs.href===NATIVE_SITE).length>0
  &&c.nodes(n=>n.tag==='a'&&n.attrs.href===NATIVE_SITE+'/requisitions?mode=location').length>0,'literal native handoff changed')
 need(c.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'',CAREERS).href===HISTORY).length>0,'current company-history declaration missing')
 need(h.nodes(n=>n.tag==='title'&&/Company History.*onsemi/.test(clean(n.raw))).length===1,'active company-history publisher changed')
 need(/In 2021, to better reflect its broad technology portfolio, differentiated product lines, and market leadership, ON Semiconductor rebranded itself as onsemi\s*\./.test(h.text.replace(/\s+/g,' ')),'registered-name rebrand declaration changed')
 return {registeredCompany:'ON Semiconductor',publisherBrand:'onsemi',relationship:'current-first-party-company-history-rebrand',historyURL:HISTORY,nativeSite:NATIVE_SITE,legalEmployer:null}
}
export async function readPublisherDeclaration({page,readPage,readDeclaredBoardPage,phase}){
 const history=await readPage(HISTORY),context=validateCorporate(page.html,history.html)
 const native=await readDeclaredBoardPage(NATIVE_SITE),doc=active(native.html)
 need(doc.nodes(n=>n.tag==='title'&&clean(n.raw)==='Jobs onsemi').length===1,'native publisher changed')
 need(doc.nodes(n=>n.tag==='base'&&n.attrs.href==='/hcmUI/CandidateExperience/en/sites/CX_1001'
  &&n.attrs['data-sitenumber']==='CX_1001'&&n.attrs['data-apibaseurl']==='https://hctz.fa.us2.oraclecloud.com:443').length===1,'native account changed')
 return {url:NATIVE_SITE,context,evidence:{phase,...context,careersBodySHA256:sha(page.html),historyBodySHA256:sha(history.html),nativeBodySHA256:sha(native.html)}}
}
// Written countries only. Never infer geography from a city or plant code.
const display=new Intl.DisplayNames(['en'],{type:'region'}),countryNames=new Set(['USA','U.S.','UK','United States of America','South Korea','North Korea','Czech Republic','Turkey'])
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=display.of(code)
 if(name!==code&&code!=='IN'&&!['ZZ','EU','EZ','UN','QO','XA','XB'].includes(code))countryNames.add(name)
}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const foreign=new RegExp('(?:^|[^\\p{L}])(?:'+[...countryNames].sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?=$|[^\\p{L}])','iu')
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
 &&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===value.slice(0,10)
const substantive=text=>clean(text).length>=100&&text.replace(/[^\p{L}]/gu,'').length>=60&&text.trim().split(/\s+/).length>=15
function combinedSection(html,kind){
 const doc=active(html),body=doc.substantive.split('\n'),lines=doc.text.split('\n').map((label,index)=>({label:clean(label),body:body[index]||''})).filter(row=>row.label)
 const section=line=>/^(?:Qualifications?|Qualifications? for (?:Internal|External) Candidates|Minimum Requirements)\s*:?$/i.test(line)?'qualifications'
  :/^(?:Responsibilities|Responsibilities for (?:Internal|External) Candidates)\s*:?$/i.test(line)||/\bIn this role,? you will focus on the following\s*:?$/i.test(line)?'responsibilities':null
 for(let i=0;i<lines.length;i++)if(section(lines[i].label)===kind){let end=i+1;while(end<lines.length&&!section(lines[end].label))end++;if(substantive(lines.slice(i+1,end).map(line=>line.body).join(' ')))return true}
 return false
}
export function roleHold(record){
 const {detail:d,listing:l}=record
 if(!d||!l||d.Id!==l.Id||d.Title!==l.Title)return 'native-role-identity-conflict'
 if(publicFields.some(f=>d[f]!=null&&typeof d[f]!=='string')||fields.some(f=>typeof d[f]!=='string'))return 'native-public-field-shape-unreviewed'
 if(!validDate(d.ExternalPostedStartDate)||d.ExternalPostedEndDate!=null&&(!validDate(d.ExternalPostedEndDate)||Date.parse(d.ExternalPostedEndDate)<Date.parse(d.ExternalPostedStartDate)))return 'native-role-dates-unresolved'
 if(d.LegalEmployer||l.LegalEmployer||d.requisitionFlexFields?.some(f=>/legal employer/i.test(f.Prompt||f.Name||'')))return 'unreviewed-native-legal-employer'
 if(d.PrimaryLocationCountry!=='IN'||l.PrimaryLocationCountry!=='IN')return 'native-primary-country-unresolved'
 if(foreign.test(d.PrimaryLocation||'')||foreign.test(l.PrimaryLocation||''))return 'native-worksite-country-conflict'
 for(const place of [...(d.secondaryLocations||[]),...(l.secondaryLocations||[])])if(place.CountryCode!=='IN'||foreign.test(place.LocationName||place.Name||''))return 'native-worksite-country-conflict'
 for(const place of [...(d.workLocation||[]),...(d.otherWorkLocations||[])]){
  if(place.Country!=='IN'||foreign.test([place.LocationName,place.TownOrCity,place.Region1,place.Region2,place.AddressLine1,place.AddressLine2,place.AddressLine3,place.AddressLine4].join(' ')))return 'native-worksite-country-conflict'
 }
 const a=publicFields.map(f=>active(d[f]||'').text).join('\n'),flat=a.replace(/\s+/g,' ')
 for(const label of a.matchAll(/\bcountry(?:[ \t]+code)?[ \t]*:[ \t\n]*([^\n.;]+)/gi))if(nativeCountryName(clean(label[1]))!=='India')return 'native-criteria-country-conflict'
 const labels=flat.matchAll(/(?:Employer|Organization Name|Company Name)\s*:\s*([^.;\n]+)/gi)
 for(const label of labels)if(!/^(?:onsemi|ON Semiconductor)(?:\s*$)/i.test(label[1].trim()))return 'native-employer-contradiction'
 if(/(?:you|the successful candidate|the candidate)\s+(?:will\s+)?(?:not\s+|won't\s+|are not\s+)?(?:be\s+)?(?:employed by|an? employee of)\s+/i.test(flat)
  ||/\b(?:onsemi|ON Semiconductor)\s+(?:is not|isn't|will not be)\s+(?:your|the)\s+employer/i.test(flat)
  ||/\b(?:your|the successful candidate's|the candidate's)\s+(?:legal\s+)?employer\s+(?:will be|is)\s+/i.test(flat))return 'native-employer-contradiction'
 for(const assignment of flat.matchAll(/\b(?:this|the)\s+(?:role|position|job)\s+is\s+(?:for|with|at)\s+([^.;]+)/gi))if(!/^(?:onsemi|ON Semiconductor)(?:\b|['’])/i.test(assignment[1].trim()))return 'native-employer-contradiction'
 for(const sentence of flat.split(/[.!?](?:\s|$)/))if((/\b(?:this role|the role|this position|the position|you)\b.{0,60}\b(?:based|located|work(?:ing)?)\s+(?:in|at|from)\b/i.test(sentence)
  ||/\b(?:work\s*location|job\s*location|workplace|office location|location|country)\s*:/i.test(sentence))&&foreign.test(sentence))return 'native-criteria-country-conflict'
 if(!substantive(active(d.ExternalDescriptionStr).substantive)
  ||!substantive(active(d.ExternalResponsibilitiesStr).substantive)&&!combinedSection(d.ExternalDescriptionStr,'responsibilities')
  ||!substantive(active(d.ExternalQualificationsStr).substantive)&&!combinedSection(d.ExternalDescriptionStr,'qualifications'))return 'native-full-criteria-unavailable'
 return null
}
const detailURL=id=>api+'recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22'+id+'%22,siteNumber=CX_1001'
const listingURL=offset=>api+'recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=20,offset='+offset+',keyword=India'
const listingModel=row=>JSON.stringify(row)
export async function runCurrent(options={}){
 need(!options.fetchPage&&!options.fetchJson,'transport receipts require fetchImpl, not metadata-free callbacks')
 const budget=options.sourceTimeoutMs??180000
 need(Number.isSafeInteger(budget)&&budget>0&&budget<=180000,'invalid source deadline')
 const started=performance.now(),caller=options.signal,controller=new AbortController(),receipts=[],blocked=new Set(),payloads=new Map()
 const timeout=new DOMException('onsemi source deadline exceeded','TimeoutError'),timer=setTimeout(()=>controller.abort(timeout),budget)
 const signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=budget)controller.abort(timeout);signal.throwIfAborted()}
 let requests=0,bytesRead=0,observed,blockedFailure,blockedPacket,blockedResponse
 const read=async(url,init={})=>{
  check();need((init.method||'GET')==='GET','only public GET requests are allowed')
  const u=new URL(url);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'invalid public URL')
  need(u.hostname==='www.onsemi.com'||u.origin==='https://hctz.fa.us2.oraclecloud.com','unreviewed origin')
  need(!blocked.has(u.origin),'native origin already denied; no retry')
  need(++requests<=(options.maxRequests??128),'source request budget reached')
  const requestedAt=new Date().toISOString()
  const p=await boundedDeclaredPublicRead(u.href,{fetchImpl:options.fetchImpl||fetch,signal,timeoutMs:Math.min(15000,Math.max(1,Math.ceil(budget-(performance.now()-started)))),overflowError:Error('onsemi response byte bound exceeded')})
  check();const bytes=Buffer.from(p.bodyBase64,'base64'),body=bytes.toString('utf8')
  bytesRead+=bytes.length
  const receipt={requestedURL:u.href,method:'GET',requestedAt,completedAt:new Date().toISOString(),status:p.status,finalURL:p.url,headers:p.headers,bodyBytes:bytes.length,bodySHA256:sha(bytes)}
  receipts.push(receipt)
  if(p.status===403||p.status===429||/<title[^>]*>\s*(?:access denied|forbidden|just a moment)/i.test(body)){
   blocked.add(u.origin)
   blockedFailure??=Object.assign(Error('onsemi public GET HTTP '+p.status+' access challenge; no retry'),{status:p.status,code:'RECRUITMENT_PUBLIC_ACCESS_DENIED',requestUrl:u.href})
   blockedPacket??={...receipt,url:u.href,failure:blockedFailure}
   // Retain one complete denied entity only; never truncate and represent it
   // as the original response. Larger entities keep bounded metadata alone.
   if(!blockedResponse&&bytes.length<=2*1024*1024)blockedResponse={...receipt,url:u.href,rawBodyBase64:p.bodyBase64}
   throw blockedFailure
  }
  need(bytes.length<=4e6&&bytesRead<=24e6,'source byte budget reached')
  need(p.url===u.href,'transport final URL changed')
  if(p.status===302){
   need(u.href===NATIVE_SITE+'/requisitions?mode=location'&&p.headers.location===NATIVE_SITE+'/jobs?mode=location','unreviewed native redirect')
   return read(p.headers.location,init)
  }
  if(p.status===200&&/json/i.test(p.headers['content-type']||'')){payloads.set(u.href,JSON.parse(body));check()}
  const response=new Response(bytes,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});check();return response
 }
 try{
  const jobs=await createVerifiedRecruitmentScraper({source:'onsemiconductor',companyName:'ON Semiconductor',publisherNames:['onsemi'],companyDomain:'onsemi.com',officialHomepageUrl:CAREERS,companyCareerPage:CAREERS,requireCorporateIdentityMatch:true,requireNativeEmployerName:false,prioritizeRecruitmentSearch:true,nativeOracleCandidateSite:NATIVE_SITE,readCurrentPublisherDeclaration:readPublisherDeclaration}).run({...options,signal,fetchImpl:read,maxRequests:options.maxRequests??128,maxDetails:options.maxDetails??80,maxPages:options.maxPages??4,sourceTimeoutMs:budget})
  check();observed=jobs[RECRUITMENT_OBSERVATIONS];const held=[]
  for(let i=jobs.length-1;i>=0;i--){const reason=roleHold(jobs[i].nativeSourceRecord);if(reason){held.unshift({id:jobs[i].jobId,reason,record:jobs[i].nativeSourceRecord});jobs.splice(i,1)}}
  const openingRows=(observed.nativeOracleRecords||[]).map(r=>r.listing),closingRows=[]
  for(let offset=0;offset<openingRows.length;offset+=20){const url=listingURL(offset),response=await read(url);need(response.status===200&&/json/i.test(response.headers.get('content-type')||''),'closing inventory transport changed');const p=payloads.get(url);need(p?.count===1&&p.hasMore===false&&p.items?.length===1&&p.items[0].SiteNumber==='CX_1001'&&p.items[0].Offset===offset&&p.items[0].TotalJobsCount===openingRows.length,'closing inventory identity changed');closingRows.push(...p.items[0].requisitionList)}
  need(JSON.stringify(closingRows.map(listingModel))===JSON.stringify(openingRows.map(listingModel)),'closing inventory changed')
  for(const job of jobs){const url=detailURL(job.jobId),response=await read(url);need(response.status===200&&/json/i.test(response.headers.get('content-type')||''),'closing detail transport changed');const p=payloads.get(url);need(p?.count===1&&p.hasMore===false&&p.items?.length===1&&JSON.stringify(p.items[0])===JSON.stringify(job.nativeSourceRecord.detail),'closing own criteria or identity changed');job.sourcePublisherBrand='onsemi';job.sourceRegisteredCompany='ON Semiconductor';job.sourceNativeClosingEvidence={detailURL:url,detailSHA256:sha(JSON.stringify(p.items[0])),inventoryRechecked:true,companyScopeComplete:false}}
  observed.returnedIndiaJobs=jobs.length;observed.onsemiHeldRoles=held;observed.onsemiTransportReceipts=receipts
  if(held.length)observed.unresolved.push('source-own-role-qualification-held')
  need(jobs.length>0||openingRows.length===0,'all native India candidates failed qualification')
  check();return jobs
 }catch(error){
  check();error.onsemiTransportReceipts=receipts;if(observed)error.recruitmentObservations=observed
  if(blockedFailure){
   Object.assign(error,{status:blockedFailure.status,code:blockedFailure.code,softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied',abortRetries:true})
   if(error!==blockedFailure)error.cause=blockedFailure
   error.nativeEvidence={source:'onsemiconductor',observedListingCount:error.recruitmentObservations?.nativeRecords??null,
    inventoryComplete:false,lifecycleCleanupAllowed:false,transportPackets:[blockedPacket],failures:[blockedFailure],
    retainedResponses:blockedResponse?[blockedResponse]:[],deniedBodyRetention:blockedResponse?'one complete original entity':'body exceeds2MiB; original metadata retained without fabricated/truncated bytes'}
  }
  throw error
 }finally{clearTimeout(timer)}
}
