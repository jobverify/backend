import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeAttributeTokens,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {eightfoldDocument,parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const OFFICIAL='https://www.hsbc.com/careers/find-a-job'
const ORIGIN='https://portal.careers.hsbc.com'
const SELECTED=ORIGIN+'/careers?domain=hsbc.com&location=India&department=Technology'
const RENDERER='522171badd24f647d7e4be09475e6b53a10493a156c742c6e617643f46ac27d8'
const sha=value=>createHash('sha256').update(value).digest('hex')
const text=value=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():''
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('[hsbctechnologyindia] '+message),{abortRetries:true,softFailure:true,failureKind:'surface_drift_or_fail_closed'})}
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash?u:null}catch{return null}}
const active=entry=>!entry.node.nativeTagUnqualified&&!entry.ancestors.some(n=>n.inert||['svg','math','template','object','noscript'].includes(n.tag))

// The hidden code is a data carrier consumed by the verified client. It is
// never treated as visible recruitment text. Check its exact own start tag;
// unrelated JavaScript strings containing '<' are not HTML attributes.
function modelOf(page){
 const parsed=eightfoldDocument(page.html)
 need(!parsed.entries.some(({node})=>node.tag==='base'),'native base URL requires review')
 const carriers=parsed.entries.filter(({node})=>node.attrs.id==='smartApplyData')
 need(carriers.length===1,'native carrier identity missing or duplicated')
 const entry=carriers[0],node=entry.node
 need(node.tag==='code'&&active(entry)&&entry.ancestors.some(n=>n.tag==='body')
  &&node.children.length===1&&typeof node.children[0]==='string'
  &&Object.keys(node.attrs).every(k=>['id','style','data-nosnippet'].includes(k))
  &&/^\s*display\s*:\s*none\s*;?\s*$/i.test(node.attrs.style||''),'native carrier context changed')
 const ownTags=[...parsed.normalized.matchAll(/<code\b((?:[^"'>]|"[^"]*"|'[^']*')*)>/gi)].map(m=>readNativeAttributeTokens(m[1]))
  .filter(attrs=>attrs.some(([k,v])=>k==='id'&&decodeHTML(v)==='smartApplyData'))
 need(ownTags.length===1&&new Set(ownTags[0].map(([k])=>k)).size===ownTags[0].length,'native carrier attributes ambiguous')
 const mounts=parsed.entries.filter(({node:n})=>n.attrs.id==='EFSmartApplyContainer')
 need(mounts.length===1&&active(mounts[0])&&!mounts[0].node.inert,'native public mount missing')
 const visible=readVisibleNativeDocument(parsed.normalized,{strict:true})
 need(visible.nodes(n=>n.attrs.id==='EFSmartApplyContainer').length===1,'native mount stylesheet visibility changed')
 const model=parseEightfoldJson(decodeHTML(node.children[0]))
 need(model.domain==='hsbc.com'&&model.branding?.companyName==='HSBC'&&model.excludePrivatePositions===true
  &&model.isUserAuthenticated===false&&model.isUserETXCandidate===false&&model.isDomainETX===false
  &&model.isPcsEnabled===true&&model.candidate?.enc_id===0&&model.candidate.email===''
  &&object(model.loggedInCandidate)&&Object.keys(model.loggedInCandidate).length===0,'native public account/employer changed')
 need(Number.isSafeInteger(model.count)&&model.count>=0&&model.count<=100000&&Array.isArray(model.positions)
  &&model.positions.length<=100&&model.positions.length<=model.count&&model.query?.query==='','native positions/query changed')
 const scripts=parsed.document.nodes(n=>n.tag==='script'&&typeof n.attrs.src==='string'&&/smartApply\./.test(n.attrs.src))
 need(scripts.length===1,'native classic client missing or ambiguous')
 need(!Object.hasOwn(scripts[0].attrs,'nomodule')&&/^(?:|(?:text|application)\/javascript)$/i.test(scripts[0].attrs.type||''),'native renderer execution mode changed')
 const renderer=https(new URL(scripts[0].attrs.src,ORIGIN).href)
 need(renderer?.origin===ORIGIN&&/^\/gen\/js\/smartApply\.[a-f\d]+\.js$/.test(renderer.pathname)&&!renderer.search,'native classic client authority changed')
 return {model,parsed,rendererURL:renderer.href}
}
function handoffOf(page){
 const parsed=eightfoldDocument(page.html)
 need(!parsed.entries.some(({node})=>node.tag==='base'),'corporate handoff base requires review')
 let visibleHTML=parsed.normalized
 const anti=parsed.entries.filter(({node})=>node.attrs.id==='antiClickjack')
 if(anti.length){
  const style=anti[0],programs=parsed.entries.filter(({node})=>node.tag==='script'&&/var allowedURIs/.test(node.raw||'')),program=programs[0]
  need(anti.length===1&&style.node.tag==='style'&&active(style)&&stable(style.node.attrs)==='{"id":"antiClickjack"}'
   &&sha(style.node.raw)==='b721c3ecde3653ec2ea19815cb16328fbb9d8fa1d50265c77923a874dede0f6a'
   &&programs.length===1&&active(program)&&stable(program.node.attrs)==='{"type":"text/javascript"}'
   &&parsed.entries.indexOf(program)>parsed.entries.indexOf(style)
   &&sha(program.node.raw)==='3959faddee9fd76da06ea0f6ac00b6763549e7ae0eef7fe8aac52b82fb5fad0e'
   &&visibleHTML.split(style.node.raw).length===2,'corporate handoff antiClickjack contract changed')
  // The exact current classic program removes only this own style when the
  // corporate page is opened at top level. No other hiding rule is removed.
  visibleHTML=visibleHTML.replace(style.node.raw,'')
 }
 const document=readVisibleNativeDocument(visibleHTML,{strict:true})
 need(document.nodes(n=>n.tag==='title').some(n=>/HSBC Holdings plc/.test(n.raw)),'corporate publisher identity changed')
 const links=document.nodes(n=>n.tag==='a'&&/Search jobs/.test(document.text(n))).flatMap(n=>{
  const url=https(n.attrs.href);return url?.origin===ORIGIN&&url.pathname==='/careers'?[url]:[]
 })
 need(links.length===1&&links[0].searchParams.getAll('domain').join()==='hsbc.com'
  &&links[0].searchParams.getAll('location').join()==='any'
  &&/^\d+$/.test(links[0].searchParams.get('pid')||''),'current corporate public portal handoff changed')
 return links[0].href
}
const rowURL=row=>{
 need(object(row)&&Number.isSafeInteger(row.id)&&row.id>0&&text(row.name)&&row.posting_name===row.name
  &&row.type==='ATS'&&row.isPrivate===false&&text(row.ats_job_id)&&row.display_job_id===row.ats_job_id
  &&Number.isSafeInteger(row.t_create)&&row.t_create>0&&Number.isSafeInteger(row.t_update)&&row.t_update>=row.t_create,'native role identity changed')
 const url=https(row.canonicalPositionUrl)
 need(url?.origin===ORIGIN&&url.pathname==='/careers/job/'+row.id&&!url.search,'native role URL changed')
 return url.href
}
const indiaRow=row=>typeof row.location==='string'&&Array.isArray(row.locations)&&row.locations.length>0
 &&row.locations.length<=40&&row.locations.includes(row.location)&&row.locations.every(l=>typeof l==='string'&&/, India$/.test(l))
function selectedOf(page,renderer){
 const current=modelOf(page),m=current.model
 need(current.rendererURL===renderer&&m.query.location==='India'&&m.query.pid===''
  &&stable(m.query.department)==='["Technology"]','selected public technology/India query changed')
 const ids=new Set()
 for(const row of m.positions){rowURL(row);need(!ids.has(row.id),'duplicate native selected role');ids.add(row.id)}
 return current
}
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December']
const nativeDate=value=>{
 const parts=/^(\d{2}) ([A-Za-z]+) (\d{4})$/.exec(value||'')
 need(parts&&monthNames.includes(parts[2]),'native application date model changed')
 const date=parts[3]+'-'+String(monthNames.indexOf(parts[2])+1).padStart(2,'0')+'-'+parts[1]
 need(new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'native application date is invalid')
 return date
}
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
function customCriteria(job,now){
 const custom=job.custom_JD,fields=custom?.data_fields,display=custom?.display
 need(custom?.enable===true&&object(fields)&&Array.isArray(display)&&display.length>0&&display.length<=25
  &&Object.keys(custom).every(k=>['enable','data_fields','display'].includes(k)),'native custom criteria contract changed')
 const names=new Set()
 for(const item of display){need(object(item)&&Object.keys(item).length===2&&text(item.label)&&text(item.value)
  &&Object.hasOwn(fields,item.value)&&!names.has(item.value),'native displayed criteria ambiguous');names.add(item.value)}
 need(Object.entries(fields).every(([key,values])=>Array.isArray(values)&&values.every(v=>typeof v==='string')
  &&(values.length===0||names.has(key))),'undisplayed additional native criteria requires review')
 need(stable(fields.jobid)===stable([job.ats_job_id])&&stable(fields.department)==='["Technology"]'
  &&stable(fields.brand)==='["HSBC"]'&&fields.postingStartDate?.length===1&&fields.postingEndDate?.length===1,'native custom role/department/date identity changed')
 const posting=nativeDate(fields.postingStartDate[0]),closing=nativeDate(fields.postingEndDate[0])
 need(posting<=now.slice(0,10)&&closing>now.slice(0,10)&&posting<=closing,'native application window expired or unresolved')
 const html='<dl>'+display.map(({label,value})=>'<dt>'+escape(label)+'</dt><dd>'+fields[value].map(escape).join('; ')+'</dd>').join('')+'</dl>'
 return {html,posting,closing,fields,display}
}
// Preserve every authored non-layout character. The native schema represents
// actual HTML list boundaries with Markdown bullets and escapes punctuation.
function criteriaAgree(html,schema){
 const {entries}=eightfoldDocument(html),boundaries=new Set(),spaces=new Set(),originalSpaces=new Set(),blocks=new Set();let authored=''
 const walk=n=>{if(n.inert||n.tag==='script')return
  if(n.tag==='li')boundaries.add(authored.length)
  const block=['p','div','br','ul','ol','li','span'].includes(n.tag)&&n.tag!=='span'
  if(block){spaces.add(authored.length);blocks.add(authored.length)}
  for(const c of n.children){if(typeof c!=='string')walk(c);else for(const char of decodeHTML(c))if(/\s/u.test(char)){spaces.add(authored.length);originalSpaces.add(authored.length)}else authored+=char}
  if(block){spaces.add(authored.length);blocks.add(authored.length)}
 };walk(entries[0].node)
 let a=0,b=0,spaceAt=-1
 while(a<authored.length||b<schema.length){
  if(/\s/u.test(schema[b]||'')){if(a!==0&&a!==authored.length&&!spaces.has(a))return false;spaceAt=a;b++;continue}
  if(a<authored.length&&authored[a]===schema[b]){if(originalSpaces.has(a)&&!blocks.has(a)&&/[\p{L}\p{N}]/u.test(authored[a-1]||'')&&/[\p{L}\p{N}]/u.test(authored[a])&&spaceAt!==a)return false;a++;b++;continue}
  if(boundaries.has(a)&&schema[b]==='*'){b++;continue}
  if(a<authored.length&&schema[b]==='\\'&&schema[b+1]===authored[a]&&'+-.*_#|[]()'.includes(authored[a])){b++;continue}
  return false
 }return authored.length>=200
}
function roleOf(page,job,insights,row,renderer,now){
 need(rowURL(job)===rowURL(row)&&['name','posting_name','location','locations','department','business_unit','t_create','t_update','ats_job_id','display_job_id','id_locale','isPrivate']
  .every(k=>stable(job[k])===stable(row[k])),'native full role/listing identity changed')
 need(indiaRow(job)&&job.department==='Technology'&&job.business_unit==='GCIO','native technology/India role scope changed')
 const current=modelOf(page),m=current.model
 need(current.rendererURL===renderer&&m.query.pid===String(row.id)&&m.positions.length===1
  &&stable(m.positions[0])===stable(row),'native own public role/listing identity changed')
 need(Array.isArray(m.all_applicable_locations)&&m.all_applicable_locations.length===job.locations.length
  &&m.all_applicable_locations.every(l=>l.country==='IN'&&job.locations.includes(l.location))
  &&stable(m.all_applicable_locations.map(l=>l.location).sort())===stable([...job.locations].sort()),'native own role typed country changed')
 const postings=current.parsed.document.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>parseEightfoldJson(n.raw))
 const posting=postings.length===1?postings[0]:null
 need(posting?.['@type']==='JobPosting'&&posting.title===job.name&&posting.hiringOrganization?.name==='HSBC'
  &&posting.hiringOrganization.sameAs==='hsbc.com','native own schema employer/title changed')
 const schemaURL=https(posting.url)
 const schemaPath=schemaURL?decodeURIComponent(schemaURL.pathname):''
 need(schemaURL?.origin===ORIGIN&&schemaURL.searchParams.size===1&&schemaURL.searchParams.get('domain')==='hsbc.com'
  &&new RegExp('^/careers/job/'+row.id+'(?:-[a-z0-9\\u00a0-]+)?$').test(schemaPath),'native own schema role URL changed')
 const schemaLocations=Array.isArray(posting.jobLocation)?posting.jobLocation:[posting.jobLocation]
 need(schemaLocations.length===job.locations.length&&schemaLocations.every(l=>l?.['@type']==='Place'
  &&l.address?.['@type']==='PostalAddress'&&l.address.addressCountry?.['@type']==='Country'
  &&l.address.addressCountry.name==='IN'),'native schema country changed')
 need(stable(schemaLocations.map(l=>[text(l.address.addressLocality).normalize('NFKC'),text(l.address.addressRegion).normalize('NFKC')]).sort())
  ===stable(m.all_applicable_locations.map(l=>[text(l.city).normalize('NFKC'),text(l.state).normalize('NFKC')]).sort()),'native schema worksite changed')
 need(typeof job.job_description==='string'&&(extractActiveDescription(job.job_description)?.length||0)>=200
  &&typeof posting.description==='string'&&criteriaAgree(job.job_description,posting.description),'native/schema full authored criteria disagree')
 need(/Issued by\s*[–-]\s*HSBC Software Development India\s*$/u.test(extractActiveDescription(job.job_description)), 'native legal technology employer changed')
 const allowedInsights=['skills','companies','schools','degrees','experience_years','seniority','titles','num_veterans']
 need(object(insights)&&Object.keys(insights).length===allowedInsights.length&&insights.num_veterans===0
  &&allowedInsights.filter(k=>k!=='num_veterans').every(k=>object(insights[k])&&Object.keys(insights[k]).length===0),'additional native insights require review')
 need(object(job.preApplyInfoBanner)&&Object.keys(job.preApplyInfoBanner).length===0,'additional native pre-application criteria require review')
 const application=https(job.apply_redirect_url)
 need(application?.origin==='https://career2.successfactors.eu'&&application.pathname==='/careers'
  &&application.searchParams.getAll('company').join()==='hsbcholdin'
  &&application.searchParams.getAll('career_job_req_id').join()===row.ats_job_id
  &&application.searchParams.getAll('career_ns').join()==='job_application','native application account/role changed')
 return {posting,custom:customCriteria(job,now),job,insights,originalPublicPage:page}
}

export default async function run(options={}){
 const now=options.now||new Date().toISOString();need(Number.isFinite(Date.parse(now)),'invalid observation time')
 const signal=AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(240000)])
 const receipts=[];let requests=0
 const read=async url=>{
  signal.throwIfAborted();need(++requests<=60,'native request budget reached')
  const response=await (options.fetchImpl||globalThis.fetch)(url,{redirect:'manual',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html,application/json,*/*','User-Agent':'Mozilla/5.0'}})
  const html=await response.text();signal.throwIfAborted()
  need(response.status===200&&response.url===url&&Buffer.byteLength(html)<=4*1024*1024,'current native GET identity/status changed')
  const page={url,status:response.status,html};receipts.push({...page,sha256:sha(html)});return page
 }
 const official=await read(OFFICIAL),handoff=handoffOf(official),board=await read(handoff),opening=modelOf(board)
 need(sha((await read(opening.rendererURL)).html)===RENDERER,'native renderer criteria contract changed')
 const selectedPage=await read(SELECTED),selected=selectedOf(selectedPage,opening.rendererURL)
 const observations=[],staged=[],held=[]
 for(const row of selected.model.positions){
  const record={originalListingRecord:structuredClone(row)};observations.push(record)
  if(!indiaRow(row)||row.department!=='Technology'||row.business_unit!=='GCIO'){held.push({id:row.id,reason:'explicit technology/country scope unresolved'});continue}
  const roleURL=rowURL(row),jobURL=ORIGIN+'/api/apply/v2/jobs/'+row.id+'?domain=hsbc.com',insightURL=ORIGIN+'/api/apply/v2/jobs/'+row.id+'/insights?domain=hsbc.com'
  const page=await read(roleURL),job=parseEightfoldJson((await read(jobURL)).html),insights=parseEightfoldJson((await read(insightURL)).html)
  Object.assign(record,{originalNativeRole:job,originalNativeInsights:insights,originalPublicPage:page})
  try{const detail=roleOf(page,job,insights,row,opening.rendererURL,now);staged.push({row,detail,roleURL,jobURL,insightURL})}
  catch(error){if(!error.softFailure)throw error;held.push({id:row.id,reason:error.message})}
 }
 for(const item of staged){
  const page=await read(item.roleURL),job=parseEightfoldJson((await read(item.jobURL)).html),insights=parseEightfoldJson((await read(item.insightURL)).html)
  const closing=roleOf(page,job,insights,item.row,opening.rendererURL,now)
  need(stable({job,insights,posting:closing.posting})===stable({job:item.detail.job,insights:item.detail.insights,posting:item.detail.posting}),'closing native role criteria changed')
 }
 const closingSelected=selectedOf(await read(SELECTED),opening.rendererURL)
 need(stable(closingSelected.model.positions)===stable(selected.model.positions)&&closingSelected.model.count===selected.model.count,'closing selected native membership changed')
 need(sha((await read(opening.rendererURL)).html)===RENDERER&&handoffOf(await read(OFFICIAL))===handoff,'closing native client/corporate handoff changed')
 need(staged.length>0,'coverage-gap: no currently verified native India technology roles')
 const jobs=staged.map(({row,detail})=>({source:'hsbctechnologyindia',company:'HSBC Technology India',title:row.name,jobId:String(row.id),requisitionId:row.ats_job_id,
  sourceUrl:row.canonicalPositionUrl,applyUrl:detail.job.apply_redirect_url,link:row.canonicalPositionUrl,country:'India',location:row.location,city:row.location.split(',')[0],department:row.department,
  employmentType:detail.custom.fields.jobType?.join('; ')||null,postingDate:detail.custom.posting,closingDate:detail.custom.closing,
  remoteStatus:stable(detail.custom.fields.workStyle)==='["Hybrid Worker"]'?'Hybrid':null,
  jobDescription:detail.job.job_description+detail.custom.html,sourceDescription:detail.job.job_description+detail.custom.html,
  sourceNativeRecord:detail.job,sourceNativeInsights:detail.insights,sourceNativeJobPosting:detail.posting,
  sourceNativeEmployerBinding:{officialURL:OFFICIAL,declaredURL:handoff,nativeDomain:'hsbc.com',legalEmployer:'HSBC Software Development India'},
  nativeSchemaExpirySemantics:'generated SEO expiry; real Apply By retained from native custom_JD',
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now,
  companyCareerPage:OFFICIAL,companyDomain:'hsbc.com',atsPlatform:'eightfold-classic'}))
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{nativeRecords:observations,heldRecords:held,receipts,reportedSelectedTotal:selected.model.count,selectedRowsObserved:selected.model.positions.length,
  selectorScope:'India + Technology observations; whole-company source scope unqualified',sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 attachSourceObservationEvidence(jobs,{source:'hsbctechnologyindia',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:SELECTED,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
  reason:'current corporate portal; own full role/typed country/legal employer/custom application criteria; incomplete company scope'})
}
export {run}
