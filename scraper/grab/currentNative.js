import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {DOMParser} from '@xmldom/xmldom'
import {decodeHTML} from 'entities'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {qualifyGrabAuthoredCriteria} from './currentAuthoredCriteria.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {canonicalNativeRecord as canonical} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,nativeLines,clean,authoredNativeLines,comparable} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readJobPosting,countryName,geography} from '../../scraper-support/native-sources/jobPostingData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const BOARD_URL='https://www.grab.careers/jobs',CANONICAL_BOARD_URL='https://www.grab.careers/en/jobs/'
export const FEED_URL=CANONICAL_BOARD_URL+'xml/?rss=true'
const publisherURL='https://www.grab.com/sg/',origin='https://www.grab.careers'
const reviewed=JSON.parse(readFileSync(new URL('./deployment20261114.json',import.meta.url)))
const failure=(message,fields={})=>firstPartyFailure('grab',message,fields)
const need=(ok,message)=>{if(!ok)throw failure(message,{nativeAuthorityFailure:true})}
const match=(ok,message)=>{if(!ok)throw failure(message,{nativeRecordMismatch:true})}
const sha=value=>createHash('sha256').update(value).digest('hex')
const explicitlyUnavailable=value=>{
 const text=clean(decodeHTML(String(value??'')).normalize('NFKC').replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,''))
 return /\b(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening)\s+(?:(?:is|was|has(?:\s+now)?(?:\s+been)?)\s+)?(?:now\s+)?(?:closed|filled|expired|no\s+longer\s+(?:open|available))\b/i.test(text)
  ||/\bno\s+longer\s+(?:accepting|taking|receiving)\s+(?:any\s+)?applications\b/i.test(text)
  ||/\bapplications(?:\s+for\s+(?:this|the)\s+(?:job|role|position|vacancy|opening))?\s+(?:are|have\s+been)\s+(?:now\s+)?closed\b/i.test(text)
}
const requireAvailable=(...texts)=>{if(texts.some(explicitlyUnavailable))throw failure('Native role explicitly closed, filled, expired or no longer accepting applications',{nativeRecordMismatch:true,nativeVacancyUnavailable:true})}
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const classes=node=>(node.attrs.class||'').split(/\s+/)
const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
function ancestorsOf(node,target,parents=[]){
 if(node===target)return parents
 for(const child of node.children.filter(value=>typeof value!=='string')){const found=ancestorsOf(child,target,[...parents,node]);if(found)return found}
 return null
}
const roleURL=(url,id)=>new RegExp('^https://www\\.grab\\.careers/en/jobs/'+id+'/[a-z0-9-]+/$').test(url)
// UTF-8 decoding can consume a BOM. Registered reads must pair their complete
// original entity-byte hash with the exact reviewed decoded program/style.
export function readGrabProgram(url,body,entitySHA256=sha(body)){need(entitySHA256===sha(body)&&Object.hasOwn(reviewed.programs,url)&&[reviewed.programs[url],...(reviewed.programByteVariants?.[url]||[])].includes(entitySHA256),'Immutable native program bytes require review')}
export function readGrabStyle(url,body,entitySHA256=sha(body)){need(entitySHA256===sha(body)&&Object.hasOwn(reviewed.styles,url)&&entitySHA256===reviewed.styles[url],'Immutable native stylesheet bytes require review')}
export function readGrabBoard(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Grab your dream role | Grab Careers',canonical:CANONICAL_BOARD_URL})
 need(owned.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical').length===1,'Missing native board canonical')
 const programURLs=[],styleURLs=[],visible=readVisibleNativeDocument(html,{strict:true})
 need(visible.nodes(n=>n.tag==='h1'&&clean(nativeText(n))==='Grab your dream role').length===1,'Corporate board heading is missing or hidden')
 const rss=one(owned.nodes.filter(n=>n.tag==='link'&&n.attrs.type==='application/rss+xml'),'publisher feed declaration')
 need(!rss.inert&&rss.attrs.href===FEED_URL&&rss.attrs.rel==='alternate','Corporate publisher feed handoff changed')
 const text=clean(nativeText(one(visible.nodes(n=>n.tag==='body'),'visible board body'))),range=text.match(/Displaying (\d+) to (\d+) of (\d+) matching jobs/)
 need(range,'Native board total is unavailable')
 const [first,last,total]=range.slice(1).map(Number)
 need(Number.isSafeInteger(total)&&total<=10000&&first===(total?1:0)&&last===Math.min(20,total),'Native first-page range is inconsistent')
 const cards=visible.nodes(n=>n.tag==='div'&&classes(n).includes('card-job')).map(n=>{
  const links=all(n).filter(c=>c.tag==='a'&&classes(c).includes('js-view-job')),link=one(links,'native visible role link'),id=n.attrs['data-id'],url=new URL(link.attrs.href,origin).href
  need(/^\d{12,20}$/.test(id)&&roleURL(url,id)&&clean(nativeText(link)),'Invalid native visible role identity')
  return{id,title:clean(nativeText(link)),url}
 })
 need(cards.length===last&&new Set(cards.map(c=>c.id)).size===cards.length,'Native first page is missing or duplicates records')
 return{total,cards,programURLs,styleURLs}
}
const feedFields=['title','date','requisitionid','referencenumber','apijobid','url','company','city','state','country','postalcode','description','jobtype','category','sourcename','remotetype','lastactivitydate']
export function readGrabFeed(xml){
 need(typeof xml==='string'&&!/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml),'Delegated XML entities or programs require review')
 const errors=[],doc=new DOMParser({errorHandler:{warning:m=>errors.push(m),error:m=>errors.push(m),fatalError:m=>errors.push(m)}}).parseFromString(xml,'text/xml')
 need(!errors.length&&doc.documentElement?.tagName==='source'&&doc.documentElement.attributes.length===0,'Malformed native publisher XML')
 const whitespace=n=>n.nodeType===3&&!n.data.trim()
 need(Array.from(doc.childNodes).every((n,index)=>n===doc.documentElement||whitespace(n)||n.nodeType===7&&n.target==='xml'&&index===0),'Unreviewed native XML document authority')
 const elements=node=>{const nodes=Array.from(node.childNodes);need(nodes.every(n=>n.nodeType===1||whitespace(n)),'Unreviewed authority or text in native XML envelope');return nodes.filter(n=>n.nodeType===1)}
 const children=elements(doc.documentElement)
 need(children.length>=3&&children.slice(0,3).map(n=>n.tagName).join(',')==='publisher,publisherUrl,lastBuildDate'&&children.slice(3).every(n=>n.tagName==='job')&&children.length<=10003,'Native feed envelope changed')
 const text=node=>{need(node.attributes.length===0&&Array.from(node.childNodes).every(n=>[3,4].includes(n.nodeType)),'Nested or ambiguous XML data field');return node.textContent}
 need(text(children[0])==='Grab'&&text(children[1])===publisherURL&&Number.isFinite(Date.parse(text(children[2]))),'Native feed publisher identity/date changed')
 const ids=new Set(),urls=new Set(),records=children.slice(3).map(node=>{
  need(node.attributes.length===0,'Unreviewed native record attributes')
  const fields=elements(node)
  need(fields.map(n=>n.tagName).join(',')===feedFields.join(','),'Original native record schema changed')
  const row=Object.fromEntries(fields.map(n=>[n.tagName,text(n)]))
  need(/^\d{12,20}$/.test(row.apijobid)&&roleURL(row.url,row.apijobid)&&!ids.has(row.apijobid)&&!urls.has(row.url),'Duplicate or invalid native record identity')
  // eslint-disable-next-line no-control-regex -- Reject native XML control characters without changing publisher data.
  need(row.company==='Grab'&&row.sourcename==='Grab'&&row.requisitionid===row.referencenumber&&/^REF[A-Za-z0-9]+$/.test(row.requisitionid)&&clean(row.title)&&!/[<>\u0000-\u001f]/.test(row.title+row.city+row.country),'Native employer/requisition identity changed')
  need(Number.isFinite(Date.parse(row.date))&&Number.isFinite(Date.parse(row.lastactivitydate))&&Buffer.byteLength(row.description)<=256*1024,'Native date or original description is invalid')
  ids.add(row.apijobid);urls.add(row.url);return row
 })
 return{records,lastBuildDate:children[2].textContent}
}
const escapeAttr=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
function serialize(node){
 if(typeof node==='string')return node
 const attrs=Object.entries(node.attrs).map(([k,v])=>' '+k+'="'+escapeAttr(v)+'"').join('')
 return'<'+node.tag+attrs+'>'+(node.raw??node.children.map(serialize).join(''))+'</'+node.tag+'>'
}
const staticCriteriaTags=new Set(['p','strong','ul','li'])
function qualifyStaticCriteria(root){
 // Preserve every original authored criterion using the actual static
 // feed/JSONLD markup, without relying on unrelated browser asset hashes.
 need(root&&all(root).slice(1).every(node=>staticCriteriaTags.has(node.tag)&&Object.keys(node.attrs).length===0&&!node.inert&&!node.nativeTagUnqualified&&node.raw===undefined),'Native criteria markup/activation vocabulary requires review')
}
function readStaticGrabCriteria(html){
 const criteria=readOriginalNativeCriteria(html,failure)
 qualifyStaticCriteria(readNativeDocument(html).nodes(node=>node.tag==='root')[0])
 return criteria
}
function qualifyCriteriaPanel(box){
 // The two native wrappers are structural owners of authored criteria.
 const wrapper=(node,attrs)=>{
  const elements=node.children.filter(child=>typeof child!=='string')
  need(elements.length===1&&node.children.every(child=>typeof child!=='string'||!clean(decodeHTML(child))),'Native criteria wrapper ownership requires review')
  const child=elements[0]
  need(child.tag==='div'&&canonical(child.attrs)===canonical(attrs)&&!child.inert&&!child.nativeTagUnqualified&&child.raw===undefined,'Native criteria wrapper activation requires review')
  return child
 }
 qualifyStaticCriteria(wrapper(wrapper(box,{}),{class:'inner'}))
}
export function readGrabDetail(html,row){
 const preliminary=readNativeDocument(html),title=one(preliminary.nodes(n=>n.tag==='title'),'native role title')
 match(decodeHTML(title.raw).trim()===`${row.title}, ${row.city}, ${row.country} | Grab Careers`,'Native role page title changed')
 const owned=readOwnedCurrentDocument(html,{failure,title:title.raw.trim(),canonical:row.url}),programURLs=[],styleURLs=[]
 need(owned.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical').length===1,'Missing native role canonical')
 const posting=readJobPosting(html)
 need(!posting.errors.length&&posting.candidates.length===1&&posting.candidate.raw===one(owned.nodes.filter(n=>n.attrs.id==='js-job-posting'),'owned native posting').raw,'Ambiguous original native posting data')
 const model=posting.candidate.model,keys=['@context','@type','title','description','identifier','mainEntityOfPage','url','datePosted','employmentType','hiringOrganization','industry','jobLocation']
 need(canonical(Object.keys(model).sort())===canonical(keys.sort()),'Native role criteria schema requires review')
 need(model['@context']==='https://schema.org'&&model['@type']==='JobPosting','Native posting data authority changed')
 need(canonical(model.hiringOrganization)===canonical({'@type':'Organization',name:'Grab',url:publisherURL,logo:origin+'/images/logo.svg'}),'Native employer data profile requires review')
 match(model.title===row.title&&model.identifier===row.requisitionid&&model.url===row.url&&model.mainEntityOfPage===row.url&&model.hiringOrganization?.name==='Grab'&&model.hiringOrganization.url===publisherURL,'Native role/employer identity does not match publisher record')
 const location=model.jobLocation,address=location?.address,hasKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical(keys.sort())
 need(hasKeys(location,['@type','name','address'])&&hasKeys(address,['@type','name','addressCountry','addressLocality','streetAddress'])&&location['@type']==='Place'&&address['@type']==='PostalAddress'&&typeof address.streetAddress==='string','Native worksite data profile requires review')
 const place=geography(model)
 match(place.country==='India'&&!place.unresolved&&place.countries.length===1&&place.city===row.city&&location.name===row.city&&address.name===row.city&&countryName(row.country)==='India','Native role country/worksite does not match publisher record')
 match(row.jobtype==='Full-time'&&model.employmentType==='FULL_TIME'&&model.industry===row.category,'Native employment type/department does not match publisher record')
 match(model.datePosted===new Date(row.date).toISOString().slice(0,10),'Native publication date does not match publisher record')
 const criteria=readStaticGrabCriteria(row.description),pageCriteria=readStaticGrabCriteria(model.description)
 requireAvailable(criteria.sourceDescriptionLines.join('\n'),pageCriteria.sourceDescriptionLines.join('\n'))
 match(criteria.sourceDetailComplete&&pageCriteria.sourceDetailComplete&&comparable(criteria.sourceDescription)===comparable(pageCriteria.sourceDescription),'Full native feed/page criteria differ or are incomplete')
 const container=one(owned.nodes.filter(n=>n.attrs.id==='js-job-detail'),'native role detail container')
 const ancestors=ancestorsOf(owned.root,container)
 need(ancestors?.every(node=>!node.inert&&!node.nativeTagUnqualified&&node.raw===undefined),'Native criteria ancestor activation requires review')
 match(container.attrs['data-id']===row.apijobid&&container.attrs['data-jobtitle']===row.title,'Native visible role identity changed')
 const visible=readVisibleNativeDocument(html,{strict:true})
 match(visible.nodes(n=>n.tag==='h1'&&clean(nativeText(n))===row.title).length===1,'Native role heading is missing or hidden')
 requireAvailable(nativeText(one(visible.nodes(n=>n.tag==='body'),'visible native role body')))
 const apply=one(owned.nodes.filter(n=>n.tag==='a'&&n.attrs.id==='js-apply-external'),'original native application handoff'),u=new URL(apply.attrs.href)
 match(!apply.inert&&u.protocol==='https:'&&u.hostname==='jobs.smartrecruiters.com'&&!u.username&&!u.password&&!u.port&&!u.hash&&new RegExp('^/Grab/'+row.apijobid+'-[a-z0-9-]+$').test(u.pathname)&&u.search==='?oga=true','Native application employer/role binding changed')
 const boxes=owned.nodes.filter(n=>classes(n).includes('cms-content'))
 need(boxes.length===4&&boxes.every(n=>all(container).includes(n)),'Native full criteria ownership changed')
 for(const box of boxes)qualifyCriteriaPanel(box)
 const visibleBoxes=visible.nodes(n=>classes(n).includes('cms-content'))
 const visibleLines=visibleBoxes.flatMap(nativeLines).map(comparable).sort()
 need(visibleBoxes.length===4&&canonical(visibleLines)===canonical(criteria.sourceDescriptionLines.map(comparable).sort()),'Original native criteria are hidden or incomplete in the visible document')
 for(const box of boxes)readOriginalNativeCriteria(box.children.map(serialize).join(''),failure,{minimumChars:1})
 const lines=boxes.flatMap(authoredNativeLines).map(comparable).sort(),expected=criteria.sourceDescriptionLines.map(comparable).sort()
 match(canonical(lines)===canonical(expected),'Original DOM criteria are missing or contain additional conditions')
 qualifyGrabAuthoredCriteria(owned,container,visible,html,match,requireAvailable)
 return{programURLs,styleURLs,job:{title:row.title,company:'Grab',country:'India',city:row.city,state:row.state||null,location:[row.city,row.state,'India'].filter(Boolean).join(', '),
  source:'grab',jobId:row.apijobid,sourceNativeJobId:row.apijobid,requisitionId:row.requisitionid,department:row.category,employmentType:row.jobtype,
  sourceUrl:row.url,applyUrl:row.url,link:row.url,sourceNativeApplicationURL:apply.attrs.href,applicationVisited:false,activationVerified:false,activeApplyVerified:false,
  postingDate:new Date(row.date).toISOString(),sourcePostingDate:new Date(row.date).toISOString(),sourceDateEvidence:'grab-native-publisher-date-and-detail-datePosted',closingDate:null,
  sourceNativePostedDate:row.date,sourceNativeLastActivityDate:row.lastactivitydate,companyCareerPage:BOARD_URL,companyDomain:'grab.careers',atsPlatform:'official-company-careers',
  sourceNativeJobRecord:structuredClone(row),sourceNativeJobPosting:structuredClone(model),sourceEmployerEvidence:{publisher:'Grab',publisherURL,corporateBoard:CANONICAL_BOARD_URL},
  sourceExactBrandRoleScopeVerified:false,sourceEmployerScope:'corporate-published-Grab-feed-and-Grab-native-role',...criteria,lifecycleCleanupAllowed:false}}
}
function createReader(options){
 options.signal?.throwIfAborted()
 if(options.fetchText||options.fetchJson)throw failure('Original HTTP metadata is required; body-only callbacks cannot certify this source')
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw RangeError('Invalid Grab source/request deadline')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,start=performance.now(),receipts=[],admitted=new Map([[BOARD_URL,'html'],[FEED_URL,'xml']])
 const timer=setTimeout(()=>controller.abort(new DOMException('Grab source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 let nextStart=0,bytes=0
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-start>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(new DOMException('Grab source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 return{check,allow(url,kind){need(kind==='javascript'&&Object.hasOwn(reviewed.programs,url)||kind==='css'&&Object.hasOwn(reviewed.styles,url)||kind==='html'&&/^https:\/\/www\.grab\.careers\/en\/jobs\/\d{12,20}\/[a-z0-9-]+\/$/.test(url),'Unbound learned public URL');admitted.set(url,kind)},
  async read(url){
   check();need(admitted.has(url)&&receipts.length<96,'Unbound or excessive native read')
   if(nextStart>performance.now())try{await delay(nextStart-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();nextStart=performance.now()+500
   const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
   let observedHTTPError,deniedDisposal
   try{
    const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:failure('Native response byte budget exceeded'),fetchImpl:async(requested,init)=>{
     let response,page
     if(options.fetchImpl)response=await options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
     else if(options.fetchPage){page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store'});need(page&&page.headers&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string','Incomplete original native HTTP metadata');response={status:page.status,url:page.finalUrl??page.url,headers:new Headers(page.headers),body:null}}
     else response=await fetch(requested,{...init,credentials:'omit',cache:'no-store'})
     try{options.signal?.throwIfAborted()}catch(error){await disposeResponseBody(response,{reason:error,bestEffort:true});options.signal?.throwIfAborted();throw error}
     Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:Object.fromEntries(response.headers),bodyComplete:false})
     try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:'grab current native read',signal:init.signal,callerSignal:options.signal??null})}catch(error){observedHTTPError=error;deniedDisposal=disposeResponseBody(response,{bestEffort:true});await deniedDisposal;options.signal?.throwIfAborted();throw error}
     if(page){need(page.bodyUnavailable!==true&&typeof page.body==='string','Missing original native response body');response=new Response(page.body,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.finalUrl??page.url})}
     return response
    }})
    check();const body=Buffer.from(response.bodyBase64,'base64');bytes+=body.length
    Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:Object.fromEntries(Object.entries(response.headers).filter(([k])=>['content-type','etag','last-modified','location'].includes(k))),bytes:body.length,sha256:sha(body),bodyComplete:true})
    need(bytes<=32*1024*1024,'Native aggregate response byte budget exceeded')
    if(response.status!==200||response.url!==url)throw failure('Original native HTTP/final URL changed',{status:response.status,failureKind:response.status>=500?'network_or_timeout':[401,403,429,451].includes(response.status)?'blocked_or_access_denied':'surface_drift_or_fail_closed'})
    const mime={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,xml:/^(?:text\/xml|application\/(?:xml|rss\+xml))(?:;|$)/i,javascript:/^(?:text|application)\/javascript(?:;|$)/i,css:/^text\/css(?:;|$)/i}[admitted.get(url)]
    need(mime.test(response.headers['content-type']||''),'Original native response MIME changed')
    return{body:new TextDecoder('utf8',{fatal:true}).decode(body),sha256:receipt.sha256}
   }catch(error){if(deniedDisposal)await deniedDisposal;options.signal?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;check();throw error}
   finally{receipt.completedAt=new Date().toISOString()}
  },stats:()=>({requests:receipts.length,decodedBytes:bytes,receipts:structuredClone(receipts),sourceTimeoutMs,requestTimeoutMs,nativeRequestIntervalMs:500,
   byteQualification:'16MiB hard streaming per-response ceiling;32MiB aggregate checked after each bounded entity.'}),close(){clearTimeout(timer);controller.abort()}}
}
export async function runCurrentGrab(options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??1000
 if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000)throw RangeError('Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))();if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw TypeError('Invalid native observation clock')
 const reader=createReader(options),holds=[];let board
 try{
  board=readGrabBoard((await reader.read(BOARD_URL)).body)
  const openingResponse=await reader.read(FEED_URL),opening=readGrabFeed(openingResponse.body)
  need(board.total===opening.records.length&&board.cards.every((row,index)=>row.id===opening.records[index]?.apijobid&&row.title===opening.records[index]?.title),'Native board/feed count or opening order does not reconcile')
  const facts=[]
  for(const row of opening.records){
   reader.check();const country=countryName(row.country)
   if(country!=='India'){if(!country)holds.push({nativeId:row.apijobid,reason:'native-country-unqualified'});continue}
   const criteria=readStaticGrabCriteria(row.description)
   if(explicitlyUnavailable(criteria.sourceDescriptionLines.join('\n'))){holds.push({nativeId:row.apijobid,reason:'native-role-explicitly-unavailable'});continue}
   if(!criteria.sourceDetailComplete){holds.push({nativeId:row.apijobid,reason:criteria.sourceDetailFailureKind});continue}
   reader.allow(row.url,'html')
   const response=await reader.read(row.url)
   try{const detail=readGrabDetail(response.body,row);facts.push({row,job:{...detail.job,sourceDetailResponseSHA256:response.sha256}})}
   catch(error){reader.check();if(!error.nativeRecordMismatch)throw error;holds.push({nativeId:row.apijobid,reason:error.nativeVacancyUnavailable?'native-role-explicitly-unavailable':'native-detail-identity-country-date-or-criteria-mismatch',message:error.message})}
  }
  const closingResponse=await reader.read(FEED_URL),closing=readGrabFeed(closingResponse.body),closingBoard=readGrabBoard((await reader.read(BOARD_URL)).body)
  need(closingBoard.total===closing.records.length&&closingBoard.cards.every((row,index)=>row.id===closing.records[index]?.apijobid&&row.title===closing.records[index]?.title),'Closing native board/feed counts do not reconcile')
  const byId=new Map(closing.records.map(row=>[row.apijobid,row])),stable=facts.filter(({row})=>{if(canonical(byId.get(row.apijobid))===canonical(row))return true;holds.push({nativeId:row.apijobid,reason:'native-record-missing-or-changed-at-closing'});return false})
  const reconciled=[]
  for(const fact of stable){reader.check();const response=await reader.read(fact.row.url);try{const latest=readGrabDetail(response.body,fact.row).job;match(canonical(latest.sourceNativeJobPosting)===canonical(fact.job.sourceNativeJobPosting)&&latest.sourceNativeApplicationURL===fact.job.sourceNativeApplicationURL,'Native full role or application changed at closing');reconciled.push(fact)}catch(error){reader.check();if(!error.nativeRecordMismatch)throw error;holds.push({nativeId:fact.row.apijobid,reason:'native-detail-changed-at-closing',message:error.message})}}
  const jobs=reconciled.slice(0,maxJobs).map(({job})=>({...job,scrapedAt:observedAt,sourceClosingReconciled:true,sourceScopeComplete:false}))
  const fingerprints=rows=>rows.map(row=>({nativeId:row.apijobid,title:row.title,country:row.country,url:row.url,originalRecordSHA256:sha(canonical(row))}))
  const audit={source:'grab',recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
   observedIndiaCount:opening.records.filter(row=>countryName(row.country)==='India').length,observedForeignCount:opening.records.filter(row=>countryName(row.country)&&countryName(row.country)!=='India').length,unknownCountryCount:opening.records.filter(row=>!countryName(row.country)).length,
   openingClosingRecordsMatch:canonical(opening.records)===canonical(closing.records),nativeOpeningRecords:fingerprints(opening.records),nativeClosingRecords:fingerprints(closing.records),originalOpeningRecords:opening.records,originalClosingRecords:closing.records,
   openingFeedSHA256:openingResponse.sha256,closingFeedSHA256:closingResponse.sha256,nativeBoardObservedTotal:board.total,returnedCount:jobs.length,outputLimited:reconciled.length>maxJobs,holds,
   closingReconciled:true,activationVerified:false,lifecycleCleanupAllowed:false,observationTime:observedAt,reader:reader.stats()}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:audit.reader.requests,verifiedAt:observedAt,
   reason:'native-publisher-feed-full-country-role-and-closing-reconciliation;whole-company-and-active-application-interaction-unqualified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded');reader.check();return jobs
 }catch(error){options.signal?.throwIfAborted();if(error&&typeof error==='object')Object.defineProperty(error,'nativeCollectionEvidence',{value:{source:'grab',sourceScopeComplete:false,lifecycleCleanupAllowed:false,observedBoard:board??null,reader:reader.stats()},configurable:true});options.signal?.throwIfAborted();throw error}finally{reader.close();options.signal?.throwIfAborted()}
}
