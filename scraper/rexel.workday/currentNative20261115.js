import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const SOURCE='rexel',HOME='https://www.rexel.com/',CAREERS=HOME+'fr/carrieres',BOARD='https://careers.rexel.com/',INDIA=BOARD+'india'
const sha=value=>createHash('sha256').update(value).digest('hex')
const normalized=value=>String(value??'').replace(/\s+/g,' ').trim()
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const problem=(message,kind='coverage_gap')=>Object.assign(Error('Rexel current native: '+message),{softFailure:true,abortRetries:true,failureKind:kind,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw problem(message)}
const one=(items,label)=>{need(items.length===1,'missing or ambiguous '+label);return items[0]}
const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const walk=(node,path=[])=>[{node,path:[...path,node]},...node.children.filter(child=>typeof child!=='string').flatMap(child=>walk(child,[...path,node]))]
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|position|role|vacancy|opening)\s+(?:(?:is|was|has(?:\s+been)?)\s+)?(?:(?:already|now|currently)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|expired|unavailable|not\s+(?:(?:currently|now)\s+)?available|no\s+longer\s+(?:available|open|active))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:are|is|were|have\s+been|has\s+been)\s+)?(?:now\s+)?(?:closed|ended|stopped|suspended))\b/i
const fields=new Set(['@context','@type','url','title','description','datePosted','validThrough','employmentType','hiringOrganization','industry','jobBenefits','identifier','jobLocation'])
const context=value=>typeof value==='string'&&/^https?:\/\/schema\.org\/?$/.test(value)
const typed=(value,type,inherited)=>{
 need(value&&typeof value==='object'&&!Array.isArray(value)&&value['@type']===type,'native '+type+' missing')
 const current=Object.hasOwn(value,'@context')?value['@context']:inherited
 need(context(current),'native '+type+' context changed');return current
}
function nativeTimestamp(value,now,future=false){
 const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|\+00:00)$/)
 need(match,'native timestamp shape invalid or unreviewed')
 const fraction=(match[7]??'').padEnd(3,'0'),time=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]),Number(match[6]),Number(fraction))
 const expected=match[1]+'-'+match[2]+'-'+match[3]+'T'+match[4]+':'+match[5]+':'+match[6]+'.'+fraction+'Z'
 need(Number.isFinite(time)&&new Date(time).toISOString()===expected&&Date.parse(value)===time,'native invalid calendar date')
 need(future?time>now:time<=now,'native date expired or future');return time
}
function document(html){
 const raw=readNativeDocument(html),root=one(raw.nodes(node=>node.tag==='root'),'document root')
 need(walk(root).every(({node})=>node.tag!=='base'),'unreviewed document base')
 const head=one(raw.nodes(node=>node.tag==='head'),'document head')
 const title=one(head.children.filter(node=>typeof node!=='string'&&node.tag==='title'),'publisher title').raw
 return{raw,root,title:normalized(title),html}
}
function anchor(doc,target,base){return doc.nodes(node=>node.tag==='a'&&node.attrs.href).filter(node=>{try{return new URL(node.attrs.href,base).href===target}catch{return false}})}
function nativeRows(page){
 const rows=[],unique=new Map()
 // The server-authored country/brand fields are native metadata. CSS initially
 // hides parts of each card; each lead must independently match a full current
 // role's visible title, full workplace, native UUID, criteria and Apply link.
 for(const card of page.raw.nodes(node=>node.tag==='div'&&cls(node,'attrax-vacancy-tile')&&node.attrs['data-jobid'])){
  const nativeID=card.attrs['data-jobid'];need(/^\d+$/.test(nativeID),'native card ID changed')
  const link=one(within(card,node=>node.tag==='a'&&cls(node,'attrax-vacancy-tile__title')),'native card title')
  const title=page.raw.text(link),url=new URL(link.attrs.href,INDIA).href
  need(/^https:\/\/careers\.rexel\.com\/job\/[^?#]+-jid-\d+$/.test(url)&&url.endsWith('-jid-'+nativeID),'native card URL/ID changed')
  const value=className=>page.raw.text(one(within(card,node=>cls(node,className)),'native card '+className))
  const country=value('attrax-vacancy-tile__option-location-valueset'),brand=value('attrax-vacancy-tile__option-brands-valueset')
  const locationNode=one(within(card,node=>cls(node,'attrax-vacancy-tile__location-freetext')),'native full workplace')
  const location=page.raw.text(one(within(locationNode,node=>cls(node,'attrax-vacancy-tile__item-value')),'native workplace label'))
  const reference=value('attrax-vacancy-tile__reference-value')
  need(country==='India'&&brand==='Rexel'&&/(?:^|,)\s*India$/.test(location),'explicit own native India country or employer missing')
  const row={nativeID,title,url,country,brand,location,reference}
  need(title&&/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(reference),'native role identity or title unavailable')
  need(!unique.has(nativeID)||canonical(unique.get(nativeID))===canonical(row),'conflicting duplicate native role cards')
  unique.set(nativeID,row);rows.push(row)
 }
 need(unique.size>0&&unique.size<=15&&rows.length<=60,'no bounded qualified own India cards; not a verified zero')
 return{rows,unique:[...unique.values()],rawCards:page.raw.nodes(node=>node.tag==='div'&&cls(node,'attrax-vacancy-tile')&&node.attrs['data-jobid'])}
}
function roleModel(page,row,now){
 const declaration=one(page.raw.nodes(node=>node.tag==='script'&&!Object.hasOwn(node.attrs,'src')&&node.attrs.type==='application/ld+json'),'own full JobPosting')
 let posting;try{posting=parseEightfoldJson(declaration.raw)}catch(error){throw problem('native JSON invalid or ambiguous: '+error.message)}
 const ctx=typed(posting,'JobPosting',null)
 need(Object.keys(posting).every(key=>fields.has(key)),'unreviewed native criterion or status field')
 typed(posting.hiringOrganization,'Organization',ctx);typed(posting.identifier,'PropertyValue',ctx)
 need(posting.hiringOrganization.name==='Rexel'&&posting.hiringOrganization.url===BOARD+'en'&&posting.hiringOrganization.sameAs===BOARD+'en','own native employer changed')
 need(posting.identifier.name==='Rexel'&&posting.identifier.value===row.reference,'native reference conflict')
 need(normalized(posting.title)===row.title&&posting.url===BOARD+'en'+new URL(row.url).pathname,'native role title or URL conflict')
 need([posting.employmentType,posting.industry].every(values=>Array.isArray(values)&&values.length>0&&values.length<=8&&values.every(value=>typeof value==='string'&&value.length>0&&value.length<=500)),'native employment or department labels changed')
 const canonicalURL=one(page.raw.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'native canonical URL').attrs.href
 need(canonicalURL===row.url,'own canonical account or ID changed')
 need(Array.isArray(posting.jobLocation)&&posting.jobLocation.length===1,'additional native workplace scope unresolved')
 const place=posting.jobLocation[0],placeContext=typed(place,'Place',ctx),address=place.address;typed(address,'PostalAddress',placeContext)
 need(Object.keys(place).every(key=>['@context','@type','address'].includes(key))
  &&Object.keys(address).every(key=>['@context','@type','addressLocality','addressCountry'].includes(key)),'additional native place or address carrier requires review')
 need(address.addressLocality===row.location&&(address.addressCountry==null||['India','IN'].includes(address.addressCountry)),'native location or explicit country conflict')
 need(page.visible.text(one(page.visible.nodes(node=>node.tag==='h1'),'visible own title'))===row.title,'visible own title changed')
 const location=one(page.visible.nodes(node=>cls(node,'locationtext')&&node.tag==='div'&&cls(node,'attrax-job-information-widget__freetext-fields')),'visible full role location')
 need(page.visible.text(one(within(location,node=>cls(node,'attrax-job-information-widget__freetext-field-value')),'visible role workplace'))===row.location,'visible native workplace conflict')
 const brand=one(page.visible.nodes(node=>node.tag==='li'&&cls(node,'Brands-wrapper')),'visible own role brand')
 need(page.visible.text(brand)==='Rexel','visible native employer conflict')
 const original=one(page.raw.nodes(node=>node.attrs['aria-label']==='Job description'),'full original native criteria')
 const visible=one(page.visible.nodes(node=>node.attrs['aria-label']==='Job description'),'full visible native criteria')
 const criterionPath=one(walk(page.root).filter(({node})=>node===original),'native criterion ancestor context').path
 const path=criterionPath.slice(0,-1).map(node=>({tag:node.tag,attrs:node.attrs}))
 const widgetTypes=[...new Set(page.raw.nodes(node=>node.attrs['data-type']).map(node=>node.attrs['data-type']))]
 // The reviewed contexts describe server layout/CSS, not a frozen vacancy
 // roster. Current native IDs still bind independently to their own cards,
 // UUIDs, employer, workplace, criteria, canonical URI and application URL.
 need(Object.values(profile.roles).some(current=>canonical(path)===canonical(current.criterionAncestors)
  &&canonical(widgetTypes)===canonical(current.widgetTypes)),'native criterion ancestor attributes changed or unreviewed native criteria widget')
 need(walk(original).every(({node})=>!node.inert&&!Object.hasOwn(node,'raw')&&['div','br','p','strong','ul','li','u','ol'].includes(node.tag)
  &&(node===original||Object.keys(node.attrs).length===0||node.tag==='div'&&Object.keys(node.attrs).length===1&&/^jobad-(?:companydescription|jobdescription|qualifications)$/.test(node.attrs.class))),'native authored criterion hidden or changed')
 const description=page.visible.text(visible)
 need(description.length>=500&&description===page.raw.text(original)&&description===extractActiveDescription(posting.description),'complete original schema and visible native criteria mismatch')
 const column=criterionPath.at(-3)
 need(column?.tag==='div'&&typeof column.attrs.id==='string'&&cls(column,'container-col'),'native complete criteria column changed')
 const visibleColumn=one(page.visible.nodes(node=>node.attrs.id===column.attrs.id),'visible complete native criteria column')
 need(page.raw.text(column)===description&&page.visible.text(visibleColumn)===description,'additional authored criteria outside the core native description require review')
 let benefits=null
 if(posting.jobBenefits!=null&&posting.jobBenefits!==''){
  need(typeof posting.jobBenefits==='string'&&posting.jobBenefits.length<=10000&&!/[<>]/.test(posting.jobBenefits),'unreviewed native benefits structure')
  benefits=normalized(posting.jobBenefits);need(benefits.length>0,'native benefits are incomplete')
 }
 need(!unavailable.test(page.visible.text(one(page.visible.nodes(node=>node.tag==='root'),'visible role root'))),'native role explicitly filled, closed or unavailable')
 const applications=page.raw.nodes(node=>node.tag==='a'&&cls(node,'jobApplyBtn'))
 const visibleApplications=page.visible.nodes(node=>node.tag==='a'&&cls(node,'jobApplyBtn'))
 const applyURL=BOARD+'Workflow?workflowId=9983905f-34f8-4094-bcd5-3970ed858c8e&vacancyId='+row.nativeID
 need(applications.length>0&&applications.length<=2&&visibleApplications.length>0
  &&applications.every(apply=>page.raw.text(apply)==='Apply Now'&&new URL(apply.attrs.href,row.url).href===applyURL&&!Object.hasOwn(apply.attrs,'disabled')&&apply.attrs['aria-disabled']!=='true'),'own native application account or ID changed')
 nativeTimestamp(posting.datePosted,now)
 if(posting.validThrough!=null)nativeTimestamp(posting.validThrough,now,true)
 return{row,posting,description,benefits,originalCriteria:original,applyURL,canonicalURL}
}

export async function runCurrentRexel(options={}){
 need(!(options.fetchText||options.fetchJson)||options.fetchImpl,'current native HTTP metadata required')
 const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(clock)
 need(Number.isFinite(now),'invalid observation clock')
 const duration=options.sourceDeadlineMs??90000;need(Number.isSafeInteger(duration)&&duration>0&&duration<=90000,'invalid source deadline')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded','network_or_timeout')),duration)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const allowed=new Set([HOME]),receipts=[],passes=[],lastRead=new Map(),fetchImpl=options.fetchImpl||globalThis.fetch;let totalBytes=0
 const read=async(url,mime)=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<60,'native public URL or read count bound')
  const origin=new URL(url).origin,wait=options.fetchImpl?0:Math.max(0,500-(performance.now()-(lastRead.get(origin)??-Infinity)))
  if(wait)await delay(wait,undefined,{signal});lastRead.set(origin,performance.now())
  const nativeFetch=async(value,init)=>{
   const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit'})
   try{
    signal.throwIfAborted();init.signal.throwIfAborted()
    need(response&&response.url===value&&response.redirected===false&&typeof response.headers?.get==='function','original HTTP identity or redirect metadata changed')
    if(response.status!==200)throw Object.assign(problem('native HTTP '+response.status,[401,403,429,451].includes(response.status)?'blocked_or_access_denied':'upstream_unavailable'),{status:response.status,httpStatus:response.status})
    need(mime.test(response.headers.get('content-type')??''),'native response MIME changed')
   }catch(error){try{Promise.resolve(response?.body?.cancel(error)).catch(()=>{})}catch{/* Preserve the observed HTTP status or opaque caller reason. */}throw error}
   const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();let bytes=0;return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native response chunk type');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-totalBytes,'native stream byte bound');bytes+=part.value.byteLength;totalBytes+=part.value.byteLength}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
   return{status:response.status,url:response.url,headers:response.headers,body}
  }
  const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,timeoutMs:20000,overflowError:problem('native stream byte bound')})
  const bytes=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  receipts.push({requestedURL:url,...packet,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
  if(packet.status!==200)throw problem('native HTTP '+packet.status,[401,403,429,451].includes(packet.status)?'blocked_or_access_denied':'upstream_unavailable')
  need(packet.url===url&&mime.test(packet.headers['content-type']||''),'native final URL or MIME changed');return html
 }
 const pass=async()=>{
  const home=document(await read(HOME,/^text\/html\b/i));need(home.title==='Rexel'&&anchor(home.raw,CAREERS,HOME).length>0,'current corporate publisher or careers lead changed')
  allowed.add(CAREERS);const corporate=document(await read(CAREERS,/^text\/html\b/i));need(corporate.title==='Rexel'&&anchor(corporate.raw,BOARD,CAREERS).length>0,'current corporate native board lead changed')
  const sheets=new Map()
  const page=async url=>{
   const html=await read(url,/^text\/html\b/i),parsed=document(html)
   const styleDeclarations=parsed.raw.nodes(node=>node.tag==='link'&&node.attrs.rel==='stylesheet').map(node=>node.attrs)
   need(canonical(styleDeclarations)===canonical(profile.nativeStyles),'native stylesheet declarations changed')
   const kind=url.includes('/job/')?'role':new URL(url).pathname
   const inlineStyles=walk(parsed.root).filter(({node})=>node.tag==='style').map(({node})=>({attrs:node.attrs,sha256:sha(node.raw)}))
   need(canonical(inlineStyles)===canonical(profile.inlineStyles[kind]),'native inline stylesheet inventory changed')
   for(const declaration of styleDeclarations){const target=new URL(declaration.href,url).href;need(Object.hasOwn(profile.styles,target),'native stylesheet URL unreviewed');allowed.add(target);if(!sheets.has(target)){const css=await read(target,/^text\/css\b/i);need(sha(css)===profile.styles[target],'whole current native stylesheet changed');sheets.set(target,css)}}
   return{...parsed,visible:readVisibleNativeDocument(html.replace('</head>','<style>'+[...sheets.values()].join('\n')+'</style></head>'),{strict:true})}
  }
  allowed.add(BOARD);const board=await page(BOARD)
  need(board.title==='Rexel Careers | Rexel'&&anchor(board.raw,INDIA,BOARD).length>0
   &&board.visible.text(one(board.visible.nodes(node=>node.tag==='h1'),'native visible publisher'))==='Rexel Careers','current own native publisher or published India navigation lead changed')
  allowed.add(INDIA);const india=await page(INDIA)
  need(india.title==='Are you looking for a dynamic career? Invest your energy for zestful growth- Join REXEL | Rexel','current dedicated native India publisher changed')
  const cards=nativeRows(india),models=[],current={binding:{corporatePublisher:home.title,careersPublisher:corporate.title,nativePublisher:board.title,indiaPublisher:india.title},cards,models};passes.push(current)
  for(const row of cards.unique){allowed.add(row.url);models.push(roleModel(await page(row.url),row,now))}
  return current
 }
 try{
  const opening=await pass(),closing=await pass()
  need(canonical(opening)===canonical(closing),'closing own publisher, native card inventory, full role model or criteria changed')
  signal.throwIfAborted()
  const jobs=opening.models.map(model=>({source:SOURCE,company:'Rexel',companyDomain:'rexel.com',companyCareerPage:HOME,title:model.row.title,
   jobId:model.row.reference,requisitionId:model.row.reference,sourceNativeAttraxID:model.row.nativeID,sourceUrl:model.row.url,link:model.row.url,applyUrl:model.applyURL,
   country:'India',location:model.row.location,city:model.row.location.split(',')[0],jobDescription:model.description+(model.benefits?'\n\nNative benefits: '+model.benefits:''),sourceDescription:model.description+(model.benefits?'\n\nNative benefits: '+model.benefits:''),
   sourceNativeJobPosting:model.posting,sourceNativeFullCriteria:model.originalCriteria,sourceNativeCountryEvidence:{method:'matching-own-native-country-option-and-full-explicit-role-workplace',countryOption:model.row.country,listingWorkplace:model.row.location,detailWorkplace:model.posting.jobLocation[0].address.addressLocality},
   postingDate:model.posting.datePosted,sourcePostedDateRaw:model.posting.datePosted,sourceSchemaExpiryRaw:model.posting.validThrough??null,closingDate:null,
   employmentType:model.posting.employmentType.join(', '),department:model.posting.industry.join(', '),sourceDetailComplete:true,sourceNativeClosingReconciled:true,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceRenderedApplicationQualified:false,sourceApplicationSubmitted:false,scrapedAt:new Date().toISOString()}))
  const audit={source:SOURCE,passes,originalResponses:receipts,openingClosingMatched:true,recordKind:'vacancy-rows',observedRecordCount:opening.cards.unique.length,observedVacancyCount:opening.cards.unique.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,corporateRenderedUIQualified:false,sourceRenderedApplicationQualified:false}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  options.onAudit?.(structuredClone(audit))
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDIA,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:new Date().toISOString(),reason:'current own native country-option and full role criteria positive, closing reconciled; whole company inventory and rendered application unqualified'})
 }catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error)){try{error.sourceAudit={source:SOURCE,passes,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}}catch{}}
  throw error
 }finally{clearTimeout(timer)}
}
