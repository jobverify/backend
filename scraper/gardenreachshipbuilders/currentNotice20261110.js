import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {extractTextFromPdfBuffer} from '../../scraper-support/shared/pdfText.js'

export const CAREERS='https://www.grse.in/career/index'
export const PORTALS=['https://jobapply.in/grse2026/','https://jobapply.in/grse2025/']
const SOURCE='gardenreachshipbuilders',EMPLOYER='GARDEN REACH SHIPBUILDERS & ENGINEERS LIMITED'
const clean=x=>decodeNativeEntities(String(x??'')).replace(/\s+/g,' ').trim(),id=x=>clean(x).replace(/\s+/g,'')
const sha=x=>createHash('sha256').update(x).digest('hex')
const held=message=>Object.assign(Error('Garden Reach native notice held: '+message),{code:'GRSE_NATIVE_NOTICE_UNQUALIFIED',abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
const need=(value,message)=>{if(!value)throw held(message)}
function active(html){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'missing/oversized HTML')
 const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],nodes=[]
 // Base authority is document-wide even inside hidden or quoted markup.
 // Traverse the raw tree independently of positive visible-proof filtering.
 // Template contents and scripting-enabled noscript are genuinely inert.
 const baseAuthority=n=>n.tag==='template'||n.tag==='noscript'?false:n.tag==='base'||n.children.some(c=>typeof c!=='string'&&baseAuthority(c))
 need(!baseAuthority(root),'unreviewed document base authority')
 const allowed=n=>!n.inert&&!['blockquote','q','pre','code','script','style','template','noscript','object','iframe'].includes(n.tag)
 const visit=n=>{if(!allowed(n))return;nodes.push(n);for(const c of n.children)if(typeof c!=='string')visit(c)};visit(root)
 const text=n=>allowed(n)?clean(n.tag==='title'?n.raw:n.children.map(c=>typeof c==='string'?c:text(c)).join(' ')):''
 return {root,nodes,text,allowed}
}
const url=(href,base)=>{try{const u=new URL(clean(href),base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search?u.href:null}catch{return null}}
const month={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11}
function date(value){const m=clean(value).match(/^(\d{1,2})(?:st|nd|rd|th)?[-\s]+([A-Za-z]+)[-\s]+(\d{4})(?:\b|$)/i);if(!m)return null;const d=+m[1],mo=month[m[2].toLowerCase()],y=+m[3];if(mo===undefined||y<2000||y>2100)return null;const v=new Date(Date.UTC(y,mo,d));return v.getUTCDate()===d&&v.getUTCMonth()===mo?v.toISOString():null}
function indexDocument(html,{portalYear}={}){
 const d=active(html)
 need(d.nodes.filter(n=>n.tag==='title'&&d.text(n)==='Welcome to Online Registration').length===1,'active portal title changed')
 need(d.nodes.some(n=>/^h[1-6]$/.test(n.tag)&&d.text(n)===`Welcome to Online Application in GRSE - ${portalYear}`),'active portal year publisher changed')
 return d
}
export function hasOfficialPortalIndexSignal(html,options){try{indexDocument(html,options);return true}catch{return false}}
export function extractPortalNotices(html,{portalIndexUrl}){
 need(PORTALS.includes(portalIndexUrl),'unreviewed configured index URL')
 const d=indexDocument(html,{portalYear:portalIndexUrl.match(/grse(\d{4})/i)?.[1]}),segments=[];let current=null
 // Preserve document order across the portal's malformed unclosed <a>/<li> tags.
 // Each literal native notice link starts its own segment; comments/inert text
 // never enter it and cannot donate a neighbouring title or closing date.
 const walk=n=>{if(!d.allowed(n))return
  if(n.tag==='a'&&n.attrs.href?.startsWith('javascript:')){
   const m=n.attrs.href.match(/^javascript:window\.location\.assign\((['"])(\/[A-Za-z0-9/._-]+)\1\);?$/)
   need(m,'unreviewed native navigation expression');current={path:m[2],text:''};segments.push(current)
  }
  for(const c of n.children){if(typeof c==='string'){if(current)current.text+=' '+c}else walk(c)}
 };walk(d.root)
 need(segments.length>0&&segments.length<=100,'native notice count unreviewed')
 return segments.map(s=>{
  const t=clean(s.text),m=t.match(/^\[Employment Notification No\.\s*:\s*([^\]]+)\]\s*:?\s*(.*?)\s+Last date to Apply:\s*([^]*?)$/i)
  need(m,'own notice title/date boundary changed')
  const notificationId=id(m[1]),title=clean(m[2]).replace(/^Apply\s+for\s+(?:Engagement\s+of\s+)?/i,''),closingDate=date(m[3]),detailUrl=url(s.path,portalIndexUrl)
  need(notificationId&&title&&closingDate&&detailUrl?.startsWith('https://jobapply.in/'),'own notice fields incomplete')
  return {title,notificationId,detailUrl,sourceUrl:portalIndexUrl,closingDate,recordKind:'native-recruitment-notice',nativeJobId:null,nativeRequisitionId:null}
 })
}
function detailDocument(html,{notificationId}={}){
 const d=active(html),text=d.text(d.root),ids=[...text.matchAll(/Employment Notification No\.\s*:\s*(\d{4}\/\d+\s*\([^)]*\))/gi)].map(m=>id(m[1]))
 need(d.nodes.filter(n=>n.tag==='title'&&d.text(n)==='Welcome to Online Registration').length===1,'active detail title changed')
 need(text.includes('Welcome to Online Application for GRSE Recruitment')&&ids.length===1&&ids[0]===id(notificationId),'own native notification identity changed')
 const links=d.nodes.filter(n=>n.tag==='a'),advertisements=links.filter(n=>/^(?:View Detailed Advertisement|View Advertisement - English version)$/i.test(d.text(n)))
 need(advertisements.length===1,'detailed advertisement delegation ambiguous/missing')
 need(links.some(n=>/^Registration\.aspx$/i.test(n.attrs.href??'')&&/^Fresh Candidate (?:\(CLICK HERE\) )?to Create Log In$/i.test(d.text(n))),'native registration declaration changed')
 need(links.some(n=>/^login\.aspx$/i.test(n.attrs.href??'')&&/^(?:Already Logged In Candidate\(CLICK HERE\) to Complete Process|To Complete Registration Process)$/i.test(d.text(n))),'native completion declaration changed')
 return {d,advertisement:advertisements[0]}
}
export function hasOfficialNoticeDetailSignal(html,options){try{detailDocument(html,options);return true}catch{return false}}
export function extractNoticePdfUrl(html,{detailUrl,notificationId}={}){
 try{
  const d=active(html),ids=[...d.text(d.root).matchAll(/Employment Notification No\.\s*:\s*(\d{4}\/\d+\s*\([^)]*\))/gi)]
  const {advertisement}=detailDocument(html,{notificationId:notificationId??ids[0]?.[1]}),result=url(advertisement.attrs.href,detailUrl),u=result&&new URL(result),base=new URL(detailUrl)
  return u&&u.origin==='https://jobapply.in'&&u.pathname.startsWith(base.pathname.slice(0,base.pathname.lastIndexOf('/')+1))&&/\.pdf$/i.test(u.pathname)?result:null
 }catch{return null}
}
export function corporateDelegates(html){
 const d=active(html)
 need(d.nodes.some(n=>/^h[1-6]$/.test(n.tag)&&d.text(n)===EMPLOYER),'current active corporate publisher changed')
 const noticeHeading='RECRUITMENT OF JOURNEYMAN & DRIVER (VEHICLE) [EMPLOYMENT NOTIFICATION -2026/05(J&OP)]'
 // The current corporate page repeats id=CJO for another historical notice.
 // Bind this delegation to its complete own notice heading, not the first ID.
 const sections=d.nodes.filter(n=>n.tag==='div'&&n.attrs.id==='CJO'&&/(?:^|\s)is-active(?:\s|$)/.test(n.attrs.class??'')&&d.text(n).includes(noticeHeading))
 need(sections.length===1,'active current corporate jobs section changed')
 const own=new Set(),walk=n=>{if(!d.allowed(n))return;if(n.tag==='a'){const u=url(n.attrs.href,CAREERS);if(u)own.add(u.replace(/\/$/,''))}for(const c of n.children)if(typeof c!=='string')walk(c)};walk(sections[0])
 need(own.has('https://jobapply.in/grse2026'),'active current corporate/native delegation changed')
 return {notificationId:'2026/05(J&OP)',portal:PORTALS[0],recordKind:'corporate-current-notice-delegation'}
}
export function extractNoticeDetailsFromPdf(pdfText,{notificationId,listingTitle}={}){
 need(typeof pdfText==='string'&&Buffer.byteLength(pdfText)<=4e6,'PDF text missing/oversized')
 const text=clean(pdfText),ids=new Set([...text.matchAll(/EMPLOYMENT NOTIFICATION NO\.\s*(\d{4}\/\d+\s*\([^)]*\))/gi)].map(m=>id(m[1])))
 need(ids.size===1&&ids.has(id(notificationId))&&text.includes(EMPLOYER),'PDF own notification/employer identity changed')
 const postingDate=date(text.match(/Opening Date for Online registration:\s*([^]*?)Closing Date/i)?.[1]),closingDate=date(text.match(/Closing Date for Online registration:\s*([^]*?)GRSE Ltd/i)?.[1])
 need(postingDate&&closingDate&&postingDate<=closingDate,'PDF own registration dates changed')
 return {recordKind:'native-recruitment-document-observation',title:listingTitle,notificationId:id(notificationId),nativeJobId:null,nativeRequisitionId:null,publishedEmployer:EMPLOYER,postingDate,closingDate,country:null,sourceCountryScopeUnresolved:true,jobDescription:null,sourceDetailComplete:false,rawNoticePDFText:pdfText,rawNoticePDFTextSHA256:sha(pdfText),individualRoleRecordsParsed:false,individualVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null}
}
export function createCurrentNoticeScraper({asOfDate=new Date().toISOString().slice(0,10)}={}){
 return {async run({fetchImpl=fetch,fetchText,fetchDocumentText,signal,sourceTimeoutMs=90000,requestTimeoutMs=15000}={}){
  signal?.throwIfAborted()
  need(fetchText===undefined&&fetchDocumentText===undefined,'unverified legacy text/PDF callbacks cannot supply current transport/native proof')
  need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>=1&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>=1&&requestTimeoutMs<=15000,'invalid source/request budget')
  const start=performance.now(),controller=new AbortController(),timeout=new DOMException('Garden Reach source deadline expired','TimeoutError'),timer=setTimeout(()=>controller.abort(timeout),sourceTimeoutMs),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const check=()=>{signal?.throwIfAborted();if(performance.now()-start>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(timeout);combined.throwIfAborted()}
  const receipts=[],retained=[],indices=[],activeNotices=[];let observed=null,stage='corporate-delegation',documentObservation=null
  async function read(target,pdf=false){
   check();const requestedAt=new Date().toISOString();let transport,p
   try{
    p=await boundedDeclaredPublicRead(target,{fetchImpl:async(...args)=>{const response=await fetchImpl(...args);transport={status:response.status,finalURL:response.url,headers:{'content-type':response.headers.get('content-type'),'content-length':response.headers.get('content-length')}};return response},signal:combined,timeoutMs:Math.min(requestTimeoutMs,Math.max(1,Math.floor(sourceTimeoutMs-(performance.now()-start)))),overflowError:held('native response exceeds16MiB')})
   }catch(error){
    check();receipts.push({requestedURL:target,method:'GET',requestedAt,completedAt:new Date().toISOString(),status:transport?.status??null,finalURL:transport?.finalURL??null,headers:transport?.headers??{},bodyBytes:null,bodySHA256:null,failure:{name:error.name,message:String(error.message).slice(0,320),code:error.code}})
    if([403,429].includes(transport?.status))error.status=transport.status
    throw error
   }
   const bytes=Buffer.from(p.bodyBase64,'base64')
   check();const packet={requestedURL:target,method:'GET',requestedAt,completedAt:new Date().toISOString(),status:p.status,finalURL:p.url,headers:{'content-type':p.headers['content-type']??null,'content-length':p.headers['content-length']??null},bodyBytes:bytes.length,bodySHA256:sha(bytes)}
   receipts.push(packet);if(bytes.length<=2*1024*1024&&retained.length<8)retained.push({...packet,url:target,bodySHA256:packet.bodySHA256,rawBodyBase64:p.bodyBase64})
   if([403,429].includes(p.status)||/<title>[^<]*(?:access denied|just a moment|attention required)/i.test(bytes.toString('utf8')))throw Object.assign(Error(`HTTP ${p.status} native public access denied`),{status:p.status,abortRetries:true})
   need(p.status===200&&p.url===target,'transport status/final URL changed')
   need((pdf?/^application\/pdf(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i).test(p.headers['content-type']??''),'native response MIME changed')
   need(pdf?bytes.subarray(0,5).toString()==='%PDF-':bytes.length<=4e6,'native PDF header/HTML body bound changed');check();return bytes
  }
  try{
   check();const delegation=corporateDelegates((await read(CAREERS)).toString('utf8'))
   stage='native-index'
   for(const portal of PORTALS){const notices=extractPortalNotices((await read(portal)).toString('utf8'),{portalIndexUrl:portal});indices.push({portal,notices})}
   const day=date(asOfDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>`${d} ${Object.keys(month).find(k=>k.length===3&&month[k]===+m-1)} ${y}`));need(day,'invalid as-of date')
   const byId=new Map()
   for(const index of indices)for(const notice of index.notices){const old=byId.get(notice.notificationId);need(!old||old.title===notice.title&&old.detailUrl===notice.detailUrl&&old.closingDate===notice.closingDate,'cross-index own notice disagreement');byId.set(notice.notificationId,notice)}
   for(const n of byId.values())if(n.closingDate>=day)activeNotices.push(n)
   observed=activeNotices.length
   need(activeNotices.length===1&&activeNotices[0].notificationId===delegation.notificationId,'current active notice set changed; no verified zero or whole-scope claim')
   const notice=activeNotices[0];stage='native-detail'
   const html=(await read(notice.detailUrl)).toString('utf8');need(hasOfficialNoticeDetailSignal(html,{notificationId:notice.notificationId}),'current native detail identity/declarations changed')
   const pdfURL=extractNoticePdfUrl(html,{detailUrl:notice.detailUrl,notificationId:notice.notificationId});need(pdfURL,'current own detailed PDF delegation changed')
   stage='native-pdf-transport';const pdf=await read(pdfURL,true)
   stage='native-pdf-extraction';check()
   const text=await extractTextFromPdfBuffer(pdf,{timeoutMs:Math.min(requestTimeoutMs,Math.max(1,Math.floor(sourceTimeoutMs-(performance.now()-start)))),signal:combined});check()
   documentObservation=extractNoticeDetailsFromPdf(text,{notificationId:notice.notificationId,listingTitle:notice.title})
   need(documentObservation.closingDate===notice.closingDate&&documentObservation.postingDate<=day,'native PDF/index own date disagreement')
   stage='individual-role-country-contract'
   throw held('group notification is not an individual vacancy; own role-country/full-criteria contract remains unqualified')
  }catch(error){
   check()
   // Keep the exact cached PDF import failure object for restricted-worker
   // capability classification; never wrap it into a generic contract error.
   error.abortRetries=true
   error.nativeEvidence={source:SOURCE,observedListingCount:observed,observedRecordType:'active-native-recruitment-notices-not-individual-vacancies',candidateListingRecords:activeNotices,indexNoticeObservations:indices,documentObservation,jobs:[],failures:[{stage,name:error.name,message:String(error.message).slice(0,320),code:error.code,cause:error.cause}],transportPackets:receipts,retainedResponses:retained,inventoryComplete:false,listingPaginationComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null}
   throw error
  }finally{clearTimeout(timer)}
 }}
}
