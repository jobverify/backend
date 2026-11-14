import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {DOMParser} from '@xmldom/xmldom'
import {decodeHTML} from 'entities'
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
function programs(owned,kind){
 const scripts=owned.nodes.filter(n=>n.tag==='script')
 const fingerprint=sha(canonical(scripts.map(n=>({attrs:n.attrs,raw:n.attrs.id==='js-job-posting'?'REVIEWED_NATIVE_JOB_POSTING':n.raw||'',inert:!!n.inert}))))
 need(kind==='board'?fingerprint===reviewed.board.programSHA256:reviewed.detailPrograms.includes(fingerprint),'Current native program declarations require review')
 const events=owned.nodes.flatMap(n=>Object.entries(n.attrs).filter(([key])=>key.startsWith('on')).map(([attribute,value])=>({tag:n.tag,attribute,valueSHA256:sha(value),inert:!!n.inert})))
 need(canonical(events)===canonical(kind==='board'?reviewed.board.events:reviewed.detailEvents),'Current native event programs require review')
 need(!owned.nodes.some(n=>['iframe','frame','frameset','object','embed'].includes(n.tag)||Object.hasOwn(n.attrs,'srcdoc')||n.tag==='meta'&&(n.attrs['http-equiv']||'').toLowerCase()==='refresh'),'Delegated native document requires review')
 return scripts.filter(n=>n.attrs.src).map(n=>{const url=new URL(n.attrs.src,origin).href;need(Object.hasOwn(reviewed.programs,url),'Unreviewed native program URL');return url})
}
// UTF-8 decoding can consume a BOM. Registered reads must pair their complete
// original entity-byte hash with the exact reviewed decoded program/style.
export function readGrabProgram(url,body,entitySHA256=sha(body)){need(entitySHA256===sha(body)&&Object.hasOwn(reviewed.programs,url)&&[reviewed.programs[url],...(reviewed.programByteVariants?.[url]||[])].includes(entitySHA256),'Immutable native program bytes require review')}
const styleLink=node=>node.tag==='link'&&((node.attrs.rel||'').toLowerCase().split(/[\t\n\f\r ]+/).includes('stylesheet')||(node.attrs.as||'').toLowerCase()==='style'||(node.attrs.type||'').toLowerCase()==='text/css')
function readStyleDeclarations(owned){
 const declarations=owned.nodes.filter(n=>n.tag==='style'||styleLink(n)||Object.hasOwn(n.attrs,'style')).map(n=>({tag:n.tag,attrs:n.attrs,raw:n.raw??null,inert:!!n.inert}))
 need(reviewed.styleDeclarations.includes(sha(canonical(declarations))),'Current native stylesheet/style declaration inventory requires review')
 return owned.nodes.filter(styleLink).map(node=>{const url=new URL(node.attrs.href,origin).href;need(Object.hasOwn(reviewed.styles,url),'Unreviewed native stylesheet URL');return url})
}
export function readGrabStyle(url,body,entitySHA256=sha(body)){need(entitySHA256===sha(body)&&Object.hasOwn(reviewed.styles,url)&&entitySHA256===reviewed.styles[url],'Immutable native stylesheet bytes require review')}
export function readGrabBoard(html){
 const owned=readOwnedCurrentDocument(html,{failure,title:'Grab your dream role | Grab Careers',canonical:CANONICAL_BOARD_URL})
 need(owned.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical').length===1,'Missing native board canonical')
 const programURLs=programs(owned,'board'),styleURLs=readStyleDeclarations(owned),visible=readVisibleNativeDocument(html,{strict:true})
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
function shareURL(url,row){
 const u=new URL(url),params=Object.fromEntries(u.searchParams)
 need(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'Unreviewed native share URL')
 if(u.origin+u.pathname==='https://www.facebook.com/sharer/sharer.php')need(canonical(params)===canonical({u:row.url}),'Native share role identity changed')
 else if(u.origin+u.pathname==='https://twitter.com/intent/tweet')need(canonical(params)===canonical({url:row.url,text:row.title,via:'grabsg'}),'Native share role identity changed')
 else if(u.origin+u.pathname==='https://www.linkedin.com/sharing/share-offsite/')need(canonical(params)===canonical({url:row.url}),'Native share role identity changed')
 else need(false,'Unreviewed native share publisher')
 need([...u.searchParams].length===Object.keys(params).length,'Duplicate native share query');return true
}
const staticCriteriaTags=new Set(['p','strong','ul','li'])
function qualifyStaticCriteria(root){
 // The complete original feed/JSONLD criteria contain only these static tags
 // without attributes. Do not let a new class, ID or data attribute activate
 // the qualified stylesheet/client programs inside dynamic authored criteria.
 need(root&&all(root).slice(1).every(node=>staticCriteriaTags.has(node.tag)&&Object.keys(node.attrs).length===0&&!node.inert&&!node.nativeTagUnqualified&&node.raw===undefined),'Native criteria markup/activation vocabulary requires review')
}
function readStaticGrabCriteria(html){
 const criteria=readOriginalNativeCriteria(html,failure)
 qualifyStaticCriteria(readNativeDocument(html).nodes(node=>node.tag==='root')[0])
 return criteria
}
function qualifyCriteriaPanel(box){
 // Only the observed two wrappers are client-owned. Their location and the
 // panel's original tabs/read-more controls remain bound by detailShape.
 const wrapper=(node,attrs)=>{
  const elements=node.children.filter(child=>typeof child!=='string')
  need(elements.length===1&&node.children.every(child=>typeof child!=='string'||!clean(decodeHTML(child))),'Native criteria wrapper ownership requires review')
  const child=elements[0]
  need(child.tag==='div'&&canonical(child.attrs)===canonical(attrs)&&!child.inert&&!child.nativeTagUnqualified&&child.raw===undefined,'Native criteria wrapper activation requires review')
  return child
 }
 qualifyStaticCriteria(wrapper(wrapper(box,{}),{class:'inner'}))
}
function qualifyDecorativeRaster(node,ancestors){
 const parent=ancestors.at(-1),slot=ancestors.at(-2)
 need(parent?.tag==='a'&&parent.attrs.class==='js-video video-block'&&parent.attrs.href==='https://www.youtube.com/watch?v=4CClPtIb2V4'&&slot?.tag==='div'&&slot.attrs.class==='col-lg-4 job-video'&&!ancestors.some(n=>classes(n).includes('cms-content')),'Decorative raster slot was reassigned')
 const [source,img]=node.children,keys=(value,expected)=>canonical(Object.keys(value).sort())===canonical(expected.sort())
 need(!node.inert&&Object.keys(node.attrs).length===0&&node.children.length===2&&source?.tag==='source'&&img?.tag==='img'&&!source.inert&&!img.inert&&source.children.length===0&&img.children.length===0,'Unreviewed markup or criteria in decorative raster slot')
 need(keys(source.attrs,['srcset','type'])&&keys(img.attrs,['alt','class','fetchpriority','height','loading','src','width']),'Unreviewed decorative raster attributes')
 need(source.attrs.type==='image/webp'&&img.attrs.class==='img-fluid'&&img.attrs.width==='800'&&img.attrs.height==='1200'&&img.attrs.loading==='eager'&&img.attrs.fetchpriority==='high','Decorative raster element types changed')
 need(/^\/media\/[a-z0-9]{8}\/[a-z0-9_-]+\.jpg\?(?:rxy=(?:0(?:\.\d{1,20})?|1(?:\.0{1,20})?),(?:0(?:\.\d{1,20})?|1(?:\.0{1,20})?)&)?width=800&height=1200&rnd=\d{18}&rmode=crop&quality=85$/.test(img.attrs.src)&&source.attrs.srcset===img.attrs.src.replace('&quality=85','&format=webp&quality=85'),'Decorative raster publisher/type/responsive pair changed')
 need(clean(img.attrs.alt)&&Buffer.byteLength(img.attrs.alt)<=512&&!/[<>\u0000-\u001f]/.test(img.attrs.alt),'Unreviewed decorative raster caption type')
 requireAvailable(img.attrs.alt)
}
function detailShape(node,row,apply,ancestors=[]){
 const dynamic=value=>String(value).replaceAll(apply,'NATIVE_APPLY_URL').replaceAll(encodeURIComponent(row.url),'NATIVE_URL_ENCODED').replaceAll(encodeURIComponent(row.title),'NATIVE_TITLE_ENCODED').replaceAll(row.url,'NATIVE_URL').replaceAll(row.title,'NATIVE_TITLE').replaceAll(row.apijobid,'NATIVE_ID')
 if(typeof node==='string'){const text=decodeHTML(node).replace(/\s+/g,' ').trim();return text?dynamic(text):null}
 // Only the observed rotating JPEG cover is data. The complete normalized
 // surrounding layout still binds its fixed video owner outside criteria.
 if(node.tag==='picture'){qualifyDecorativeRaster(node,ancestors);return{tag:'picture',reviewedDecorativePicture:true}}
 const attrs=Object.fromEntries(Object.entries(node.attrs).map(([k,v])=>[k,dynamic(v)]))
 if(node.tag==='a'&&/^https:\/\/(?:www\.facebook\.com\/sharer\/|twitter\.com\/intent\/tweet|www\.linkedin\.com\/sharing\/)/.test(node.attrs.href||'')){shareURL(node.attrs.href,row);attrs.href='NATIVE_BOUND_SHARE_URL'}
 return{tag:node.tag,attrs,...(classes(node).includes('cms-content')?{nativeCriteria:true}:{children:node.children.map(n=>detailShape(n,row,apply,[...ancestors,node])).filter(Boolean)})}
}
export function readGrabDetail(html,row){
 const preliminary=readNativeDocument(html),title=one(preliminary.nodes(n=>n.tag==='title'),'native role title')
 match(decodeHTML(title.raw).trim()===`${row.title}, ${row.city}, ${row.country} | Grab Careers`,'Native role page title changed')
 const owned=readOwnedCurrentDocument(html,{failure,title:title.raw.trim(),canonical:row.url}),programURLs=programs(owned,'detail'),styleURLs=readStyleDeclarations(owned)
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
 need(ancestors?.every(node=>!node.inert&&!node.nativeTagUnqualified&&node.raw===undefined)&&canonical(ancestors.map(node=>({tag:node.tag,attrs:node.attrs,inert:!!node.inert})))===canonical(reviewed.detailAncestors),'Native criteria ancestor activation requires review')
 match(container.attrs['data-id']===row.apijobid&&container.attrs['data-jobtitle']===row.title,'Native visible role identity changed')
 const visible=readVisibleNativeDocument(html,{strict:true})
 match(visible.nodes(n=>n.tag==='h1'&&clean(nativeText(n))===row.title).length===1,'Native role heading is missing or hidden')
 requireAvailable(nativeText(one(visible.nodes(n=>n.tag==='body'),'visible native role body')))
 const apply=one(owned.nodes.filter(n=>n.tag==='a'&&n.attrs.id==='js-apply-external'),'original native application handoff'),u=new URL(apply.attrs.href)
 match(!apply.inert&&u.protocol==='https:'&&u.hostname==='jobs.smartrecruiters.com'&&!u.username&&!u.password&&!u.port&&!u.hash&&new RegExp('^/Grab/'+row.apijobid+'-[a-z0-9-]+$').test(u.pathname)&&u.search==='?oga=true','Native application employer/role binding changed')
 need(reviewed.detailLayouts.includes(sha(canonical(detailShape(container,row,apply.attrs.href)))),'Native criteria layout/activation requires review')
 const boxes=owned.nodes.filter(n=>classes(n).includes('cms-content'))
 need(boxes.length===4&&boxes.every(n=>all(container).includes(n)),'Native full criteria ownership changed')
 for(const box of boxes)qualifyCriteriaPanel(box)
 const visibleBoxes=visible.nodes(n=>classes(n).includes('cms-content'))
 const visibleLines=visibleBoxes.flatMap(nativeLines).map(comparable).sort()
 need(visibleBoxes.length===4&&canonical(visibleLines)===canonical(criteria.sourceDescriptionLines.map(comparable).sort()),'Original native criteria are hidden or incomplete in the visible document')
 for(const box of boxes)readOriginalNativeCriteria(box.children.map(serialize).join(''),failure,{minimumChars:1})
 const lines=boxes.flatMap(authoredNativeLines).map(comparable).sort(),expected=criteria.sourceDescriptionLines.map(comparable).sort()
 match(canonical(lines)===canonical(expected),'Original DOM criteria are missing or contain additional conditions')
 return{programURLs,styleURLs,job:{title:row.title,company:'Grab',country:'India',city:row.city,state:row.state||null,location:[row.city,row.state,'India'].filter(Boolean).join(', '),
  source:'grab',jobId:row.apijobid,sourceNativeJobId:row.apijobid,requisitionId:row.requisitionid,department:row.category,employmentType:row.jobtype,
  sourceUrl:row.url,applyUrl:row.url,link:row.url,sourceNativeApplicationURL:apply.attrs.href,applicationVisited:false,activationVerified:false,
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
   try{
    const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,overflowError:failure('Native response byte budget exceeded'),fetchImpl:async(requested,init)=>{
     if(options.fetchImpl)return options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
     if(options.fetchPage){const page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store'});need(page&&typeof page.body==='string'&&page.headers&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string','Incomplete original native HTTP metadata');const r=new Response(page.body,{status:page.status,headers:page.headers});Object.defineProperty(r,'url',{value:page.finalUrl??page.url});return r}
     return fetch(requested,{...init,credentials:'omit',cache:'no-store'})
    }})
    check();const body=Buffer.from(response.bodyBase64,'base64');bytes+=body.length
    Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:Object.fromEntries(Object.entries(response.headers).filter(([k])=>['content-type','etag','last-modified','location'].includes(k))),bytes:body.length,sha256:sha(body),bodyComplete:true})
    need(bytes<=32*1024*1024,'Native aggregate response byte budget exceeded')
    if(response.status!==200||response.url!==url)throw failure('Original native HTTP/final URL changed',{status:response.status,failureKind:response.status>=500?'network_or_timeout':[401,403,429,451].includes(response.status)?'blocked_or_access_denied':'surface_drift_or_fail_closed'})
    const mime={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,xml:/^(?:text\/xml|application\/(?:xml|rss\+xml))(?:;|$)/i,javascript:/^(?:text|application)\/javascript(?:;|$)/i,css:/^text\/css(?:;|$)/i}[admitted.get(url)]
    need(mime.test(response.headers['content-type']||''),'Original native response MIME changed')
    return{body:new TextDecoder('utf8',{fatal:true}).decode(body),sha256:receipt.sha256}
   }catch(error){options.signal?.throwIfAborted();check();throw error}
   finally{receipt.completedAt=new Date().toISOString()}
  },stats:()=>({requests:receipts.length,decodedBytes:bytes,receipts:structuredClone(receipts),sourceTimeoutMs,requestTimeoutMs,nativeRequestIntervalMs:500,
   byteQualification:'16MiB hard streaming per-response ceiling;32MiB aggregate checked after each bounded entity.'}),close(){clearTimeout(timer);controller.abort()}}
}
export async function runCurrentGrab(options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??1000
 if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000)throw RangeError('Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))();if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw TypeError('Invalid native observation clock')
 const reader=createReader(options),checked=new Set(),checkedStyles=new Set(),holds=[]
 const qualifyPrograms=async urls=>{for(const url of urls)if(!checked.has(url)){reader.allow(url,'javascript');const response=await reader.read(url);readGrabProgram(url,response.body,response.sha256);checked.add(url)}}
 const qualifyStyles=async urls=>{for(const url of urls)if(!checkedStyles.has(url)){reader.allow(url,'css');const response=await reader.read(url);readGrabStyle(url,response.body,response.sha256);checkedStyles.add(url)}}
 try{
  const board=readGrabBoard((await reader.read(BOARD_URL)).body);await qualifyPrograms(board.programURLs);await qualifyStyles(board.styleURLs)
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
   try{const detail=readGrabDetail(response.body,row);await qualifyPrograms(detail.programURLs);await qualifyStyles(detail.styleURLs);facts.push({row,job:{...detail.job,sourceDetailResponseSHA256:response.sha256}})}
   catch(error){reader.check();if(!error.nativeRecordMismatch)throw error;holds.push({nativeId:row.apijobid,reason:error.nativeVacancyUnavailable?'native-role-explicitly-unavailable':'native-detail-identity-country-date-or-criteria-mismatch',message:error.message})}
  }
  const closingResponse=await reader.read(FEED_URL),closing=readGrabFeed(closingResponse.body),closingBoard=readGrabBoard((await reader.read(BOARD_URL)).body)
  need(closingBoard.total===closing.records.length&&closingBoard.cards.every((row,index)=>row.id===closing.records[index]?.apijobid&&row.title===closing.records[index]?.title),'Closing native board/feed counts do not reconcile')
  const byId=new Map(closing.records.map(row=>[row.apijobid,row])),stable=facts.filter(({row})=>{if(canonical(byId.get(row.apijobid))===canonical(row))return true;holds.push({nativeId:row.apijobid,reason:'native-record-missing-or-changed-at-closing'});return false})
  const jobs=stable.slice(0,maxJobs).map(({job})=>({...job,scrapedAt:observedAt,sourceClosingReconciled:true,sourceScopeComplete:false}))
  const fingerprints=rows=>rows.map(row=>({nativeId:row.apijobid,title:row.title,country:row.country,url:row.url,originalRecordSHA256:sha(canonical(row))}))
  const audit={source:'grab',recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
   observedIndiaCount:opening.records.filter(row=>countryName(row.country)==='India').length,observedForeignCount:opening.records.filter(row=>countryName(row.country)&&countryName(row.country)!=='India').length,unknownCountryCount:opening.records.filter(row=>!countryName(row.country)).length,
   openingClosingRecordsMatch:canonical(opening.records)===canonical(closing.records),nativeOpeningRecords:fingerprints(opening.records),nativeClosingRecords:fingerprints(closing.records),
   openingFeedSHA256:openingResponse.sha256,closingFeedSHA256:closingResponse.sha256,nativeBoardObservedTotal:board.total,returnedCount:jobs.length,outputLimited:stable.length>maxJobs,holds,
   closingReconciled:true,activationVerified:false,lifecycleCleanupAllowed:false,observationTime:observedAt,reader:reader.stats()}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:audit.reader.requests,verifiedAt:observedAt,
   reason:'native-publisher-feed-full-country-role-and-closing-reconciliation;whole-company-and-rendered-application-activation-unqualified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded');reader.check();return jobs
 }finally{reader.close()}
}
