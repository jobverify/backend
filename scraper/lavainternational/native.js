import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
export const URLS={about:'https://www.lavamobiles.com/aboutus',careers:'https://www.lavamobiles.com/career',listing:'https://www.lavamobiles.com/career/joblist',
 client:'https://www.lavamobiles.com/_next/static/chunks/pages/career/joblist-783e5d6dcbb52fef.js',
 detailClient:'https://www.lavamobiles.com/_next/static/chunks/6654-020f0a53929a2300.js',
 applicationClient:'https://www.lavamobiles.com/_next/static/chunks/5160-2dbb13fedabbe320.js',
 positions:'https://www.lavamobiles.com/api/openpositionlist'}
const HASHES={client:'b2636f22953f94e109f0d5fa602b153d62d0304deaf7e92224d83d466e8d18d4',detailClient:'da5f87cfd00a85bd644ba6cfeb956e1d76162e9a7afa8bee23fa3d4a9ac95453',applicationClient:'3ba71f4526d3d3a964d03f2cd2debd10b188d882e6e5a58841e4cea188e97c63'}
export const sha256=value=>createHash('sha256').update(value).digest('hex')
const check=(value,message)=>{if(!value)throw Error('Lava current native inventory: '+message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
const executable=node=>node.tag==='script'&&node.attrs.src&&!Object.hasOwn(node.attrs,'nomodule')&&(!node.attrs.type||['module','text/javascript','application/javascript'].includes(node.attrs.type.toLowerCase()))
export function inspectLavaSurfaces(surfaces){
 const routes={about:'/aboutus',careers:'/career',listing:'/career/joblist'},reasons=[],contexts=new Set()
 for(const [name,route]of Object.entries(routes)){
  const html=surfaces[name];check(typeof html==='string','missing '+name+' surface')
  const doc=readNativeDocument(html),next=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
  check(next.length===1,'missing native route data: '+name)
  let data;try{data=JSON.parse(next[0].raw)}catch{check(false,'invalid native route JSON')}
  check(data.page===route,'native route identity changed: '+name)
  const root=doc.nodes(n=>n.tag==='root')[0]
  check(root&&doc.text(root).includes('Lava International Limited'),'native legal employer identity changed: '+name)
  const hrefs=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>{try{return new URL(n.attrs.href,URLS[name]).href}catch{return null}}).filter(Boolean)
  check(hrefs.includes(URLS.careers)&&hrefs.includes(URLS.listing),'current careers handoff missing: '+name)
  for(const url of hrefs.filter(url=>/\/careers?\b|\/jobs?\b|\/positions?\b|greenhouse|lever\.co|workable|teamtailor|recruitee|oraclecloud|workday/i.test(url)))contexts.add(url)
  for(const frame of doc.nodes(n=>['iframe','object'].includes(n.tag)))reasons.push('unreviewed-native-frame-or-object:'+name)
  if(name==='listing')for(const key of Object.keys(HASHES)){
   check(doc.nodes(n=>executable(n)&&new URL(n.attrs.src,URLS.listing).href===URLS[key]).length===1,'current '+key+' delegation missing')
   check(typeof surfaces[key]==='string'&&sha256(surfaces[key])===HASHES[key],'reviewed '+key+' contract changed')
  }
 }
 for(const url of contexts)if(![URLS.careers,URLS.listing].includes(url))reasons.push('unreconciled-additional-hiring-context')
 return{employer:'Lava International Limited',hiringContexts:[...contexts].sort(),reasons:[...new Set(reasons)],clientHashes:HASHES}
}
const identity=row=>{
 check(row&&typeof row==='object'&&!Array.isArray(row),'invalid native row')
 const id=String(row.id??'');check(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id)),'invalid native posting id')
 check(clean(row.designation),'missing native title')
 check(clean(row.alm?.name)&&clean(row.adm?.department_name),'missing native location or department')
 check(typeof row.experience_year==='number'&&Number.isFinite(row.experience_year)&&row.experience_year>=0||typeof row.experience_year==='string'&&clean(row.experience_year),'missing native experience')
 return id
}
export function inspectLavaPayload(payload){
 check(Array.isArray(payload),'native listing must be an unpaginated array')
 check(payload.length<=1000,'native inventory exceeds reviewed collection budget')
 const ids=new Set();for(const row of payload){const id=identity(row);check(!ids.has(id),'duplicate native posting identity');ids.add(id)}
 return payload
}
const nativeCountries=new Map(),regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regions.of(code)
 if(name&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code))nativeCountries.set(name.toLowerCase(),name)
}
for(const [name,canonical]of[['usa','United States'],['united states of america','United States'],['uk','United Kingdom'],['uae','United Arab Emirates']])nativeCountries.set(name,canonical)
function workCountry(location,pdf){
 // Generic Country/Location labels can describe an office or interview. Only
 // native job location or explicit Job/Work labels establish work geography.
 const lines=pdf.split(/\r?\n/),explicit=lines.filter(line=>/^\s*(?:work|job)\s+(?:location|country)\s*:/i.test(line))
 const countriesFor=values=>[...new Set(values.flatMap(value=>value.split(/[,;|]/).map(clean)).map(v=>nativeCountries.get(v.toLowerCase())).filter(Boolean))]
 const proven=countriesFor([location,...explicit.map(line=>line.replace(/^[^:]+:/,''))])
 const generic=lines.filter(line=>/^\s*(?:location|country)\s*:/i.test(line)).map(line=>line.replace(/^[^:]+:/,''))
 const conflicting=countriesFor(generic).some(country=>!proven.includes(country))
 return proven.length===1&&!conflicting?proven[0]:null
}
export function projectLavaRole(row,detail,pdfText,now){
 const id=identity(row)
 check(detail&&typeof detail==='object'&&!Array.isArray(detail),'missing full native role identity')
 check(String(detail.id)===id&&clean(detail.designation)===clean(row.designation)&&clean(detail.location_name)===clean(row.alm.name)
  &&clean(detail.department_name)===clean(row.adm.department_name)&&String(detail.experience_year)===String(row.experience_year)
  &&detail.rff_number==='RRF_'+id,'native list/detail/application identity mismatch')
 check(typeof pdfText==='string'&&pdfText.trim().length>=100,'full native PDF description unavailable')
 check(clean(pdfText).includes(clean(row.designation))&&/\bLava International Limited\b/i.test(pdfText),'native PDF title/employer mismatch')
 check(!/\b(?:position (?:is )?(?:closed|filled)|job (?:is )?(?:closed|expired)|no longer accepting applications)\b/i.test(pdfText),'native PDF role is closed')
 for(const [key,value]of Object.entries(detail))if(/qualif|education|eligib|skill|responsib|requirement/i.test(key)&&value!=null&&value!==''&&(!Array.isArray(value)||value.length))check(false,'unreviewed structured criteria outside native PDF')
 const location=clean(detail.location_name),country=workCountry(location,pdfText),pdfUrl='https://empower.indlava.com/openpositions/viewpdf/'+id
 return{source:'lavainternational',company:'Lava International',legalEmployer:'Lava International Limited',title:clean(detail.designation),jobId:id,
  requisitionId:detail.rff_number,department:clean(detail.department_name),location,city:null,country,remoteStatus:null,employmentType:null,
  experienceRequired:String(detail.experience_year)+' years',minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:null,closingDate:null,sourceUrl:URLS.listing,applyUrl:URLS.listing,link:URLS.listing,
  applicationContext:{kind:'native-role-application-modal',nativePostingId:row.id,jobTitle:clean(row.designation),department:clean(row.adm.department_name)},
  applicationSubmitted:false,jobDescription:pdfText,sourceDescription:pdfText,nativeDescriptionSections:{fullPdf:pdfText},nativeDescriptionPdfUrl:pdfUrl,
  sourceDetailComplete:true,fullNativeCriteriaAvailable:true,sourceAvailabilityVerified:true,scrapedAt:now}
}
const bounded=(operation,signal)=>new Promise((resolve,reject)=>{
 const cleanup=()=>signal.removeEventListener('abort',abort),abort=()=>{cleanup();reject(signal.reason||Error('Lava request aborted'))}
 if(signal.aborted){abort();return}signal.addEventListener('abort',abort,{once:true})
 Promise.resolve().then(operation).then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})
})
export async function runNativeLava(options={}){
 const cap=options.maxJobs??Infinity,timeout=options.timeoutMs??120000,interval=options.requestIntervalMs??500
 check(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid caller cap')
 check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'invalid source deadline')
 check(Number.isSafeInteger(interval)&&interval>=0&&(interval>=500||options.fetchPage||options.fetchImpl),'invalid request pacing')
 const now=typeof options.now==='function'?options.now():options.now||new Date().toISOString();check(Number.isFinite(Date.parse(now)),'invalid observation time')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Lava native source deadline exceeded')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,load=options.fetchPage||options.fetchImpl||globalThis.fetch
 let previous=0;const receipts=[],allowed=new Set(Object.values(URLS))
 const get=async(url,pdf=false)=>{
  signal.throwIfAborted();check(allowed.has(url),'request outside current public careers contract')
  const remaining=interval-(Date.now()-previous);if(remaining>0)await delay(remaining,undefined,{signal});signal.throwIfAborted();previous=Date.now()
  const r=await bounded(()=>load(url,{method:'GET',redirect:'manual',signal,headers:{Accept:pdf?'application/pdf':url.includes('/api/')?'application/json':'text/html,application/javascript'}}),signal)
  if(r.status!==200)throw Object.assign(Error('Lava public HTTP '+r.status+'; stopped without retry'),{status:r.status,abortRetries:true,softFailure:true,upstreamOutage:true})
  check(r.url===url,'public response redirected outside advertised native binding')
  const bytes=Buffer.from(await bounded(()=>r.arrayBuffer(),signal));signal.throwIfAborted()
  check(bytes.length<=(pdf?12000000:3000000),'native response exceeds budget')
  if(pdf)check(bytes.subarray(0,5).toString('ascii')==='%PDF-'&&/application\/pdf/i.test(r.headers.get('content-type')||''),'native full description is not a public PDF')
  receipts.push({url,method:'GET',status:200,sha256:sha256(bytes),bytes:bytes.length,at:new Date().toISOString()})
  return pdf?bytes:bytes.toString('utf8')
 }
 const snapshot=async()=>{
  const surfaces={};for(const key of ['about','careers','listing','client','detailClient','applicationClient'])surfaces[key]=await get(URLS[key])
  const binding=inspectLavaSurfaces(surfaces)
  const body=await get(URLS.positions)
  let raw;try{raw=JSON.parse(body)}catch(error){throw Error('Lava native listing JSON: '+error.message)}
  return{binding,rows:inspectLavaPayload(raw)}
 }
 try{
  const first=await snapshot(),records=[],reasons=[...first.binding.reasons]
  for(const row of first.rows){
   const id=String(row.id),detailUrl='https://www.lavamobiles.com/api/openpositionsingleview?id='+id,pdfUrl='https://empower.indlava.com/openpositions/viewpdf/'+id
   allowed.add(detailUrl);allowed.add(pdfUrl)
   const detail=JSON.parse(await get(detailUrl)),pdf=await get(pdfUrl,true)
   const extract=options.extractPdfText||(await import('../../scraper-support/shared/pdfText.js')).extractTextFromPdfBuffer
   const text=await bounded(()=>extract(pdf,{signal,timeoutMs:Math.min(timeout,45000)}),signal)
   const job=projectLavaRole(row,detail,text,now);records.push(job)
   if(!job.country)reasons.push('native-job-country-unresolved:'+id)
  }
  const last=await snapshot()
  check(canonical(first)===canonical(last),'native closing inventory/binding changed; zero or complete scope unavailable')
  // Recheck each full role as well as the list, before selecting output caps.
  for(let i=0;i<first.rows.length;i++){
   const row=first.rows[i],id=String(row.id),detail=JSON.parse(await get('https://www.lavamobiles.com/api/openpositionsingleview?id='+id)),pdf=await get('https://empower.indlava.com/openpositions/viewpdf/'+id,true)
   const extract=options.extractPdfText||(await import('../../scraper-support/shared/pdfText.js')).extractTextFromPdfBuffer
   const job=projectLavaRole(row,detail,await bounded(()=>extract(pdf,{signal,timeoutMs:Math.min(timeout,45000)}),signal),now)
   check(canonical(job)===canonical(records[i]),'native closing role fields or full PDF changed')
  }
  const india=records.filter(j=>j.country==='India'),selected=india.slice(0,cap)
  if(selected.length!==india.length)reasons.push('caller-cap-after-native-reconciliation')
  const complete=reasons.length===0,native={verifiedAt:now,nativeGlobalCount:first.rows.length,nativeIndiaCount:india.length,fullNativeDescriptionCount:records.length,
   unknownCountryCount:records.filter(j=>!j.country).length,foreignCountryCount:records.filter(j=>j.country&&j.country!=='India').length,returnedIndiaCount:selected.length,fullNativeCriteriaLiveVerified:records.length>0,
   sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,indiaAbsenceProven:complete&&india.length===0,closingReconciled:true,
   hiringContexts:first.binding.hiringContexts,reasons:[...new Set(reasons)],records,receipts}
  for(const job of selected)Object.assign(job,{sourceScopeComplete:complete,sourceListingComplete:complete,lifecycleCleanupAllowed:complete})
  Object.defineProperty(selected,'nativeInventoryEvidence',{value:native})
  signal.throwIfAborted();if(options.onNativeEvidence)await options.onNativeEvidence(native);signal.throwIfAborted()
  return attachInventoryEvidence(selected,{status:complete?first.rows.length?'complete-inventory':'verified-empty':'coverage-gap',surface:URLS.listing,firstParty:true,
   listingComplete:complete,pagesFetched:receipts.length,reportedTotal:first.rows.length,indiaFacetCount:complete?india.length:null,verifiedAt:now,
   reason:complete?'complete-current-first-party-native-board-and-closing-snapshot':native.reasons.join(';')})
 }finally{clearTimeout(timer)}
}
