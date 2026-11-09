import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {CANONICAL_CITIES} from '../../scraper-support/utils/cities.js'

export const SOURCE='eptura',COMPANY='Eptura',CAREERS='https://eptura.com/careers/',BOARD='https://eptura.pinpointhq.com/',LISTING=BOARD+'postings.json'
const requireNative=(ok,message)=>{if(!ok)throw Error('Eptura native: '+message)}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const plain=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<1000&&!/[<>\u0000-\u001f]/.test(value)
const closed=/\b(?:this (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i
const foreign=/\b(?:United States|USA|United Kingdom|Australia|France|Germany|Canada|Singapore|Israel|Portugal|Brazil|Philippines|Mexico|New York|Sydney|Paris|London|Tokyo)\b|(?:^|[,\s/])(?:US|AU|FR|GB|UK|DE|CA|SG|IL|PT|BR|PH|MX|JP)(?=$|[,\s/])/i
const cityKey=value=>value.toLowerCase().replace(/\bgurgaon\b/g,'gurugram').replace(/\bbangalore\b/g,'bengaluru')
const indiaCity=value=>plain(value)&&Object.hasOwn(CANONICAL_CITIES,value.toLowerCase())&&!/^remote|india$/i.test(value)
const document=value=>{requireNative(typeof value==='string'&&value.length>0&&value.length<=3000000,'Native body missing or over bound');return readNativeDocument(value)}
const canonical=(value,expected)=>{requireNative(typeof value==='string'&&value===expected,'Native URL identity mismatch');return value}
function timestamp(value,now,label){
 if(value==null||value==='')return null
 requireNative(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'Malformed native '+label)
 const [year,month,day]=value.slice(0,10).split('-').map(Number)
 requireNative(month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate()&&Number.isFinite(Date.parse(value)),'Invalid native '+label+' calendar')
 requireNative(label!=='publication'||Date.parse(value)<=Date.parse(now),'Future native publication date')
 return new Date(value).toISOString()
}
function envelope(v){
 requireNative(v&&typeof v==='object'&&!Array.isArray(v),'Native envelope missing')
 for(const[k,value]of Object.entries(v)){
  if(/^(?:error|errors|exception|fault)$/i.test(k))requireNative(value==null||value===''||Array.isArray(value)&&value.length===0,'Native error envelope')
  if(/^(?:success|ok)$/i.test(k))requireNative(value===true,'Native failed envelope')
  if(/^(?:status|status_code|statusCode)$/i.test(k))requireNative(value===200||['open','published','active'].includes(value),'Native status failure')
 }
}
function board(html){
 const doc=document(html),nodes=doc.nodes(n=>n.tag==='script'&&n.attrs['data-component-name']==='External::Jobs')
 requireNative(nodes.length===1,'Current advertised jobs client missing/ambiguous')
 let config;try{config=JSON.parse(nodes[0].raw)}catch{throw Error('Eptura native: Jobs client JSON unavailable')}
 requireNative(config.url==='/postings.json'&&config.target==='external:jobs:index:16453','Current advertised tenant/listing identity changed')
 requireNative(config.showPagination===false&&config.pageSize===null,'Native pagination contract changed')
 requireNative(Array.isArray(config.excludeFilters)&&config.excludeFilters.length===2&&config.excludeFilters.every(x=>['exclude_location_id','exclude_department_id'].includes(x.attribute)&&Array.isArray(x.values)&&x.values.length===0),'Native listing has unqualified excluded scope')
 return config
}
function rows(body,now,maxRecords){
 let value;try{value=JSON.parse(body)}catch{throw Error('Eptura native: Native listing JSON unavailable')}
 envelope(value)
 requireNative(Object.keys(value).length===1&&Array.isArray(value.data)&&value.data.length>0&&value.data.length<=maxRecords,'Native listing empty/partial/envelope changed; company zero is unknown')
 const seenIds=new Set(),seenURLs=new Set()
 for(const r of value.data){
  envelope(r)
  requireNative(/^\d+$/.test(r.id)&&typeof r.title==='string'&&plain(r.title.trim())&&r.job&&/^\d+$/.test(r.job.id)&&/^PIN-\d+$/.test(r.job.requisition_id),'Native record IDs/title missing')
  requireNative(!seenIds.has(r.id)&&!seenURLs.has(r.url),'Duplicate native posting identity');seenIds.add(r.id);seenURLs.add(r.url)
  const u=new URL(r.url),id=u.pathname.split('/').at(-1)
  requireNative(u.origin===BOARD.slice(0,-1)&&uuid.test(id)&&u.pathname==='/en/postings/'+id&&!u.search&&!u.hash&&!u.username&&!u.password&&r.path===u.pathname,'Native role URL identity mismatch')
  const l=r.location;requireNative(l&&plain(l.city)&&plain(l.name)&&plain(l.province),'Native geography unavailable')
  const cityLocation=indiaCity(l.city)&&l.name===l.city&&!foreign.test(l.name+' '+l.province)
  if(l.name==='India'||l.province==='India'||cityLocation){
   requireNative((l.name==='India'&&l.province==='India'||cityLocation)&&indiaCity(l.city)&&!foreign.test(l.city),'Native India city/geography contradiction')
  }else requireNative(!indiaCity(l.city)&&!(/\bIndia\b/i.test(l.name+' '+l.province)),'Native foreign city/geography contradiction')
  for(const k of ['country','country_code','countryCode'])if(l[k]!=null)requireNative(l[k]===((l.name==='India'||cityLocation)?(k==='country'?'India':'IN'):(k==='country'?'United Kingdom':'GB')),'Native country/geography contradiction')
  for(const k of ['company','company_name','employer','organization'])if(r[k]!=null)requireNative(r[k]===COMPANY,'Native employer identity mismatch')
  for(const k of ['closed','is_closed','archived','is_archived','is_internal'])if(r[k]!=null)requireNative(r[k]===false,'Native role status is closed/internal')
  if(r.deadline_at!=null)requireNative(Date.parse(timestamp(r.deadline_at,now,'deadline'))>Date.parse(now),'Native role deadline closed')
  for(const k of ['datePosted','posted_at','published_at','postingDate','publication_date'])requireNative(r[k]==null,'Unverified listing native publication contract')
  for(const k of ['description','key_responsibilities','skills_knowledge_expertise','benefits'])requireNative(r[k]==null||typeof r[k]==='string','Native description section malformed')
 }
 return value.data
}
function core(html){
 const text=extractActiveDescription(html)
 requireNative(text&&!closed.test(text),'Native core description missing/closed')
 const sentences=text.split(/(?<=[.!?])\s+/).filter(s=>!/^please\s+(?:click apply|check back|visit|apply)/i.test(s)&&!/^.*\bjob description\b.*\b(?:unavailable|coming soon|available soon|click|view)\b/i.test(s)).join(' ')
 requireNative(sentences.replace(/[^\p{L}\p{N}]/gu,'').length>=100,'Native core description instruction-only/incomplete')
 const roleText=text.split(/\b(?:Job Description|Role Overview)\b/i).slice(1).join(' ')
 requireNative(roleText.replace(/[^\p{L}\p{N}]/gu,'').length>=100&&/\b(?:you|your|responsibilities|role|position)\b/i.test(roleText),'Native core description has no substantive role content beyond company introduction')
 return text
}
const descendants=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...(node.children||[]).filter(child=>typeof child!=='string').flatMap(child=>descendants(child,predicate))]
function nativeComponent(nodes,label){
 requireNative(nodes.length===1&&nodes[0].attrs.type==='application/json','Native '+label+' component missing/ambiguous')
 try{return JSON.parse(nodes[0].raw)}catch{throw Error('Eptura native: Native '+label+' component JSON unavailable')}
}
function detailCore(doc,schemaDescription){
 const containers=doc.nodes(n=>n.attrs.id==='external-jobs-show-description')
 requireNative(containers.length===1,'Native detail core description container missing/ambiguous')
 const component=nativeComponent(descendants(containers[0],n=>n.tag==='script'&&n.attrs['data-component-name']==='External::Careerspage::Renderrichtrixcontent'),'detail core description')
 const renderedCore=core(component.htmlString),schemaDoc=document('<div id="eptura-schema-core">'+schemaDescription+'</div>'),root=schemaDoc.nodes(n=>n.attrs.id==='eptura-schema-core')
 requireNative(root.length===1,'Native schema core description unavailable')
 const children=root[0].children,headings=children.map((n,index)=>typeof n!=='string'&&n.tag==='h3'&&schemaDoc.text(n)==='Description'?index:-1).filter(index=>index>=0)
 requireNative(headings.length===1,'Native schema core description section missing/ambiguous')
 const start=headings[0]+1,next=children.findIndex((n,index)=>index>=start&&typeof n!=='string'&&n.tag==='h3'),schemaCore=schemaDoc.text({tag:'root',attrs:{},children:children.slice(start,next<0?undefined:next)})
 requireNative(renderedCore===schemaCore,'Native detail/schema core description contradiction or truncation')
 return renderedCore
}
function role(html,row,now){
 const doc=document(html),head=activeHead(html),schemas=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>{try{return JSON.parse(n.raw)}catch{return null}}).filter(v=>v?.['@type']==='JobPosting')
 requireNative(schemas.length===1,'Native JobPosting schema missing/ambiguous')
 const s=schemas[0],id=new URL(row.url).pathname.split('/').at(-1),address=s.jobLocation?.address
 requireNative(s.title===row.title&&s.identifier?.value===id&&s.identifier?.name==='Pinpoint Job Posting ID','Native role identifier/title identity mismatch')
 const canonicals=doc.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),openGraphURLs=head.metas.filter(m=>m.property==='og:url')
 requireNative(canonicals.length===1&&canonicals[0].attrs.href===BOARD+'postings/'+id,'Native role canonical identity mismatch')
 requireNative(openGraphURLs.length===1&&openGraphURLs[0].content===row.url,'Native role Open Graph identity mismatch')
 requireNative(s.hiringOrganization?.name===COMPANY&&s.hiringOrganization?.url==='https://eptura.com'&&s.hiringOrganization?.sameAs==='https://eptura.com','Native organization/employer identity mismatch')
 requireNative(address?.addressCountry==='IN'&&address.addressLocality===row.location.city&&address.addressRegion===row.location.province&&s.jobLocation.name===row.location.name&&address.streetAddress===row.location.street_address&&address.postalCode===row.location.postal_code,'Native detail geography contradiction')
 requireNative(s.applicantLocationRequirements?.name==='India','Native applicant country contradiction')
 requireNative(head.titles.length===1&&head.titles[0]===(row.title+' - '+row.location.name+' | Eptura Careers').replace(/\s+/g,' ').trim()&&doc.nodes(n=>n.tag==='h1').some(n=>doc.text(n)===row.title.replace(/\s+/g,' ').trim()),'Native active role title mismatch')
 requireNative(!closed.test(doc.text({tag:'root',children:doc.nodes(n=>n.tag==='body'),attrs:{}})),'Native active role is closed')
 const description=core(row.description),schemaDescription=core(s.description)
 requireNative(description===detailCore(doc,s.description),'Native full core description changed/truncated between listing/detail')
 const sections=['description','key_responsibilities','skills_knowledge_expertise','benefits'].map(key=>({key,header:key==='description'?'Description':row[key+'_header']??null,html:row[key]??null,text:row[key]?extractActiveDescription(row[key]):null}))
 for(const section of sections)if(section.text)requireNative(!closed.test(section.text)&&schemaDescription.includes(section.text),'Native description section changed/closed')
 const links=doc.nodes(n=>n.tag==='a'&&/^Apply Now$/i.test(doc.text(n))).map(n=>new URL(n.attrs.href,row.url).href)
 requireNative(links.length>=1&&new Set(links).size===1,'Native advertised application entry missing/ambiguous')
 const applyURL=canonical(links[0],row.url+'/applications/new')
 const postedAt=timestamp(s.datePosted,now,'publication'),schemaDeadline=timestamp(s.validThrough,now,'deadline'),feedDeadline=timestamp(row.deadline_at,now,'deadline')
 requireNative(!schemaDeadline||!feedDeadline||schemaDeadline===feedDeadline,'Native deadline conflict between listing/detail')
 const closingDate=schemaDeadline||feedDeadline
 if(closingDate)requireNative(Date.parse(closingDate)>Date.parse(now),'Native role deadline closed')
 const full=sections.filter(x=>x.text).map(x=>[x.header,x.text].filter(Boolean).join('\n')).join('\n\n')
 return{source:SOURCE,company:COMPANY,jobId:row.id,requisitionId:row.job.requisition_id,title:row.title,
  country:'India',city:row.location.city,state:null,location:row.location.city+', India',locations:[row.location.city+', India'],
  sourceUrl:row.url,applyUrl:applyURL,link:row.url,nativePostingId:row.id,nativeJobId:row.job.id,nativePostingUUID:id,nativeRequisitionId:row.job.requisition_id,
  nativeEmployer:COMPANY,nativeLegalEmployer:null,nativeLocation:{...row.location},nativeCountry:'IN',nativePublicationDate:s.datePosted??null,nativeClosingDate:s.validThrough??row.deadline_at??null,postedAt,postingDate:postedAt,closingDate,...(closingDate?{sourceClosingDateIsExact:true}:{}),
  nativeContentSections:sections,nativeDescriptionHtml:row.description,nativeJobPosting:s,nativeListingRecord:row,
  jobDescription:full,sourceDescription:full,sourceDetailComplete:true,sourceDetailStatus:'complete',
  employmentType:row.employment_type_text??null,nativeEmploymentType:row.employment_type??null,nativeWorkplaceType:row.workplace_type??null,
  department:row.job.department?.name??null,applicationAccess:'anonymous-public-advertised-native-application-entry',applicationSubmitted:false,
  nativePostingStatus:null,sourcePostingStatusEvidence:'current-public-listing+role+advertised-application-entry',
  sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,scrapedAt:now}
}
function application(html,job){
 const doc=document(html),head=activeHead(html),forms=doc.nodes(n=>n.tag==='form'&&n.attrs.id==='application-form'),urls=head.metas.filter(m=>m.property==='og:url')
 requireNative(head.titles.length===1&&head.titles[0]===('New Application | '+job.title+' | Eptura Careers').replace(/\s+/g,' ').trim()&&urls.length===1&&urls[0].content===job.applyUrl,'Native application identity mismatch')
 requireNative(forms.length===1&&forms[0].attrs.method==='post'&&new URL(forms[0].attrs.action,job.applyUrl).href===job.sourceUrl+'/applications','Native application entry unavailable/identity changed')
 const component=nativeComponent(doc.nodes(n=>n.tag==='script'&&n.attrs['data-component-name']==='External::Jobs::Applications::New'),'application executable client')
 requireNative(component.jobPostingUuid===job.nativePostingUUID&&component.locale===new URL(job.sourceUrl).pathname.split('/')[1],'Native application client UUID/locale identity mismatch')
 requireNative(!closed.test(extractActiveDescription(html)||''),'Native application is closed')
}
export async function runNativeEptura(options={}){
 requireNative(options.maxJobs==null,'Native truncation is forbidden')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),concurrency=options.detailConcurrency??1,timeoutMs=options.timeoutMs??180000,maxRecords=options.maxNativeRecords??200
 requireNative(Number.isFinite(Date.parse(now))&&Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=3&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isInteger(maxRecords)&&maxRecords>=1&&maxRecords<=200,'Invalid bounded native options')
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs),fetchImpl=options.fetchImpl??globalThis.fetch
 async function get(url){
  signal.throwIfAborted()
  const response=await fetchImpl(url,{method:'GET',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html,application/json;q=0.9,*/*;q=0.8'}})
  if(response.status!==200){const error=Error('Eptura native HTTP unavailable: '+response.status);error.httpStatus=response.status;error.failureKind=response.status===403?'upstream_blocked':'upstream_http_failure';throw error}
  canonical(response.url,url);const body=await response.text();document(body);signal.throwIfAborted();return body
 }
 const official=document(await get(CAREERS)),delegations=official.nodes(n=>n.tag==='a'&&n.attrs.href===BOARD&&/Open positions/i.test(official.text(n)))
 requireNative(delegations.length>=1,'Current official Pinpoint delegation unavailable')
 const config=board(await get(BOARD)),native=rows(await get(LISTING),now,maxRecords),selected=native.filter(r=>indiaCity(r.location.city))
 requireNative(selected.length>0,'No qualified native India roles; company zero is unknown')
 const jobs=[]
 for(let i=0;i<selected.length;i+=concurrency)jobs.push(...await Promise.all(selected.slice(i,i+concurrency).map(async row=>{const job=role(await get(row.url),row,now);application(await get(job.applyUrl),job);return job})))
 const final=rows(await get(LISTING),now,maxRecords),finalConfig=board(await get(BOARD))
 requireNative(JSON.stringify(native)===JSON.stringify(final)&&JSON.stringify(config)===JSON.stringify(finalConfig),'Native listing/client changed during extraction')
 for(const job of jobs){job.sourceObservedNativeBoardRecords=native.length;job.sourceObservedNativeIndiaRecords=selected.length;job.nativeTenantTarget=config.target;job.sourceOfficialBinding={officialURL:CAREERS,boardURL:BOARD,listingURL:LISTING,checkedAt:now};job.sourceNativeListingTerminalEvidence={showPagination:false,pageSize:null,excludedLocations:[],excludedDepartments:[],envelope:'data-only',stableRecheck:true}}
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LISTING,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-advertised-native-feed-enumerated-and-rechecked-whole-company-scope-unproven'})
}
export const run=runNativeEptura
