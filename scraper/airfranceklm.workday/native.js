import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const HOME='https://recrutement.airfrance.com/accueil.aspx?lcid=2057'
const ORIGIN='https://recrutement.airfrance.com'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim()
const own=(value,key)=>{try{return Object.getOwnPropertyDescriptor(value??{},key)?.value}catch{return undefined}}
const safeMessage=error=>typeof own(error,'message')==='string'?own(error,'message').slice(0,350):'Opaque source read failure'
const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
const failure=(message,extra={})=>Object.assign(Error('Air France native reader: '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap',lifecycleCleanupAllowed:false,...extra})
const requireNative=(condition,message)=>{if(!condition)throw failure(message)}
const rolePath=/^\/(?:job\/job-|offre-de-emploi\/emploi-)[a-z0-9-]+_(\d+)\.aspx$/
const target=(href,base)=>{try{const url=new URL(href,base);if(url.origin!==ORIGIN||url.username||url.password||url.port)return null;url.hash='';return url}catch{return null}}
const documentFor=html=>{
 // The small shared tree is not an HTML conformance authority for MathML or
 // effective document bases. Keep such originals but grant no link authority.
 requireNative(!/<(?:base|math)(?=[\t\n\f\r />])/i.test(html),'unsupported native document base/MathML context')
 const doc=readNativeDocument(html)
 const titles=doc.nodes(n=>n.tag==='title').map(n=>clean(decodeNativeEntities(n.raw||'')))
 requireNative(titles.length===1&&/^AIR FRANCE\s*[-–—]/i.test(titles[0]),'native publisher title changed')
 return doc
}
const nativeLinks=(doc,url)=>{
 const records=[],seen=new Set(),listings=[],pagination=[]
 const parents=new Map(),root=doc.nodes(n=>n.tag==='root')[0]
 const visit=node=>{for(const child of node.children)if(typeof child!=='string'){parents.set(child,node);visit(child)}};visit(root)
 for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
  const resolved=target(node.attrs.href,url);if(!resolved)continue
  const match=resolved.pathname.match(rolePath),label=clean(doc.text(node))
  if(match&&!resolved.search&&label){let parent=parents.get(node);while(parent&&!['li','root'].includes(parent.tag))parent=parents.get(parent)
   if(parent?.tag==='li'&&(doc.hasClass(parent,'ts-offer-list-item')||doc.hasClass(parent,'offerlist-item'))&&!seen.has(match[1])){seen.add(match[1]);records.push({id:match[1],title:label,url:resolved.href,literalHref:node.attrs.href,documentUrl:url,country:null,legalEmployer:null,detailInspected:false})}
  }
  if(/^\/(?:job\/list-of-all-jobs|offre-de-emploi\/liste-toutes-offres)\.aspx$/.test(resolved.pathname)){
   if([...resolved.searchParams].length===2&&resolved.searchParams.get('all')==='1'&&resolved.searchParams.get('mode')==='list'
     &&/^(?:View all vacancies|Voir toutes les offres)$/i.test(label))listings.push({url:resolved.href,literalHref:node.attrs.href,label,documentUrl:url})
   if(/^\d+$/.test(resolved.searchParams.get('page')||'')&&/^\d+$/.test(resolved.searchParams.get('LCID')||'')
     &&[...resolved.searchParams].length===2)pagination.push({url:resolved.href,literalHref:node.attrs.href,documentUrl:url})
  }
 }
 const text=doc.text(root),totals=[...text.matchAll(/(?:Nombre de résultats\s*:\s*(\d+)\s*offre\(s\)|Number of results\s*:\s*(\d+)\s*(?:vacanc|job))/gi)].map(m=>Number(m[1]||m[2]))
 requireNative(new Set(totals).size<=1,'contradictory mixed publisher listing totals')
 return {records,listings,pagination:[...new Map(pagination.map(row=>[row.url,row])).values()],mixedTotal:totals[0]??null}
}
export const extractTalentsoftDetail=(html,url,listing)=>{
 const doc=documentFor(html),parts=doc.nodes(n=>n.attrs.id==='contenu-ficheoffre')
 requireNative(parts.length===1,'native full detail container missing or ambiguous')
 const content=parts[0],fields=[]
 for(const [index,node]of content.children.entries()){
  if(typeof node==='string'||!/^h[23]$/.test(node.tag)||node.inert)continue
  const values=[]
  for(let i=index+1;i<content.children.length;i++){const sibling=content.children[i];if(typeof sibling!=='string'&&/^h[23]$/.test(sibling.tag))break;values.push(typeof sibling==='string'?decodeNativeEntities(sibling):doc.text(sibling))}
  fields.push({label:clean(doc.text(node)),value:clean(values.join(' ')),heading:node.tag})
 }
 const field=label=>{const values=fields.filter(row=>row.heading==='h3'&&row.label===label).map(row=>row.value);requireNative(values.length<=1,'duplicate native detail field '+label);return values[0]||null}
 const title=field('Intitulé du poste')||field('Job title')
 const headings=doc.nodes(n=>n.tag==='h1').map(n=>clean(doc.text(n)))
 requireNative(title&&title===listing.title&&headings.includes(title),'native listing/detail title mismatch')
 const contentText=doc.text(content),refs=[...contentText.matchAll(/(?:Référence|Reference)\s+(\d{4}-\d+)\b/g)].map(m=>m[1])
 requireNative(refs.length===1&&refs[0].split('-').at(-1)===listing.id,'native reference/listing ID mismatch')
 const location=field('Localisation du poste')||field('Job location')
 const country=location?nativeCountryName(location.split(',')[0].trim()):null
 const context=field('Présentation du contexte'),mission=field('Description de la mission'),profile=field('Profil recherché')
 requireNative(context&&mission&&profile,'native full context/mission/profile unavailable')
 const information=fields.find(row=>row.label==='Informations générales')?.value||null
 return {id:listing.id,reference:refs[0],title,url,country,location,legalEmployer:null,nativeHiringOrganization:null,
  nativeEntityContext:information,nativeEmployerScope:'unqualified-parent-group-context',
  context,mission,profile,nativeFields:fields,fullCriteriaComplete:true,
  minimumQualification:field("Niveau d'études min. requis"),experienceRequired:field("Niveau d'expérience min. requis"),
  language:field('Langue'),employmentType:field('Type de contrat'),schedule:field("Type d'horaires"),site:field('Site'),
  desiredStartDateRaw:field('Date de prise de poste souhaitée'),postingDate:null,postedAt:null,closingDate:null,
  sourceDescription:fields.map(row=>row.label+'\n'+row.value).join('\n\n'),
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false}
}

export async function runTalentsoft(options={}){
 options.signal?.throwIfAborted()
 const limit=(name,fallback,max,min=1)=>{const n=options[name]??fallback;if(!Number.isSafeInteger(n)||n<min||n>max)throw RangeError('Air France invalid '+name);return n}
 const bounds={maxRequests:limit('maxRequests',5,128),maxPages:limit('maxPages',2,24),
  // A hard ceiling also bounds broad generic runner overrides. Listing rows
  // remain unknown when their full details were not inspected.
  maxDetails:Math.min(limit('maxDetails',3,100000,0),5),requestTimeoutMs:limit('requestTimeoutMs',20000,30000),
  sourceTimeoutMs:limit('sourceTimeoutMs',100000,180000),callbackTimeoutMs:limit('callbackTimeoutMs',5000,30000),
  maxResponseBytes:limit('maxResponseBytes',4*1024*1024,16*1024*1024),maxTotalBytes:limit('maxTotalBytes',12*1024*1024,32*1024*1024)}
 for(const name of ['fetchPage','fetchImpl','fetchText','onAudit','onMetadata','onRecords','now','monotonicNow'])if(options[name]!==undefined&&typeof options[name]!=='function')throw TypeError('Air France invalid '+name)
 if(options.heldHosts!==undefined&&!(options.heldHosts instanceof Set))throw TypeError('Air France invalid heldHosts')
 const wall=()=>{const value=options.now?options.now():new Date();const date=new Date(value);if(value===''||!Number.isFinite(date.getTime()))throw RangeError('Air France invalid source clock');return date.toISOString()}
 let last=-1;const mono=()=>{const n=options.monotonicNow?options.monotonicNow():performance.now();if(!Number.isFinite(n)||n<last||n<0)throw RangeError('Air France invalid monotonic clock');last=n;return n}
 const started=wall();mono()
 const held=options.heldHosts??new Set(),audit={source:'airfranceklm',startedAt:started,completedAt:null,outcome:'coverage-gap',bounds,
  responses:[],records:[],detailRecords:[],exclusions:[],issues:[],declarations:[],paginationDeclarations:[],
  mixedPublisherReportedTotal:null,nativeReportedTotal:null,nativeIndiaTotal:null,companyGlobalTotal:null,companyIndiaTotal:null,
  inventoryVerifiedAt:null,listingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  corporateJavaScriptExecuted:false,subresourcesRequested:false,redirectsFollowed:false,decodedBytes:0}
 const scope=(name,ms,parent)=>{
  const controller=new AbortController(),real=performance.now(),logical=mono()
  const timeout=failure(name+' deadline exceeded',{failureKind:'network_or_timeout'})
  const signal=AbortSignal.any([controller.signal,...(parent?[parent.signal]:[]),...(options.signal?[options.signal]:[])])
  const timer=setTimeout(()=>controller.abort(timeout),ms)
  const check=()=>{options.signal?.throwIfAborted();parent?.check();if(Math.max(performance.now()-real,mono()-logical)>=ms&&!controller.signal.aborted)controller.abort(timeout);signal.throwIfAborted()}
  const wait=(fn,late)=>new Promise((resolve,reject)=>{let settled=false;const detach=()=>signal.removeEventListener('abort',aborted);const fail=error=>{if(!settled){settled=true;detach();reject(error)}};const aborted=()=>fail(signal.reason);signal.addEventListener('abort',aborted,{once:true});try{check()}catch(error){fail(error);return}Promise.resolve().then(()=>{check();return fn()}).then(value=>{if(settled){if(late)ignore(()=>late(value));return}try{check()}catch(error){fail(error);if(late)ignore(()=>late(value));return}settled=true;detach();resolve(value)},error=>{if(!settled){try{check()}catch(reason){error=reason}fail(error)}})})
  return {signal,check,wait,close:()=>clearTimeout(timer)}
 }
 let auditAttempted=false
 const source=scope('source',bounds.sourceTimeoutMs),release=reader=>ignore(()=>reader.releaseLock())
 const cancelReader=reader=>{ignore(()=>reader.cancel());release(reader)},cancelBody=response=>ignore(()=>response?.body?.cancel())
 const gap=()=>({status:'coverage-gap',surface:HOME,firstParty:audit.responses.some(r=>r.transportQualified),pagesFetched:audit.responses.filter(r=>r.transportQualified).length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:'bounded-native-Talentsoft-context;publisher-and-company-scope-unverified;cleanup-forbidden'})
 const clocks=(page,row,capture)=>{
  for(const key of ['sourceRequestedAt','sourceCompletedAt']){
   const values=[page?.[key],capture?.[key]].filter(v=>v!=null)
   requireNative(values.every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&v===values[0]),'contradictory original acquisition clock')
   row[key]=values[0]??null
  }
  requireNative(!row.sourceRequestedAt||!row.sourceCompletedAt||Date.parse(row.sourceRequestedAt)<=Date.parse(row.sourceCompletedAt),'original acquisition clock order changed')
 }
 const read=async url=>{
  source.check();requireNative(audit.responses.length<bounds.maxRequests,'native request budget exhausted')
  requireNative(target(url,HOME)?.href===url,'unbound native document URL')
  requireNative(![...held].some(host=>host==='recrutement.airfrance.com'||host==='airfrance.com'),'public host held after access denial')
  const row={requestUrl:url,status:null,finalUrl:null,headers:{},bodyBase64:null,bytes:null,sha256:null,bodyUnavailable:false,bodyComplete:false,transportQualified:false,sourceRequestedAt:null,sourceCompletedAt:null,sourceHttpDate:null,error:null}
  audit.responses.push(row);const request=scope('request',bounds.requestTimeoutMs,source)
  const init={method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:'text/html'},signal:request.signal,throwIfAborted:request.check}
  let reader,response,complete=false
  try{
   let page,capture
   if(options.fetchPage)page=await request.wait(()=>options.fetchPage(url,init),cancelBody)
   else if(options.fetchText&&!options.fetchImpl){const value=await request.wait(()=>options.fetchText(url,init));page=typeof value==='object'?value:{url,html:value}}
   else {const requestedAt=wall();response=await request.wait(()=>(options.fetchImpl??globalThis.fetch)(url,init),cancelBody);capture=response?.sourceCapture;page={url:response?.url,status:response?.status,headers:Object.fromEntries(response?.headers??[])};if(!capture)page.sourceRequestedAt=requestedAt}
   request.check();capture??=page?.sourceCapture
   row.status=page?.status??null;row.finalUrl=page?.finalUrl??page?.url??null;row.headers=Object.fromEntries(new Headers(page?.headers??{}));row.sourceHttpDate=page?.sourceHttpDate??row.headers.date??null
   row.bodyUnavailable=page?.bodyUnavailable===true||capture?.bodyUnavailable===true||capture?.availability==='unavailable'
   clocks(page,row,capture)
   if([401,403,429,451].includes(row.status))held.add('recrutement.airfrance.com')
   if(capture){for(const [key,want]of [['requestedURL',url],['finalURL',row.finalUrl],['status',row.status]])if(capture[key]!==undefined)requireNative(capture[key]===want,'source capture response identity changed')}
   if(!row.bodyUnavailable){
    let bytes
    if(response){
     requireNative(response.body?.getReader,'original readable body unavailable')
     reader=await request.wait(()=>response.body.getReader(),cancelReader);const chunks=[];let size=0
     for(;;){const item=await request.wait(()=>reader.read());request.check();if(item.done)break;requireNative(item.value instanceof Uint8Array,'native stream chunk is not bytes');size+=item.value.byteLength;requireNative(size<=bounds.maxResponseBytes&&audit.decodedBytes+size<=bounds.maxTotalBytes,'native body byte budget exceeded');chunks.push(Buffer.from(item.value))}
     bytes=Buffer.concat(chunks);if(!capture)row.sourceCompletedAt=wall()
    }else{
     const encoded=page?.bodyBase64
     requireNative(typeof encoded==='string'&&encoded.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),'original body bytes unavailable or malformed')
     requireNative(encoded.length<=Math.ceil(bounds.maxResponseBytes/3)*4,'native encoded body budget exceeded')
     bytes=Buffer.from(encoded,'base64');requireNative(bytes.toString('base64')===encoded,'noncanonical native original bytes')
    }
    requireNative(bytes.length<=bounds.maxResponseBytes&&audit.decodedBytes+bytes.length<=bounds.maxTotalBytes,'native body byte budget exceeded')
    Object.assign(row,{bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:hash(bytes),bodyComplete:true});audit.decodedBytes+=bytes.length
    for(const expected of [page?.sha256,capture?.bodySHA256])if(expected!=null)requireNative(expected===row.sha256,'original body hash contradicted')
    for(const expected of [page?.bytes,capture?.bodyBytes])if(expected!=null)requireNative(expected===bytes.length,'original body byte count contradicted')
   }
   request.check()
   if(row.status!==200)throw failure('original HTTP '+row.status,{status:row.status,failureKind:[401,403,429,451].includes(row.status)?'blocked_or_access_denied':[500,502,503,504].includes(row.status)?'network_or_timeout':'coverage_gap'})
   requireNative(!row.bodyUnavailable&&row.bodyComplete,'original response entity unavailable')
   requireNative(row.finalUrl===url&&(page?.requestedUrl===undefined||page.requestedUrl===url),'original response URL changed; redirects forbidden')
   requireNative(/^text\/html(?:\s*;|$)/i.test(row.headers['content-type']||''),'native original MIME is not HTML')
   const bytes=Buffer.from(row.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
   for(const name of ['html','text'])if(typeof page?.[name]==='string')requireNative(page[name]===html,'decoded HTML contradicts original bytes')
   row.transportQualified=true;complete=true;return html
  }catch(error){row.error={message:safeMessage(error),code:own(error,'code')??null};options.signal?.throwIfAborted();source.check();throw error}
  finally{request.close();if(reader){if(complete)release(reader);else cancelReader(reader)}else if(!complete)cancelBody(response)}
 }
 const deliver=async(name,value)=>{if(!options[name])return;if(name==='onAudit')auditAttempted=true;const callback=scope(name,bounds.callbackTimeoutMs,source);try{await callback.wait(()=>options[name](structuredClone(value),{signal:callback.signal,throwIfAborted:callback.check}))}finally{callback.close()}}
 const retainError=(error,stage,url)=>audit.issues.push({kind:'native-read-unresolved',stage,url,message:safeMessage(error),code:own(error,'code')??null})
 const records=new Map(),reconcile=(discovery,prefer=false)=>{
  for(const row of discovery.records){const previous=records.get(row.id);if(previous&&previous.title!==row.title){audit.issues.push({kind:'native-identity-conflict',id:row.id,message:'native listing title changed'});previous.identityConflict=true;continue}if(!previous||prefer)records.set(row.id,row)}
  audit.records=[...records.values()]
 }
 try{
  const homeHTML=await read(HOME),home=nativeLinks(documentFor(homeHTML),HOME);reconcile(home)
  audit.declarations.push(...home.listings)
  let selected=home
  if(home.listings.length&&bounds.maxPages>=2&&audit.responses.length<bounds.maxRequests){
   const url=home.listings[0].url
   try{const html=await read(url),listing=nativeLinks(documentFor(html),url);selected=listing;reconcile(listing,true);audit.declarations.push(...listing.listings);audit.paginationDeclarations=listing.pagination;audit.mixedPublisherReportedTotal=listing.mixedTotal}
   catch(error){options.signal?.throwIfAborted();source.check();retainError(error,'listing',url)}
  }
  let inspected=0
  for(const row of selected.records){source.check();if(inspected>=bounds.maxDetails||audit.responses.length>=bounds.maxRequests)break;inspected++
   if(records.get(row.id)?.identityConflict)continue
   try{const html=await read(row.url),detail=extractTalentsoftDetail(html,row.url,row);source.check();const record=records.get(row.id);Object.assign(record,{country:detail.country,detailInspected:true,reference:detail.reference});audit.detailRecords.push(detail)
    if(detail.country&&detail.country!=='India')audit.exclusions.push({reason:'native-explicit-non-India-country',id:row.id,url:row.url,country:detail.country})
    else audit.issues.push({kind:'native-scope-unresolved',id:row.id,country:detail.country,reason:detail.country==='India'?'exact-native-employer-unqualified':'native-country-unqualified'})
   }catch(error){options.signal?.throwIfAborted();source.check();retainError(error,'detail',row.url)}
   if(held.has('recrutement.airfrance.com'))break
  }
  audit.uninspectedIds=audit.records.filter(row=>!row.detailInspected).map(row=>row.id)
  source.check();audit.completedAt=wall();audit.inventoryEvidence=gap()
  await deliver('onMetadata',{source:'airfranceklm',companyName:'Air France-KLM',sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedPublicJobCount:null,verifiedIndiaJobCount:null})
  await deliver('onAudit',audit);await deliver('onRecords',[]);source.check()
  const jobs=attachInventoryEvidence([],gap())
  if(records.size)attachSourceObservationEvidence(jobs,{source:'airfranceklm',recordKind:'vacancy-rows',observedRecordCount:records.size,observedVacancyCount:records.size,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperties(jobs,{nativeCollectionEvidence:{value:structuredClone(audit),configurable:true},sourceAudit:{value:structuredClone(audit)}})
  return jobs
 }catch(error){
  audit.outcome='failed';try{audit.completedAt=wall()}catch{}
  audit.inventoryEvidence=gap()
  // Retain arbitrary/frozen caller failures without invoking setters or
  // replacing their identity. Source callbacks cannot conceal a read failure.
  if(!options.signal?.aborted&&!auditAttempted){try{await deliver('onAudit',audit)}catch{}}
  try{if(error&&typeof error==='object'&&Object.isExtensible(error))for(const [key,value]of Object.entries({sourceAudit:structuredClone(audit),inventoryEvidence:gap()})){const prior=Object.getOwnPropertyDescriptor(error,key);if(!prior||prior.configurable&&Object.hasOwn(prior,'value'))Object.defineProperty(error,key,{value,configurable:true})}}catch{}
  options.signal?.throwIfAborted();throw error
 }finally{source.close()}
}

